// Minimal ELF32 little-endian reader for ESP32 firmware images (Xtensa and RISC-V).
// Reads section headers and the symbol table. Pure functions, no DOM, so it runs
// in the browser and in Node tests alike.

export type Arch = "xtensa" | "riscv" | "other";

export interface Section {
  name: string;
  type: number;
  flags: number;
  addr: number;
  offset: number;
  size: number;
}

export interface ElfSymbol {
  name: string;
  value: number;
  size: number;
  /** STT_* type: 2 is a function */
  type: number;
  /** STB_* binding: 0 local, 1 global, 2 weak */
  bind: number;
  /** Position in the symbol table */
  index: number;
}

export interface Elf {
  arch: Arch;
  machine: number;
  sections: Section[];
  /** Function symbols sorted by address */
  functions: ElfSymbol[];
  /** Address ranges of sections that hold code */
  code: [number, number][];
  bytes: Uint8Array;
}

const SHF_EXECINSTR = 0x4;
const SHT_SYMTAB = 2;
const STT_FUNC = 2;

export class ElfError extends Error {}

function cstr(bytes: Uint8Array, at: number): string {
  let end = at;
  while (end < bytes.length && bytes[end] !== 0) end++;
  return new TextDecoder().decode(bytes.subarray(at, end));
}

export function parseElf(input: ArrayBuffer | Uint8Array): Elf {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < 52 || bytes[0] !== 0x7f || bytes[1] !== 0x45 || bytes[2] !== 0x4c || bytes[3] !== 0x46) {
    throw new ElfError("This is not an ELF file. Pick the firmware .elf from the build folder, not the .bin.");
  }
  if (bytes[4] !== 1) throw new ElfError("Only 32-bit ELF files are supported, which covers every ESP32 chip.");
  if (bytes[5] !== 1) throw new ElfError("Only little-endian ELF files are supported.");
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const machine = dv.getUint16(18, true);
  const arch: Arch = machine === 94 ? "xtensa" : machine === 243 ? "riscv" : "other";
  const shoff = dv.getUint32(32, true);
  const shentsize = dv.getUint16(46, true);
  const shnum = dv.getUint16(48, true);
  const shstrndx = dv.getUint16(50, true);
  if (shoff === 0 || shoff + shnum * shentsize > bytes.length) throw new ElfError("The ELF file has no section headers.");

  const raw: { nameOff: number; type: number; flags: number; addr: number; offset: number; size: number; link: number; entsize: number }[] = [];
  for (let i = 0; i < shnum; i++) {
    const o = shoff + i * shentsize;
    raw.push({
      nameOff: dv.getUint32(o, true),
      type: dv.getUint32(o + 4, true),
      flags: dv.getUint32(o + 8, true),
      addr: dv.getUint32(o + 12, true),
      offset: dv.getUint32(o + 16, true),
      size: dv.getUint32(o + 20, true),
      link: dv.getUint32(o + 24, true),
      entsize: dv.getUint32(o + 36, true),
    });
  }
  const names = raw[shstrndx];
  const sections: Section[] = raw.map((s) => ({
    name: names ? cstr(bytes, names.offset + s.nameOff) : "",
    type: s.type,
    flags: s.flags,
    addr: s.addr,
    offset: s.offset,
    size: s.size,
  }));

  const functions: ElfSymbol[] = [];
  raw.forEach((s) => {
    if (s.type !== SHT_SYMTAB) return;
    const strtab = raw[s.link];
    const entsize = s.entsize || 16;
    for (let o = s.offset; o + entsize <= s.offset + s.size; o += entsize) {
      const info = bytes[o + 12];
      const type = info & 0xf;
      if (type !== STT_FUNC) continue;
      const value = dv.getUint32(o + 4, true);
      if (value === 0) continue;
      functions.push({
        name: cstr(bytes, strtab.offset + dv.getUint32(o, true)),
        value,
        size: dv.getUint32(o + 8, true),
        type,
        bind: info >> 4,
        index: functions.length,
      });
    }
  });
  // Sort by address. Where several names share an address (aliases), put first the
  // one addr2line reports: a local (static) definition beats a global alias, and
  // among globals the later symbol table entry wins.
  const rank = (s: ElfSymbol) => (s.bind === 0 ? 0 : s.bind === 1 ? 1 : 2);
  functions.sort((a, b) => a.value - b.value || rank(a) - rank(b) || b.index - a.index);

  const code = sections
    .filter((s) => s.flags & SHF_EXECINSTR && s.addr !== 0 && s.size > 0)
    .map((s) => [s.addr, s.addr + s.size] as [number, number]);

  return { arch, machine, sections, functions, code, bytes };
}

export function sectionData(elf: Elf, name: string): Uint8Array | undefined {
  const s = elf.sections.find((x) => x.name === name);
  return s && s.type !== 8 ? elf.bytes.subarray(s.offset, s.offset + s.size) : undefined;
}

export function isCode(elf: Elf, addr: number): boolean {
  return elf.code.some(([lo, hi]) => addr >= lo && addr < hi);
}

/** The function symbol whose range holds `addr`, or the nearest one below it. */
export function symbolFor(elf: Elf, addr: number): { symbol: ElfSymbol; offset: number } | undefined {
  const fns = elf.functions;
  let lo = 0;
  let hi = fns.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (fns[mid].value <= addr) {
      best = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  if (best < 0) return undefined;
  // Walk back over symbols at the same or lower address to find one whose size covers addr.
  for (let i = best; i >= 0 && i > best - 64; i--) {
    const s = fns[i];
    if (s.size > 0 && addr < s.value + s.size) {
      // Prefer the first alias at that address (see the sort above).
      let j = i;
      while (j > 0 && fns[j - 1].value === s.value && fns[j - 1].size > 0 && addr < fns[j - 1].value + fns[j - 1].size) j--;
      return { symbol: fns[j], offset: addr - fns[j].value };
    }
  }
  const s = fns[best];
  if (s.size === 0 && isCode(elf, addr)) return { symbol: s, offset: addr - s.value };
  return undefined;
}
