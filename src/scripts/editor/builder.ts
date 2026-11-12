// Edit and build: the editor, the call to the compile service, the results,
// and flashing the image. Loaded only when someone opens the editor; esptool-js
// loads later still, when they press Flash.
import { mountEditor, type SketchEditor } from "./codemirror";
import {
  buildRequest,
  checkBeforeBuild,
  healthMessage,
  kb,
  percent,
  readAnswer,
  storageKey,
  type CompileAnswer,
  type CompileError,
  type CompileResult,
} from "../../lib/compile-client";
import { flashMergedImage, serialSupport } from "../../lib/esp-flash";

interface Ctx {
  root: HTMLElement;
  api: string;
  project: string;
  baud: number;
  benchHref: string;
  hasSettings: boolean;
  tool: boolean;
  original: string;
  editor: SketchEditor;
  image: Uint8Array | null;
  chip: string;
  board: () => string;
  libs: () => string[];
  huge: () => boolean;
}

const q = <T extends HTMLElement>(root: HTMLElement, sel: string) => root.querySelector<T>(sel);

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function store(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage can be blocked; edits then last for this visit only.
  }
}
function recall(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setStatus(ctx: Ctx, text: string, bad = false) {
  const s = q<HTMLElement>(ctx.root, "[data-sb-status]");
  if (!s) return;
  s.textContent = text;
  s.classList.toggle("bad", bad);
}

function codeKey(ctx: Ctx): string {
  return ctx.tool ? storageKey("tool", "sketch") : storageKey(ctx.project, ctx.board());
}

function markEdited(ctx: Ctx) {
  const edited = ctx.editor.getCode() !== ctx.original;
  const reset = q<HTMLButtonElement>(ctx.root, "[data-sb-reset]");
  if (reset) reset.disabled = !edited;
  const note = q<HTMLElement>(ctx.root, "[data-sb-edited]");
  if (note) note.hidden = !edited;
}

/** Open the editor in a builder root. Safe to call twice. */
export async function openBuilder(root: HTMLElement): Promise<void> {
  if (root.dataset.sbReady) return;
  root.dataset.sbReady = "1";
  const d = root.dataset;
  const tool = d.mode === "tool";
  const panelCode = root.closest("[data-panel]")?.querySelector("pre.code code")?.textContent ?? "";
  const original = tool ? (q<HTMLTextAreaElement>(root, "[data-sb-starter]")?.value ?? "") : panelCode;

  const host = q<HTMLElement>(root, "[data-sb-editor]")!;
  const boardSelect = q<HTMLSelectElement>(root, "[data-sb-board]");
  const hugeBox = q<HTMLInputElement>(root, "[data-sb-huge]");
  const ctx = {
    root,
    api: d.api ?? "",
    project: d.project ?? "",
    baud: Number(d.baud ?? 115200),
    benchHref: d.bench ?? "/bench/",
    hasSettings: d.settings === "1",
    tool,
    original,
    image: null,
    chip: "",
    board: () => boardSelect?.value ?? d.board ?? "esp32",
    libs: () =>
      tool
        ? [...root.querySelectorAll<HTMLInputElement>("[data-sb-lib]:checked")].map((c) => c.value)
        : (JSON.parse(d.libs ?? "[]") as string[]),
    huge: () => (tool ? !!hugeBox?.checked : d.huge === "1"),
  } as Omit<Ctx, "editor"> as Ctx;

  if (tool) restoreToolChoices(ctx);
  const saved = recall(codeKey(ctx));
  ctx.editor = mountEditor(
    host,
    saved ?? original,
    (code) => {
      store(codeKey(ctx), code === ctx.original ? null : code);
      markEdited(ctx);
    },
    tool ? "Sketch editor" : "Sketch editor for this project",
  );
  markEdited(ctx);

  q<HTMLButtonElement>(root, "[data-sb-build]")?.addEventListener("click", () => void build(ctx));
  q<HTMLButtonElement>(root, "[data-sb-reset]")?.addEventListener("click", () => {
    if (!window.confirm("Throw away your changes and go back to the original sketch?")) return;
    ctx.editor.setCode(ctx.original);
    ctx.editor.clearErrors();
    store(codeKey(ctx), null);
    markEdited(ctx);
    setStatus(ctx, "Back to the original sketch.");
  });
  if (tool) {
    root.addEventListener("change", (e) => {
      if ((e.target as HTMLElement).matches("[data-sb-board], [data-sb-lib], [data-sb-huge]")) saveToolChoices(ctx);
    });
  }
  setStatus(ctx, saved && saved !== original ? "Your edits from last time are back." : "Ready to build.");
}

function saveToolChoices(ctx: Ctx) {
  store("bench.tool.build", JSON.stringify({ board: ctx.board(), libs: ctx.libs(), huge: ctx.huge() }));
}

function restoreToolChoices(ctx: Ctx) {
  const raw = recall("bench.tool.build");
  if (!raw) return;
  try {
    const c = JSON.parse(raw) as { board?: string; libs?: string[]; huge?: boolean };
    const select = q<HTMLSelectElement>(ctx.root, "[data-sb-board]");
    if (select && c.board && [...select.options].some((o) => o.value === c.board)) select.value = c.board;
    for (const box of ctx.root.querySelectorAll<HTMLInputElement>("[data-sb-lib]")) box.checked = !!c.libs?.includes(box.value);
    const huge = q<HTMLInputElement>(ctx.root, "[data-sb-huge]");
    if (huge) huge.checked = !!c.huge;
  } catch {
    // Old or broken choices: start fresh.
  }
}

async function fetchJson(url: string, init: RequestInit, ms: number): Promise<{ status: number; body: CompileAnswer | null }> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
  let body: CompileAnswer | null = null;
  try {
    body = (await res.json()) as CompileAnswer;
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

async function build(ctx: Ctx) {
  const code = ctx.editor.getCode();
  const problem = checkBeforeBuild(code);
  if (problem) {
    setStatus(ctx, problem, true);
    return;
  }
  const btn = q<HTMLButtonElement>(ctx.root, "[data-sb-build]")!;
  btn.disabled = true;
  ctx.editor.clearErrors();
  ctx.image = null;
  renderResult(ctx, null);

  const started = performance.now();
  let phase = "Building...";
  const tick = () => setStatus(ctx, `${phase} ${Math.round((performance.now() - started) / 1000)} s`);
  tick();
  const timer = window.setInterval(tick, 1000);
  try {
    try {
      const health = await fetchJson(`${ctx.api}/health`, {}, 5000);
      phase = healthMessage(health.body ? (health.body as { state?: string }).state : undefined);
    } catch {
      phase = "Building...";
    }
    tick();
    const { status, body } = await fetchJson(
      `${ctx.api}/compile`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildRequest(ctx.board(), code, ctx.libs(), ctx.huge())) },
      240_000,
    );
    const result = readAnswer(status, body);
    renderResult(ctx, result);
    const secs = Math.round((performance.now() - started) / 1000);
    if (result.kind === "built") setStatus(ctx, `Built in ${secs} s.`);
    else if (result.kind === "errors") setStatus(ctx, `${result.sketch.length + result.other.length} compile ${result.sketch.length + result.other.length === 1 ? "error" : "errors"}.`, true);
    else setStatus(ctx, result.kind === "failure" ? "The build failed." : "Not built.", true);
  } catch (err) {
    const timedOut = (err as Error).name === "TimeoutError";
    renderResult(ctx, {
      kind: "unavailable",
      message: timedOut ? "The compiler took too long to answer. Try again in a minute." : navigator.onLine ? "The compiler could not be reached. Try again in a minute." : "You are offline. Building needs a connection.",
    });
    setStatus(ctx, "Not built.", true);
  } finally {
    window.clearInterval(timer);
    btn.disabled = false;
  }
}

function bar(label: string, used?: number, total?: number): HTMLElement {
  const box = el("div", "sb-bar");
  const pct = percent(used, total);
  const head = el("div", "sb-barhead");
  head.append(el("span", "", label), el("span", "", used && total ? `${kb(used)} of ${kb(total)} (${pct}%)` : "not reported"));
  const track = el("div", "sb-track");
  const fill = el("span", pct > 90 ? "sb-fill warn" : "sb-fill");
  fill.style.width = `${pct}%`;
  track.append(fill);
  box.append(head, track);
  return box;
}

function details(summary: string, body: string): HTMLDetailsElement {
  const d = el("details", "sb-details");
  d.append(el("summary", "", summary), el("pre", "code", body));
  return d;
}

function errorText(e: CompileError | string): string {
  return typeof e === "string" ? e : `${e.file}:${e.line}:${e.col}: ${e.message}`;
}

function renderResult(ctx: Ctx, result: CompileResult | null) {
  const box = q<HTMLElement>(ctx.root, "[data-sb-result]")!;
  box.replaceChildren();
  box.hidden = result === null;
  if (!result) return;

  if (result.kind === "busy" || result.kind === "unavailable" || result.kind === "rejected") {
    box.append(el("p", "notice", result.message));
    return;
  }
  const a = result.answer;
  if (result.kind === "errors") {
    box.append(el("h3", "h3", "Compile errors"));
    if (result.sketch.length) {
      const list = el("ul", "sb-errors");
      for (const e of result.sketch) {
        const li = el("li");
        const b = el("button", "sb-errorlink", `Line ${e.line}:${e.col}`);
        b.type = "button";
        b.addEventListener("click", () => ctx.editor.goTo(e.line, e.col));
        li.append(b, " ", el("span", "", e.message));
        list.append(li);
      }
      box.append(list);
      ctx.editor.showErrors(result.sketch);
      ctx.editor.goTo(result.sketch[0].line, result.sketch[0].col);
    }
    if (result.other.length) {
      box.append(el("p", "cap left", "In a library or the ESP32 core, usually caused by something in the sketch:"));
      const list = el("ul", "sb-errors other");
      for (const e of result.other) list.append(el("li", "", errorText(e)));
      box.append(list);
    }
  } else if (result.kind === "failure") {
    box.append(el("p", "notice", result.message));
  } else {
    ctx.image = result.image;
    ctx.chip = a.chip ?? "";
    const head = el("p", "sb-ok");
    head.textContent = `Built for the ${(a.chip ?? ctx.board()).toUpperCase()} with Arduino-ESP32 core ${a.core ?? "?"} in ${a.seconds?.toFixed(1) ?? "?"} s.`;
    box.append(head, bar("Flash (program)", a.sizes?.flashUsed, a.sizes?.flashTotal), bar("RAM (globals)", a.sizes?.ramUsed, a.sizes?.ramTotal));
    if (result.image) box.append(flashControls(ctx, result.image));
    else box.append(el("p", "notice", "The compiler did not send the firmware image back. Build again to flash it."));
  }
  if (a.warnings?.length) box.append(details(`${a.warnings.length} ${a.warnings.length === 1 ? "warning" : "warnings"}`, a.warnings.map(errorText).join("\n")));
  if (a.log) box.append(details("Build log (end)", a.log));
}

function flashControls(ctx: Ctx, image: Uint8Array): HTMLElement {
  const wrap = el("div", "stack tight sb-flash");
  const row = el("div", "row");
  const flashBtn = el("button", "btn go", "Flash to my board");
  flashBtn.type = "button";
  const download = el("button", "btn", "Download .bin");
  download.type = "button";
  const bench = el("a", "btn", "Open the bench");
  bench.href = ctx.benchHref;
  row.append(flashBtn, download, bench);
  const progress = el("div", "sb-track");
  const fill = el("span", "sb-fill");
  progress.append(fill);
  progress.hidden = true;
  const note = el("p", "cap left", "The image includes the bootloader and partition table, so it is written at offset 0x0.");
  const out = el("p", "sb-flashstatus");
  out.setAttribute("role", "status");
  wrap.append(row, progress, out, note);

  const { supported, secure } = serialSupport();
  if (!supported || !secure) {
    flashBtn.disabled = true;
    out.textContent = !supported ? "This browser cannot flash. Use Chrome or Edge on a desktop, or download the .bin." : "Flashing needs a secure page: open the site over https.";
  }

  download.addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([image as BlobPart], { type: "application/octet-stream" }));
    const a = el("a");
    a.href = url;
    a.download = `${ctx.project || "sketch"}-${ctx.board()}.bin`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  });

  flashBtn.addEventListener("click", async () => {
    const serial = (navigator as Navigator & { serial?: { requestPort(): Promise<unknown> } }).serial;
    if (!serial) return;
    let port: unknown;
    try {
      port = await serial.requestPort();
    } catch {
      return; // The picker was closed.
    }
    flashBtn.disabled = true;
    progress.hidden = false;
    fill.style.width = "0%";
    out.textContent = "Connecting to the board...";
    const terminal = { clean: () => undefined, writeLine: () => undefined, write: () => undefined };
    try {
      await flashMergedImage(port as Parameters<typeof flashMergedImage>[0], image, {
        terminal,
        expectChip: ctx.chip || undefined,
        onProgress: (pct) => {
          fill.style.width = `${pct}%`;
          out.textContent = `Writing: ${pct}%`;
        },
      });
      fill.style.width = "100%";
      out.replaceChildren("Flashed and reset. ");
      if (ctx.hasSettings) {
        const go = el("button", "sb-errorlink", "Send its settings");
        go.type = "button";
        go.addEventListener("click", () => document.querySelector("[data-settings-form]")?.scrollIntoView({ behavior: "smooth", block: "start" }));
        out.append("This project needs settings such as Wi-Fi: ", go, ", then ");
      }
      const b = el("a", "", "watch it on the bench");
      b.href = ctx.benchHref;
      out.append(b, ".");
    } catch (err) {
      out.textContent = `Flashing failed: ${(err as Error).message ?? err}`;
    } finally {
      flashBtn.disabled = false;
    }
  });
  return wrap;
}
