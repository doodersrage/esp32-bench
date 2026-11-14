// Flash-your-own-firmware page: pick .bin files, connect with esptool-js over
// Web Serial, write them at their offsets, reset. esptool-js loads only when
// the user connects, so the page itself stays light.
import type { ESPLoader, Transport } from "esptool-js";
import { closeSession, openSession, writeAndReset, type FlashSession } from "../lib/esp-flash";
import { bootloaderOffset, checkPlan, guessRole, hex, parseOffset, type PlanFile, type Role } from "../lib/flash-plan";
import { pageLocale, translator } from "../i18n/t";
import { FLASH_PLAN_PATTERNS, TOOLS_UI, byPattern } from "../i18n/strings/tools";

const t = translator(TOOLS_UI, pageLocale());
const ROLE_KEY = {
  merged: "roleMerged",
  bootloader: "roleBootloader",
  partitions: "rolePartitions",
  boot_app0: "roleBootApp0",
  app: "roleApp",
  other: "roleOther",
} as const satisfies Record<Role, keyof typeof TOOLS_UI.en>;

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const picker = $<HTMLInputElement>("#fl-files");
const tbody = $<HTMLTableSectionElement>("#fl-rows");
const empty = $<HTMLParagraphElement>("#fl-empty");
const problemsList = $<HTMLUListElement>("#fl-problems");
const baud = $<HTMLSelectElement>("#fl-baud");
const eraseFirst = $<HTMLInputElement>("#fl-erase");
const connectBtn = $<HTMLButtonElement>("#fl-connect");
const flashBtn = $<HTMLButtonElement>("#fl-flash");
const eraseBtn = $<HTMLButtonElement>("#fl-erase-only");
const disconnectBtn = $<HTMLButtonElement>("#fl-disconnect");
const chipBox = $<HTMLElement>("#fl-chip");
const progress = $<HTMLDivElement>("#fl-progress");
const progbar = $<HTMLSpanElement>("#fl-progbar");
const progtext = $<HTMLSpanElement>("#fl-progtext");
const logBox = $<HTMLPreElement>("#fl-log");

interface Entry extends PlanFile {
  data: Uint8Array;
}
let files: Entry[] = [];
let session: FlashSession | null = null;
let loader: ESPLoader | null = null;
let chipName = "";
let bootOffset: number | null = null;
let flashBytes: number | undefined;
let busy = false;

// Web Serial is not in TypeScript's DOM types; describe the one call this page makes.
type SerialPortArg = ConstructorParameters<typeof Transport>[0];
const serialApi = (navigator as Navigator & { serial?: { requestPort(): Promise<SerialPortArg> } }).serial;
const supported = serialApi !== undefined;
if (!supported) $<HTMLElement>("#fl-unsupported").hidden = false;
else if (!window.isSecureContext) $<HTMLElement>("#fl-insecure").hidden = false;

function log(line: string) {
  logBox.textContent += `${line}\n`;
  logBox.scrollTop = logBox.scrollHeight;
}

const terminal = {
  clean: () => {
    logBox.textContent = "";
  },
  writeLine: (data: string) => log(data),
  write: (data: string) => {
    logBox.textContent += data;
    logBox.scrollTop = logBox.scrollHeight;
  },
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}): HTMLElementTagNameMap[K] {
  return Object.assign(document.createElement(tag), props);
}

function resolvedOffset(f: PlanFile): number | null {
  if (f.offset !== "auto") return f.offset;
  return bootOffset ?? (chipName ? bootloaderOffset(chipName) : null);
}

function render() {
  tbody.replaceChildren();
  files.forEach((f, i) => {
    const tr = el("tr");
    tr.append(el("td", { className: "name", textContent: f.name }));

    const roleTd = el("td");
    const role = el("select", { ariaLabel: t("flWhatIs", { file: f.name }) });
    for (const r of Object.keys(ROLE_KEY) as Role[]) role.append(el("option", { value: r, textContent: t(ROLE_KEY[r]), selected: r === f.role }));
    role.addEventListener("change", () => {
      f.role = role.value as Role;
      f.offset = f.role === "bootloader" ? "auto" : f.role === "merged" ? 0 : f.role === "partitions" ? 0x8000 : f.role === "boot_app0" ? 0xe000 : f.role === "app" ? 0x10000 : f.offset;
      render();
    });
    roleTd.append(role);
    tr.append(roleTd);

    tr.append(el("td", { className: "m", textContent: `${(f.size / 1024).toFixed(1)} KB` }));

    const offTd = el("td");
    const off = el("input", {
      value: f.offset === "auto" ? "auto" : hex(f.offset),
      ariaLabel: t("flOffsetFor", { file: f.name }),
      title: f.offset === "auto" ? t("flAutoTitle") : "",
    });
    off.addEventListener("change", () => {
      const v = parseOffset(off.value);
      if (v === null) {
        off.value = f.offset === "auto" ? "auto" : hex(f.offset);
        return;
      }
      f.offset = v;
      render();
    });
    offTd.append(off);
    const resolved = resolvedOffset(f);
    if (f.offset === "auto" && resolved !== null) offTd.append(el("span", { className: "cap left", textContent: ` = ${hex(resolved)}` }));
    tr.append(offTd);

    const rm = el("button", { type: "button", className: "btn sm", textContent: "✕", ariaLabel: t("remove", { name: f.name }) });
    rm.addEventListener("click", () => {
      files.splice(i, 1);
      render();
    });
    const rmTd = el("td");
    rmTd.append(rm);
    tr.append(rmTd);
    tbody.append(tr);
  });
  empty.hidden = files.length > 0;

  const problems = files.length ? checkPlan(files, chipName || undefined, flashBytes) : [];
  problemsList.replaceChildren(
    ...problems.map((p) => {
      const li = el("li", { className: "finding" });
      li.append(el("span", { className: p.level === "error" ? "tag bad" : "tag warnt", textContent: p.level === "error" ? t("tagError") : t("tagCheck") }), el("span", { textContent: byPattern(p.text, FLASH_PLAN_PATTERNS, t) }));
      return li;
    }),
  );
  const blocked = problems.some((p) => p.level === "error");
  flashBtn.disabled = busy || !loader || files.length === 0 || blocked;
  eraseBtn.disabled = busy || !loader;
  connectBtn.disabled = busy || !!loader || !supported;
  disconnectBtn.disabled = busy || !loader;
}

picker.addEventListener("change", async () => {
  for (const file of Array.from(picker.files ?? [])) {
    const data = new Uint8Array(await file.arrayBuffer());
    const guess = guessRole(file.name);
    files.push({ name: file.name, size: data.length, data, ...guess });
  }
  picker.value = "";
  // Keep them in flash order for reading.
  files.sort((a, b) => (resolvedOffset(a) ?? 0) - (resolvedOffset(b) ?? 0));
  render();
});

function showChip(info: [string, string][]) {
  chipBox.replaceChildren();
  for (const [k, v] of info) chipBox.append(el("dt", { textContent: k }), el("dd", { textContent: v }));
  chipBox.hidden = false;
}

async function connect() {
  busy = true;
  render();
  try {
    const port = await serialApi!.requestPort();
    log(t("flLoading"));
    session = await openSession(port, Number(baud.value), terminal);
    loader = session.loader;
    const description = session.description;
    chipName = session.chipName;
    bootOffset = session.bootOffset;
    const [features, crystal, mac, size] = await Promise.all([
      loader.chip.getChipFeatures(loader).catch(() => [] as string[]),
      loader.chip.getCrystalFreq(loader).catch(() => 0),
      loader.chip.readMac(loader).catch(() => ""),
      loader.detectFlashSize().catch(() => ""),
    ]);
    const mb = /^(\d+)MB$/.exec(size ?? "");
    flashBytes = mb ? Number(mb[1]) * 1024 * 1024 : undefined;
    showChip([
      [t("chipChip"), description],
      [t("chipFeatures"), features.join(", ") || t("notReported")],
      [t("chipCrystal"), crystal ? `${crystal} MHz` : t("notReported")],
      [t("chipMac"), mac || t("notReported")],
      [t("chipFlash"), size || t("notDetected")],
      [t("chipBootloader"), hex(bootOffset)],
    ]);
    log(t("flConnected", { chip: description }));
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    if ((err as Error).name !== "NotFoundError") log(t("flCouldNot", { msg }));
    await cleanup();
  } finally {
    busy = false;
    render();
  }
}

async function cleanup() {
  await closeSession(session);
  session = null;
  loader = null;
}

async function flash() {
  if (!session) return;
  if (eraseFirst.checked && !confirmErase()) return;
  busy = true;
  render();
  const fileArray = files.map((f) => ({ data: f.data, address: resolvedOffset(f) ?? 0 }));
  progress.hidden = false;
  try {
    await writeAndReset(session, fileArray, {
      eraseAll: eraseFirst.checked,
      onProgress: (pct, index) => {
        progbar.style.width = `${pct}%`;
        progtext.textContent = t("flWriting", { pct, file: files[index].name, offset: hex(fileArray[index].address) });
      },
    });
    log(t("flDoneLog"));
    progtext.textContent = t("flDone");
    await cleanup();
  } catch (err) {
    log(t("flFailedLog", { msg: String((err as Error).message ?? err) }));
    progtext.textContent = t("flFailed");
  } finally {
    busy = false;
    render();
  }
}

function confirmErase(): boolean {
  return window.confirm(t("flConfirm"));
}

async function eraseOnly() {
  if (!loader || !confirmErase()) return;
  busy = true;
  render();
  try {
    log(t("flErasing"));
    await loader.eraseFlash();
    log(t("flErased"));
  } catch (err) {
    log(t("flEraseFailed", { msg: String((err as Error).message ?? err) }));
  } finally {
    busy = false;
    render();
  }
}

connectBtn.addEventListener("click", () => void connect());
flashBtn.addEventListener("click", () => void flash());
eraseBtn.addEventListener("click", () => void eraseOnly());
disconnectBtn.addEventListener("click", async () => {
  await cleanup();
  chipBox.hidden = true;
  chipName = "";
  bootOffset = null;
  flashBytes = undefined;
  log(t("flDisconnected"));
  render();
});
render();
