// DWARF .debug_line decoder (versions 2 to 5) for mapping a code address to
// file:line, like `addr2line`. GCC in Arduino-ESP32 core 3.x writes version 5
// line tables for new code; prebuilt ESP-IDF libraries carry versions 2 to 4.
import { sectionData, type Elf } from "./elf";

export interface LineRow {
  address: number;
  file: string;
  line: number;
}

interface Sequence {
  start: number;
  end: number;
  rows: LineRow[];
}

export interface LineTable {
  /** Number of line-number programs (compile units) read */
  units: number;
  sequences: Sequence[];
}

export class Reader {
  pos: number;
  constructor(
    readonly bytes: Uint8Array,
    readonly dv: DataView,
    pos = 0,
  ) {
    this.pos = pos;
  }
  u8() {
    return this.bytes[this.pos++];
  }
  i8() {
    return this.dv.getInt8(this.pos++);
  }
  u16() {
    const v = this.dv.getUint16(this.pos, true);
    this.pos += 2;
    return v;
  }
  u32() {
    const v = this.dv.getUint32(this.pos, true);
    this.pos += 4;
    return v;
  }
  u64() {
    const lo = this.u32();
    const hi = this.u32();
    return hi * 0x100000000 + lo;
  }
  uleb() {
    let result = 0;
    let shift = 0;
    for (;;) {
      const b = this.bytes[this.pos++];
      result += (b & 0x7f) * 2 ** shift;
      shift += 7;
      if ((b & 0x80) === 0) return result;
    }
  }
  sleb() {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = this.bytes[this.pos++];
      result += (b & 0x7f) * 2 ** shift;
      shift += 7;
    } while (b & 0x80);
    if (b & 0x40) result -= 2 ** shift;
    return result;
  }
  cstr() {
    const start = this.pos;
    while (this.bytes[this.pos] !== 0 && this.pos < this.bytes.length) this.pos++;
    const s = new TextDecoder().decode(this.bytes.subarray(start, this.pos));
    this.pos++;
    return s;
  }
}

export function strAt(section: Uint8Array | undefined, offset: number): string {
  if (!section) return "";
  let end = offset;
  while (end < section.length && section[end] !== 0) end++;
  return new TextDecoder().decode(section.subarray(offset, end));
}

const DW_FORM = {
  block: 0x09,
  block1: 0x0a,
  data1: 0x0b,
  data2: 0x05,
  data4: 0x06,
  data8: 0x07,
  data16: 0x1e,
  string: 0x08,
  strp: 0x0e,
  line_strp: 0x1f,
  udata: 0x0f,
  sdata: 0x0d,
  strx: 0x1a,
  strx1: 0x25,
  strx2: 0x26,
  strx4: 0x28,
} as const;

/** Read one attribute value in a v5 directory or file entry. */
function readForm(r: Reader, form: number, offset64: boolean, str: Uint8Array | undefined, lineStr: Uint8Array | undefined): string | number {
  switch (form) {
    case DW_FORM.string:
      return r.cstr();
    case DW_FORM.line_strp:
      return strAt(lineStr, offset64 ? r.u64() : r.u32());
    case DW_FORM.strp:
      return strAt(str, offset64 ? r.u64() : r.u32());
    case DW_FORM.udata:
      return r.uleb();
    case DW_FORM.sdata:
      return r.sleb();
    case DW_FORM.data1:
    case DW_FORM.strx1:
      return r.u8();
    case DW_FORM.data2:
    case DW_FORM.strx2:
      return r.u16();
    case DW_FORM.data4:
    case DW_FORM.strx4:
      return r.u32();
    case DW_FORM.data8:
      return r.u64();
    case DW_FORM.strx:
      return r.uleb();
    case DW_FORM.data16:
      r.pos += 16;
      return 0;
    case DW_FORM.block:
      { const n = r.uleb(); r.pos += n; }
      return 0;
    case DW_FORM.block1:
      { const n = r.u8(); r.pos += n; }
      return 0;
    default:
      throw new Error(`Unsupported DWARF form 0x${form.toString(16)} in a line table header`);
  }
}

function joinPath(dir: string, file: string): string {
  if (!dir || file.startsWith("/") || /^[A-Za-z]:[\\/]/.test(file)) return file;
  return `${dir.replace(/[\\/]+$/, "")}/${file}`;
}

/** Decode every line-number program in the ELF's .debug_line section. */
export function readLineTable(elf: Elf): LineTable {
  const data = sectionData(elf, ".debug_line");
  const str = sectionData(elf, ".debug_str");
  const lineStr = sectionData(elf, ".debug_line_str");
  const table: LineTable = { units: 0, sequences: [] };
  if (!data) return table;
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const r = new Reader(data, dv);

  while (r.pos + 4 <= data.length) {
    let unitLength = r.u32();
    let offset64 = false;
    if (unitLength === 0xffffffff) {
      unitLength = r.u64();
      offset64 = true;
    }
    const unitStart = r.pos;
    const unitEnd = unitStart + unitLength;
    if (unitLength === 0 || unitEnd > data.length) break;
    try {
      decodeUnit(r, unitEnd, offset64, str, lineStr, table);
      table.units++;
    } catch {
      // A unit we cannot read: skip it rather than give up on the whole file.
    }
    r.pos = unitEnd;
  }
  table.sequences.sort((a, b) => a.start - b.start);
  return table;
}

function decodeUnit(
  r: Reader,
  unitEnd: number,
  offset64: boolean,
  str: Uint8Array | undefined,
  lineStr: Uint8Array | undefined,
  table: LineTable,
) {
  const version = r.u16();
  if (version < 2 || version > 5) throw new Error(`DWARF line version ${version}`);
  let addressSize = 4;
  if (version >= 5) {
    addressSize = r.u8();
    r.u8(); // segment selector size
  }
  const headerLength = offset64 ? r.u64() : r.u32();
  const programStart = r.pos + headerLength;
  const minInst = r.u8();
  const maxOps = version >= 4 ? r.u8() : 1;
  const defaultIsStmt = r.u8() !== 0;
  const lineBase = r.i8();
  const lineRange = r.u8();
  const opcodeBase = r.u8();
  const stdLengths: number[] = [];
  for (let i = 1; i < opcodeBase; i++) stdLengths.push(r.u8());

  const dirs: string[] = [];
  const files: string[] = [];
  if (version >= 5) {
    const readEntries = (): Record<number, string | number>[] => {
      const formatCount = r.u8();
      const formats: [number, number][] = [];
      for (let i = 0; i < formatCount; i++) formats.push([r.uleb(), r.uleb()]);
      const count = r.uleb();
      const entries: Record<number, string | number>[] = [];
      for (let i = 0; i < count; i++) {
        const entry: Record<number, string | number> = {};
        for (const [kind, form] of formats) entry[kind] = readForm(r, form, offset64, str, lineStr);
        entries.push(entry);
      }
      return entries;
    };
    for (const d of readEntries()) dirs.push(String(d[1] ?? ""));
    for (const f of readEntries()) {
      const dir = dirs[Number(f[2] ?? 0)] ?? "";
      files.push(joinPath(dir, String(f[1] ?? "")));
    }
  } else {
    // Directory 0 is the compile directory, which only .debug_info knows; keep paths relative.
    dirs.push("");
    for (;;) {
      const d = r.cstr();
      if (!d) break;
      dirs.push(d);
    }
    files.push(""); // file numbers start at 1 before DWARF 5
    for (;;) {
      const name = r.cstr();
      if (!name) break;
      const dir = r.uleb();
      r.uleb();
      r.uleb();
      files.push(joinPath(dirs[dir] ?? "", name));
    }
  }

  r.pos = programStart;
  // The file register starts at 1 in every version; DWARF 5 also has a file 0.
  const firstFile = 1;
  let address = 0;
  let opIndex = 0;
  let file = firstFile;
  let line = 1;
  let rows: LineRow[] = [];
  let start = 0;
  void defaultIsStmt;

  const reset = () => {
    address = 0;
    opIndex = 0;
    file = firstFile;
    line = 1;
    rows = [];
  };
  const emit = () => {
    if (rows.length === 0) start = address;
    rows.push({ address, file: files[file] ?? `file ${file}`, line });
  };
  const advance = (operationAdvance: number) => {
    if (maxOps <= 1) address += minInst * operationAdvance;
    else {
      address += minInst * Math.floor((opIndex + operationAdvance) / maxOps);
      opIndex = (opIndex + operationAdvance) % maxOps;
    }
  };

  while (r.pos < unitEnd) {
    const op = r.u8();
    if (op >= opcodeBase) {
      const adjusted = op - opcodeBase;
      advance(Math.floor(adjusted / lineRange));
      line += lineBase + (adjusted % lineRange);
      emit();
    } else if (op === 0) {
      const len = r.uleb();
      const next = r.pos + len;
      const sub = r.u8();
      if (sub === 1) {
        // end_sequence: the address is one past the last instruction
        if (rows.length > 0 && start !== 0) table.sequences.push({ start, end: address, rows });
        reset();
      } else if (sub === 2) {
        address = addressSize === 8 ? r.u64() : r.u32();
        opIndex = 0;
      } else if (sub === 3) {
        const name = r.cstr();
        const dir = r.uleb();
        files.push(joinPath(dirs[dir] ?? "", name));
      }
      r.pos = next;
    } else {
      switch (op) {
        case 1:
          emit();
          break;
        case 2:
          advance(r.uleb());
          break;
        case 3:
          line += r.sleb();
          break;
        case 4:
          file = r.uleb();
          break;
        case 5:
          r.uleb();
          break;
        case 8:
          advance(Math.floor((255 - opcodeBase) / lineRange));
          break;
        case 9:
          address += r.u16();
          opIndex = 0;
          break;
        case 6:
        case 7:
        case 10:
        case 11:
          break;
        case 12:
          r.uleb();
          break;
        default:
          for (let i = 0; i < (stdLengths[op - 1] ?? 0); i++) r.uleb();
      }
    }
  }
}

/** The source location of `addr`, or undefined when no line table covers it. */
export function lookupLine(table: LineTable, addr: number): LineRow | undefined {
  const seqs = table.sequences;
  // Binary search for the last sequence starting at or below addr, then scan back
  // a little because sequences from different units can overlap in rare cases.
  let lo = 0;
  let hi = seqs.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (seqs[mid].start <= addr) {
      best = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  for (let i = best; i >= 0 && i > best - 32; i--) {
    const s = seqs[i];
    if (addr >= s.start && addr < s.end) {
      const rows = s.rows;
      let a = 0;
      let b = rows.length - 1;
      let hit = -1;
      while (a <= b) {
        const m = (a + b) >> 1;
        if (rows[m].address <= addr) {
          hit = m;
          a = m + 1;
        } else b = m - 1;
      }
      if (hit < 0) return undefined;
      // Several rows can share an address; addr2line reports the last one.
      return rows[hit];
    }
  }
  return undefined;
}
