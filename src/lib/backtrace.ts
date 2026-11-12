// Turn the code addresses in an ESP32 crash log into function names and source
// lines, using the firmware's ELF file. Pure functions; the page and the tests share them.
import { backtraceAddresses } from "./crash";
import { demangle } from "./demangle";
import { readFunctionNames } from "./dwarf-info";
import { lookupLine, readLineTable, type LineTable } from "./dwarf-line";
import { isCode, parseElf, symbolFor, type Elf } from "./elf";

export type FrameSource = "pc" | "backtrace" | "mepc" | "ra" | "stack" | "address";

export interface FoundAddress {
  address: number;
  source: FrameSource;
}

export type Origin = "sketch" | "library" | "core" | "unknown";

export interface Frame extends FoundAddress {
  function?: string;
  /** Raw symbol name, before demangling */
  symbol?: string;
  /** Other names for the same function */
  aliases?: string[];
  /** Byte offset into the function */
  offset?: number;
  file?: string;
  line?: number;
  origin: Origin;
  inCode: boolean;
}

export interface Firmware {
  elf: Elf;
  lines: LineTable;
  /** Function start address to the name in the debug info */
  names: Map<number, string>;
}

export function loadFirmware(bytes: ArrayBuffer | Uint8Array): Firmware {
  const elf = parseElf(bytes);
  return { elf, lines: readLineTable(elf), names: readFunctionNames(elf) };
}

const hex = (s: string) => parseInt(s, 16);

/**
 * Find code addresses in a crash log, in the order a reader would want them:
 * the faulting PC, then the backtrace (Xtensa) or MEPC and RA (RISC-V), then
 * words from a RISC-V stack dump that point into code, then any other address.
 * `isCodeAddr` filters the loose matches; without it, every 0x4xxxxxxx-like
 * value counts.
 */
export function findAddresses(log: string, isCodeAddr: (a: number) => boolean = () => true): FoundAddress[] {
  const found: FoundAddress[] = [];
  const seen = new Set<string>();
  const add = (address: number, source: FrameSource) => {
    const key = `${source === "stack" || source === "address" ? "loose" : source}:${address}`;
    if (seen.has(key) || address === 0) return;
    // A stack word or loose address that already appears as a real frame adds nothing.
    if ((source === "stack" || source === "address") && found.some((f) => f.address === address)) return;
    seen.add(key);
    found.push({ address, source });
  };

  const lines = log.split(/\r?\n/);
  let inStack = false;
  const stackWords: number[] = [];
  for (const line of lines) {
    const pc = /\bPC\s*:\s*0x([0-9a-fA-F]{8})/.exec(line);
    if (pc) add(hex(pc[1]), "pc");
    const mepc = /\bMEPC\s*:\s*0x([0-9a-fA-F]{8})/.exec(line);
    if (mepc) add(hex(mepc[1]), "mepc");
    const ra = /\bRA\s*:\s*0x([0-9a-fA-F]{8})/.exec(line);
    if (ra) add(hex(ra[1]), "ra");
    for (const a of backtraceAddresses(line)) add(hex(a), "backtrace");
    if (/^\s*Stack memory:/i.test(line)) {
      inStack = true;
      continue;
    }
    if (inStack) {
      const m = /^\s*[0-9a-fA-F]{8}:\s*((?:0x[0-9a-fA-F]{8}\s*)+)$/.exec(line);
      if (m) {
        for (const w of m[1].trim().split(/\s+/)) stackWords.push(hex(w));
        continue;
      }
      if (line.trim() !== "") inStack = false;
    }
  }
  for (const w of stackWords) if (isCodeAddr(w)) add(w, "stack");

  if (found.length === 0) {
    // A bare list of addresses, e.g. copied from somewhere else.
    for (const m of log.matchAll(/0x([0-9a-fA-F]{8})\b/g)) {
      const a = hex(m[1]);
      if (isCodeAddr(a)) add(a, "address");
    }
  }
  return found;
}

/** Where a source file comes from: the user's sketch, a library, or the core and ESP-IDF. */
export function originOf(file: string | undefined): Origin {
  if (!file) return "unknown";
  const f = file.replace(/\\/g, "/");
  if (/(^|\/)(esp-idf|esp32-arduino-libs|framework-arduinoespressif32[^/]*\/cores|cores\/esp32|components|newlib|toolchain|xtensa-esp|riscv32-esp|gcc|libgcc|libstdc\+\+|freertos|FreeRTOS)\//i.test(f) || /^\/(builds|home\/runner|Users\/runner)\/.*\/(esp-idf|idf)/.test(f)) {
    return "core";
  }
  if (/\/(libraries|\.pio\/libdeps|lib)\//.test(f) || /framework-arduinoespressif32[^/]*\/libraries\//.test(f)) return "library";
  if (/\.(ino|ino\.cpp)$/.test(f) || /(^|\/)src\//.test(f) || /(^|\/)sketch\//.test(f)) return "sketch";
  return "unknown";
}

/** Demangle C++ names; show GCC clone suffixes on C names the way c++filt does for C++. */
export function prettyName(symbol: string): string {
  if (symbol.startsWith("_Z")) return demangle(symbol);
  // GCC writes clone suffixes with dots, or with dollar signs on Xtensa.
  const plain = symbol.replace(/\$/g, ".");
  const dot = plain.indexOf(".");
  if (dot <= 0) return symbol;
  const clones = plain.slice(dot).match(/\.[A-Za-z_]+(?:\.\d+)*/g) ?? [];
  return plain.slice(0, dot) + clones.map((c) => ` [clone ${c}]`).join("");
}

function aliasesOf(fw: Firmware, value: number, name: string): string[] {
  return fw.elf.functions.filter((f) => f.value === value && f.name !== name).map((f) => prettyName(f.name));
}

export function decodeAddress(fw: Firmware, found: FoundAddress): Frame {
  let sym = symbolFor(fw.elf, found.address);
  // Where several symbols share the address, use the one the debug info names.
  const recorded = sym ? fw.names.get(sym.symbol.value) : undefined;
  if (sym && recorded && recorded !== sym.symbol.name) {
    const match = fw.elf.functions.find((f) => f.value === sym!.symbol.value && f.name === recorded);
    if (match) sym = { symbol: match, offset: sym.offset };
  }
  const row = lookupLine(fw.lines, found.address);
  return {
    ...found,
    symbol: sym?.symbol.name,
    function: sym ? prettyName(sym.symbol.name) : undefined,
    aliases: sym ? aliasesOf(fw, sym.symbol.value, sym.symbol.name) : undefined,
    offset: sym?.offset,
    file: row?.file,
    line: row?.line,
    origin: originOf(row?.file),
    inCode: isCode(fw.elf, found.address),
  };
}

export function decodeLog(fw: Firmware, log: string): Frame[] {
  return findAddresses(log, (a) => isCode(fw.elf, a)).map((f) => decodeAddress(fw, f));
}
export { demangle as demangleForTest } from "./demangle";
