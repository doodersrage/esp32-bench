// Backtrace decoder page: read the .elf in the browser, find addresses in the
// pasted log and show each as function and source line.
import { decodeLog, loadFirmware, type Firmware, type Frame } from "../lib/backtrace";
import { explainLog } from "../lib/crash";
import { errorSlugForKey } from "../data/errors";
import { link } from "../lib/paths";
import { elfShaIn, fetchLibraryElf, findLibraryElf } from "../lib/library-elf";

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
/** Hash of the library ELF in `firmware`, when it came from the firmware library rather than a dropped file */
let librarySha = "";
const fwBase = logBox.dataset.fw ?? "";

/**
 * Library firmware prints its ELF's hash when it crashes. If this log has one
 * the firmware library knows, load that ELF, so no .elf file is needed.
 */
async function loadLibraryElf(log: string): Promise<"loaded" | "unknown" | "none"> {
  const printed = elfShaIn(log);
  if (!printed || !fwBase) return "none";
  if (firmware && librarySha.startsWith(printed.slice(0, 32))) return "loaded";
  const found = await findLibraryElf(fwBase, printed);
  if (!found) return "unknown";
  elfStatus.textContent = `This crash is from ESP32 Bench firmware: ${found.project} on ${found.board}. Downloading its .elf...`;
  try {
    firmware = loadFirmware(await fetchLibraryElf(fwBase, found.sha));
    librarySha = found.sha;
    firmwareName = `the library's ${found.project} firmware for the ${found.board}`;
    elfStatus.textContent = `Using the firmware library's .elf for ${found.project} on ${found.board}, built ${found.builtAt.slice(0, 10)} with core ${found.core}. Choose a file to use your own instead.`;
    drop.classList.add("loaded");
    return "loaded";
  } catch (err) {
    elfStatus.textContent = (err as Error).message;
    return "unknown";
  }
}

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
    librarySha = "";
    const ms = Math.round(performance.now() - started);
    const arch = firmware.elf.arch === "xtensa" ? "Xtensa (ESP32, S2 or S3)" : firmware.elf.arch === "riscv" ? "RISC-V (C3, C6 or H2)" : "an unknown CPU";
    const lineNote = firmware.lines.sequences.length === 0 ? "no line information, so function names only" : `line information for ${firmware.lines.units} source files`;
    elfStatus.textContent = `${file.name}: ${arch}, ${firmware.elf.functions.length.toLocaleString("en")} functions, ${lineNote}. Read in ${ms} ms.`;
    drop.classList.add("loaded");
    if (logBox.value.trim()) void decode();
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

async function decode() {
  const log = logBox.value;
  // A dropped .elf wins; otherwise a library crash brings its own.
  if (!firmware || librarySha) {
    const library = await loadLibraryElf(log);
    if (library === "unknown" && !firmware) {
      status.textContent =
        "This crash names its firmware's .elf, but it is not an ESP32 Bench library build from the last 90 days. Choose the .elf from the build that crashed.";
      return;
    }
  }
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

go.addEventListener("click", () => void decode());
logBox.addEventListener("paste", () => setTimeout(() => (firmware || elfShaIn(logBox.value)) && void decode(), 0));

// A crash handed over from the bench or an error page ("Decode it").
try {
  const handed = sessionStorage.getItem("bench.btlog");
  if (handed) {
    sessionStorage.removeItem("bench.btlog");
    logBox.value = handed;
    void decode();
  }
} catch {
  // No session storage: paste by hand.
}
clear.addEventListener("click", () => {
  logBox.value = "";
  rows.replaceChildren();
  hints.replaceChildren();
  result.hidden = true;
  status.textContent = "";
});
