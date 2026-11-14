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
import { FIRMWARE, fromLib, withNodes } from "../../i18n/strings/firmware";
import { pageLocale, translator } from "../../i18n/t";
import { HTML_LANG } from "../../i18n/locales";

const t = translator(FIRMWARE, pageLocale());

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
    tool ? t("editorTool") : t("editorProject"),
  );
  markEdited(ctx);

  q<HTMLButtonElement>(root, "[data-sb-build]")?.addEventListener("click", () => void build(ctx));
  q<HTMLButtonElement>(root, "[data-sb-reset]")?.addEventListener("click", () => {
    if (!window.confirm(t("confirmReset"))) return;
    ctx.editor.setCode(ctx.original);
    ctx.editor.clearErrors();
    store(codeKey(ctx), null);
    markEdited(ctx);
    setStatus(ctx, t("backToOriginal"));
  });
  if (tool) {
    root.addEventListener("change", (e) => {
      if ((e.target as HTMLElement).matches("[data-sb-board], [data-sb-lib], [data-sb-huge]")) saveToolChoices(ctx);
    });
  }
  setStatus(ctx, saved && saved !== original ? t("editsBack") : t("ready"));
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
    setStatus(ctx, fromLib(t, problem), true);
    return;
  }
  const btn = q<HTMLButtonElement>(ctx.root, "[data-sb-build]")!;
  btn.disabled = true;
  ctx.editor.clearErrors();
  ctx.image = null;
  renderResult(ctx, null);

  const started = performance.now();
  let phase = t("libBuilding");
  const tick = () => setStatus(ctx, t("tick", { phase, s: Math.round((performance.now() - started) / 1000) }));
  tick();
  const timer = window.setInterval(tick, 1000);
  try {
    try {
      const health = await fetchJson(`${ctx.api}/health`, {}, 5000);
      phase = fromLib(t, healthMessage(health.body ? (health.body as { state?: string }).state : undefined));
    } catch {
      phase = t("libBuilding");
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
    const count = result.kind === "errors" ? result.sketch.length + result.other.length : 0;
    if (result.kind === "built") setStatus(ctx, t("builtIn", { s: secs }));
    else if (result.kind === "errors") setStatus(ctx, count === 1 ? t("oneError") : t("manyErrors", { n: count }), true);
    else setStatus(ctx, result.kind === "failure" ? t("buildFailed") : t("notBuilt"), true);
  } catch (err) {
    const timedOut = (err as Error).name === "TimeoutError";
    renderResult(ctx, {
      kind: "unavailable",
      message: timedOut ? t("tooLong") : navigator.onLine ? t("unreachable") : t("offlineBuild"),
    });
    setStatus(ctx, t("notBuilt"), true);
  } finally {
    window.clearInterval(timer);
    btn.disabled = false;
  }
}

function bar(label: string, used?: number, total?: number): HTMLElement {
  const box = el("div", "sb-bar");
  const pct = percent(used, total);
  const head = el("div", "sb-barhead");
  head.append(el("span", "", label), el("span", "", used && total ? t("usage", { used: kb(used), total: kb(total), pct }) : t("notReported")));
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
    box.append(el("p", "notice", fromLib(t, result.message)));
    return;
  }
  const a = result.answer;
  if (result.kind === "errors") {
    box.append(el("h3", "h3", t("compileErrors")));
    if (result.sketch.length) {
      const list = el("ul", "sb-errors");
      for (const e of result.sketch) {
        const li = el("li");
        const b = el("button", "sb-errorlink", t("lineCol", { line: e.line, col: e.col }));
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
      box.append(el("p", "cap left", t("otherErrors")));
      const list = el("ul", "sb-errors other");
      for (const e of result.other) list.append(el("li", "", errorText(e)));
      box.append(list);
    }
  } else if (result.kind === "failure") {
    box.append(el("p", "notice", fromLib(t, result.message)));
  } else {
    ctx.image = result.image;
    ctx.chip = a.chip ?? "";
    const head = el("p", "sb-ok");
    head.textContent = t("builtFor", {
      chip: (a.chip ?? ctx.board()).toUpperCase(),
      core: a.core ?? "?",
      s: a.seconds?.toLocaleString(HTML_LANG[pageLocale()], { minimumFractionDigits: 1, maximumFractionDigits: 1 }) ?? "?",
    });
    box.append(head, bar(t("flashBar"), a.sizes?.flashUsed, a.sizes?.flashTotal), bar(t("ramBar"), a.sizes?.ramUsed, a.sizes?.ramTotal));
    if (result.image) box.append(flashControls(ctx, result.image));
    else box.append(el("p", "notice", t("noImage")));
  }
  if (a.warnings?.length) box.append(details(a.warnings.length === 1 ? t("oneWarning") : t("manyWarnings", { n: a.warnings.length }), a.warnings.map(errorText).join("\n")));
  if (a.log) box.append(details(t("buildLog"), a.log));
}

function flashControls(ctx: Ctx, image: Uint8Array): HTMLElement {
  const wrap = el("div", "stack tight sb-flash");
  const row = el("div", "row");
  const flashBtn = el("button", "btn go", t("flashMy"));
  flashBtn.type = "button";
  const download = el("button", "btn", t("download"));
  download.type = "button";
  const bench = el("a", "btn", t("openBench"));
  bench.href = ctx.benchHref;
  row.append(flashBtn, download, bench);
  const progress = el("div", "sb-track");
  const fill = el("span", "sb-fill");
  progress.append(fill);
  progress.hidden = true;
  const note = el("p", "cap left", t("offsetNote"));
  const out = el("p", "sb-flashstatus");
  out.setAttribute("role", "status");
  wrap.append(row, progress, out, note);

  const { supported, secure } = serialSupport();
  if (!supported || !secure) {
    flashBtn.disabled = true;
    out.textContent = !supported ? t("cannotFlashBin") : t("flashSecure");
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
    out.textContent = t("connecting");
    const terminal = { clean: () => undefined, writeLine: () => undefined, write: () => undefined };
    try {
      await flashMergedImage(port as Parameters<typeof flashMergedImage>[0], image, {
        terminal,
        expectChip: ctx.chip || undefined,
        onProgress: (pct) => {
          fill.style.width = `${pct}%`;
          out.textContent = t("writing", { pct });
        },
      });
      fill.style.width = "100%";
      const b = el("a", "", t("watchBench"));
      b.href = ctx.benchHref;
      if (ctx.hasSettings) {
        const go = el("button", "sb-errorlink", t("sendItsSettings"));
        go.type = "button";
        go.addEventListener("click", () => document.querySelector("[data-settings-form]")?.scrollIntoView({ behavior: "smooth", block: "start" }));
        out.replaceChildren(...withNodes(t("flashedSettings"), { go, bench: b }));
      } else {
        out.replaceChildren(...withNodes(t("flashedDone"), { bench: b }));
      }
    } catch (err) {
      out.textContent = t("flashFailed", { error: fromLib(t, String((err as Error).message ?? err)) });
    } finally {
      flashBtn.disabled = false;
    }
  });
  return wrap;
}
