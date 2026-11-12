// Backtrace decoder page: read the .elf in the browser, find addresses in the
// pasted log and show each as function and source line.
import { decodeLog, loadFirmware, type Firmware, type Frame } from "../lib/backtrace";
import { explainLog } from "../lib/crash";
import { errorSlugForKey } from "../data/errors";
import { link } from "../lib/paths";

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const fileInput = $<HTMLInputElement>("#bt-elf");
const drop = $<HTMLLabelElement>("#bt-drop");
const elfStatus = $<HTMLSpanElement>("#bt-elf-status");
const logBox = $<HTMLTextAreaElement>("#bt-log");
const go = $<HTMLButtonElement>("#bt-go");
const clear = $<HTMLButtonElement>("#bt-clear");
const status = $<HTMLSpanElement>("#bt-status");
const result = $<HTMLDivElement>("#bt-result");
const rows = $<HTMLTableSectionElement>("#bt-rows");
const hints = $<HTMLUListElement>("#bt-hints");

let firmware: Firmware | null = null;
let firmwareName = "";

const SOURCE_LABEL: Record<Frame["source"], string> = {
  pc: "PC",
  backtrace: "Backtrace",
  mepc: "MEPC",
  ra: "RA",
  stack: "Stack",
  address: "Address",
};
const ORIGIN_LABEL: Record<Frame["origin"], string> = { sketch: "Your sketch", library: "Library", core: "Core", unknown: "" };

const hex = (n: number) => `0x${n.toString(16).padStart(8, "0")}`;

function shortPath(file: string): string {
  const f = file.replace(/\\/g, "/");
  const markers = ["/libraries/", "/cores/", "/components/", "/src/", "/libdeps/", "/newlib/", "/libgcc/"];
  for (const m of markers) {
    const at = f.lastIndexOf(m);
    if (at >= 0) return f.slice(at + 1);
  }
  const parts = f.split("/");
  return parts.slice(-2).join("/");
}

async function loadFile(file: File) {
  elfStatus.textContent = `Reading ${file.name}...`;
  drop.classList.remove("loaded");
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const started = performance.now();
    firmware = loadFirmware(bytes);
    firmwareName = file.name;
    const ms = Math.round(performance.now() - started);
    const arch = firmware.elf.arch === "xtensa" ? "Xtensa (ESP32, S2 or S3)" : firmware.elf.arch === "riscv" ? "RISC-V (C3, C6 or H2)" : "an unknown CPU";
    const lineNote = firmware.lines.sequences.length === 0 ? "no line information, so function names only" : `line information for ${firmware.lines.units} source files`;
    elfStatus.textContent = `${file.name}: ${arch}, ${firmware.elf.functions.length.toLocaleString("en")} functions, ${lineNote}. Read in ${ms} ms.`;
    drop.classList.add("loaded");
    if (logBox.value.trim()) decode();
  } catch (err) {
    firmware = null;
    elfStatus.textContent = (err as Error).message || "Could not read that file.";
  }
}

fileInput.addEventListener("change", () => {
  const f = fileInput.files?.[0];
  if (f) void loadFile(f);
});
drop.addEventListener("dragover", (e) => {
  e.preventDefault();
  drop.classList.add("over");
});
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", (e) => {
  e.preventDefault();
  drop.classList.remove("over");
  const f = e.dataTransfer?.files[0];
  if (f) void loadFile(f);
});

function cell(row: HTMLTableRowElement, text: string, cls?: string, title?: string): HTMLTableCellElement {
  const td = row.insertCell();
  td.textContent = text;
  if (cls) td.className = cls;
  if (title) td.title = title;
  return td;
}

function showHints(log: string) {
  hints.replaceChildren();
  for (const h of explainLog(log)) {
    if (h.key === "backtrace") continue;
    const li = document.createElement("li");
    li.textContent = h.text + " ";
    const slug = errorSlugForKey(h.key);
    if (slug) {
      const a = document.createElement("a");
      a.href = link(`/errors/${slug}/`);
      a.textContent = "More about this error";
      li.append(a);
    }
    hints.append(li);
  }
  hints.hidden = hints.children.length === 0;
}

function decode() {
  const log = logBox.value;
  if (!firmware) {
    status.textContent = "Choose the .elf file first.";
    return;
  }
  if (!log.trim()) {
    status.textContent = "Paste the crash output first.";
    return;
  }
  const frames = decodeLog(firmware, log);
  rows.replaceChildren();
  showHints(log);
  if (frames.length === 0) {
    result.hidden = true;
    status.textContent = "No code addresses from this firmware found in the log. Check the log has a Backtrace or MEPC line.";
    return;
  }
  let unknown = 0;
  frames.forEach((f, i) => {
    const row = rows.insertRow();
    if (f.origin === "sketch") row.className = "sketch";
    cell(row, String(i + 1), "q");
    cell(row, SOURCE_LABEL[f.source], "m");
    cell(row, hex(f.address), "m");
    const fn = cell(row, f.function ?? "??", "fn", f.aliases?.length ? `Also known as ${f.aliases.join(", ")}` : undefined);
    if (f.function && f.offset !== undefined) {
      const off = document.createElement("span");
      off.className = "dim";
      off.textContent = ` +${f.offset}`;
      fn.append(off);
    }
    if (f.file) {
      const src = cell(row, `${shortPath(f.file)}:${f.line}`, "src", f.file);
      const tag = ORIGIN_LABEL[f.origin];
      if (tag) {
        const t = document.createElement("span");
        t.className = f.origin === "sketch" ? "tag sk" : "tag";
        t.textContent = tag;
        src.append(" ", t);
      }
    } else cell(row, f.function ? "no line information" : "not in this firmware", "src dim");
    if (!f.function) unknown++;
  });
  result.hidden = false;
  const archMismatch =
    firmware.elf.arch === "xtensa" && frames.some((f) => f.source === "mepc")
      ? " The log is from a RISC-V chip but the .elf is Xtensa: pick the .elf for the right board."
      : firmware.elf.arch === "riscv" && frames.some((f) => f.source === "backtrace")
        ? " The log has an Xtensa backtrace but the .elf is RISC-V: pick the .elf for the right board."
        : "";
  status.textContent =
    `${frames.length} address${frames.length === 1 ? "" : "es"} decoded with ${firmwareName}.` +
    (unknown ? ` ${unknown} not found in it: the .elf may be from a different build.` : "") +
    archMismatch;
}

go.addEventListener("click", decode);
logBox.addEventListener("paste", () => setTimeout(() => firmware && decode(), 0));
clear.addEventListener("click", () => {
  logBox.value = "";
  rows.replaceChildren();
  hints.replaceChildren();
  result.hidden = true;
  status.textContent = "";
});
