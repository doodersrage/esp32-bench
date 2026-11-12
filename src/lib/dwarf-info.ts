// Reads function names from DWARF .debug_info (versions 2 to 5): for each
// function with a start address, the name the compiler recorded. This settles
// which of several symbol-table aliases is the real function, the same way
// addr2line does.
import { Reader, strAt } from "./dwarf-line";
import { sectionData, type Elf } from "./elf";

const TAG_SUBPROGRAM = 0x2e;
const AT = { name: 0x03, lowPc: 0x11, linkage: 0x6e, mipsLinkage: 0x2007, specification: 0x47, origin: 0x31 };

interface AbbrevAttr {
  at: number;
  form: number;
  implicit?: number;
}
interface Abbrev {
  tag: number;
  children: boolean;
  attrs: AbbrevAttr[];
}

function readAbbrevs(data: Uint8Array, offset: number): Map<number, Abbrev> {
  const r = new Reader(data, new DataView(data.buffer, data.byteOffset, data.byteLength), offset);
  const table = new Map<number, Abbrev>();
  for (;;) {
    const code = r.uleb();
    if (code === 0) break;
    const tag = r.uleb();
    const children = r.u8() !== 0;
    const attrs: AbbrevAttr[] = [];
    for (;;) {
      const at = r.uleb();
      const form = r.uleb();
      if (at === 0 && form === 0) break;
      attrs.push(form === 0x21 ? { at, form, implicit: r.sleb() } : { at, form });
    }
    table.set(code, { tag, children, attrs });
  }
  return table;
}

interface Ctx {
  r: Reader;
  version: number;
  addrSize: number;
  offset64: boolean;
  cuStart: number;
  str?: Uint8Array;
  lineStr?: Uint8Array;
}

/** Read or skip one attribute value. Strings come back as text, references as absolute offsets. */
function readValue(c: Ctx, form: number): string | number | undefined {
  const r = c.r;
  const off = () => (c.offset64 ? r.u64() : r.u32());
  switch (form) {
    case 0x01: return c.addrSize === 8 ? r.u64() : r.u32(); // addr
    case 0x03: { const n = r.u16(); r.pos += n; } return; // block2
    case 0x04: { const n = r.u32(); r.pos += n; } return; // block4
    case 0x05: r.pos += 2; return; // data2
    case 0x06: r.pos += 4; return; // data4
    case 0x07: r.pos += 8; return; // data8
    case 0x08: return r.cstr(); // string
    case 0x09: { const n = r.uleb(); r.pos += n; } return; // block
    case 0x0a: { const n = r.u8(); r.pos += n; } return; // block1
    case 0x0b: r.pos += 1; return; // data1
    case 0x0c: r.pos += 1; return; // flag
    case 0x0d: r.sleb(); return; // sdata
    case 0x0e: return strAt(c.str, off()); // strp
    case 0x0f: r.uleb(); return; // udata
    case 0x10: return c.version <= 2 ? (c.addrSize === 8 ? r.u64() : r.u32()) : off(); // ref_addr: absolute
    case 0x11: return c.cuStart + r.u8(); // ref1
    case 0x12: return c.cuStart + r.u16(); // ref2
    case 0x13: return c.cuStart + r.u32(); // ref4
    case 0x14: return c.cuStart + r.u64(); // ref8
    case 0x15: return c.cuStart + r.uleb(); // ref_udata
    case 0x16: return readValue(c, r.uleb()); // indirect
    case 0x17: off(); return; // sec_offset
    case 0x18: { const n = r.uleb(); r.pos += n; } return; // exprloc
    case 0x19: return; // flag_present
    case 0x1a: r.uleb(); return; // strx (needs .debug_str_offsets; not used by GCC here)
    case 0x1b: r.uleb(); return; // addrx
    case 0x1c: r.pos += 4; return; // ref_sup4
    case 0x1d: off(); return; // strp_sup
    case 0x1e: r.pos += 16; return; // data16
    case 0x1f: return strAt(c.lineStr, off()); // line_strp
    case 0x20: r.pos += 8; return; // ref_sig8
    case 0x21: return; // implicit_const
    case 0x22: case 0x23: r.uleb(); return; // loclistx, rnglistx
    case 0x24: r.pos += 8; return; // ref_sup8
    case 0x25: case 0x29: r.pos += 1; return; // strx1, addrx1
    case 0x26: case 0x2a: r.pos += 2; return; // strx2, addrx2
    case 0x27: case 0x2b: r.pos += 3; return; // strx3, addrx3
    case 0x28: case 0x2c: r.pos += 4; return; // strx4, addrx4
    case 0x1f01: case 0x1f02: r.uleb(); return; // GNU_addr_index, GNU_str_index
    case 0x1f20: case 0x1f21: off(); return; // GNU_ref_alt, GNU_strp_alt
    default:
      throw new Error(`Unknown DWARF form 0x${form.toString(16)}`);
  }
}

/** Map from a function's start address to its recorded name (linkage name when there is one). */
export function readFunctionNames(elf: Elf): Map<number, string> {
  const info = sectionData(elf, ".debug_info");
  const abbrevData = sectionData(elf, ".debug_abbrev");
  const result = new Map<number, string>();
  if (!info || !abbrevData) return result;
  const str = sectionData(elf, ".debug_str");
  const lineStr = sectionData(elf, ".debug_line_str");
  const dv = new DataView(info.buffer, info.byteOffset, info.byteLength);
  const r = new Reader(info, dv);
  const abbrevCache = new Map<number, Map<number, Abbrev>>();

  // Names of every subprogram DIE by offset, and the start addresses that point at them.
  const linkages = new Map<number, string>();
  const plain = new Map<number, string>();
  const refs = new Map<number, number>();
  const pending: [number, number][] = [];

  while (r.pos + 11 <= info.length) {
    const cuStart = r.pos;
    let length = r.u32();
    let offset64 = false;
    if (length === 0xffffffff) {
      length = r.u64();
      offset64 = true;
    }
    const cuEnd = r.pos + length;
    if (length === 0 || cuEnd > info.length) break;
    try {
      const version = r.u16();
      let abbrevOffset: number;
      let addrSize: number;
      if (version >= 5) {
        const unitType = r.u8();
        addrSize = r.u8();
        abbrevOffset = offset64 ? r.u64() : r.u32();
        if (unitType === 2 || unitType === 6) r.pos += 8 + (offset64 ? 8 : 4);
        else if (unitType === 4 || unitType === 5) r.pos += 8;
      } else {
        abbrevOffset = offset64 ? r.u64() : r.u32();
        addrSize = r.u8();
      }
      let abbrevs = abbrevCache.get(abbrevOffset);
      if (!abbrevs) {
        abbrevs = readAbbrevs(abbrevData, abbrevOffset);
        abbrevCache.set(abbrevOffset, abbrevs);
      }
      const c: Ctx = { r, version, addrSize, offset64, cuStart, str, lineStr };
      while (r.pos < cuEnd) {
        const dieOffset = r.pos;
        const code = r.uleb();
        if (code === 0) continue;
        const ab = abbrevs.get(code);
        if (!ab) throw new Error(`bad abbreviation ${code} at ${dieOffset.toString(16)}`);
        let name: string | undefined;
        let linkage: string | undefined;
        let lowPc: number | undefined;
        let ref: number | undefined;
        for (const a of ab.attrs) {
          const v = readValue(c, a.form);
          if (ab.tag !== TAG_SUBPROGRAM) continue;
          if (a.at === AT.name && typeof v === "string") name = v;
          else if ((a.at === AT.linkage || a.at === AT.mipsLinkage) && typeof v === "string") linkage = v;
          else if (a.at === AT.lowPc && a.form === 0x01 && typeof v === "number") lowPc = v;
          else if ((a.at === AT.specification || a.at === AT.origin) && typeof v === "number") ref = v;
        }
        if (ab.tag !== TAG_SUBPROGRAM) continue;
        if (linkage) linkages.set(dieOffset, linkage);
        if (name) plain.set(dieOffset, name);
        if (ref !== undefined) refs.set(dieOffset, ref);
        if (lowPc) pending.push([lowPc, dieOffset]);
      }
    } catch {
      // Skip a unit we cannot read; the symbol table still names its functions.
    }
    r.pos = cuEnd;
  }

  // Prefer a linkage name found anywhere along the specification and origin chain.
  const resolve = (offset: number, depth = 0): string | undefined => {
    const l = linkages.get(offset);
    if (l || depth > 8) return l;
    const next = refs.get(offset);
    return (next === undefined ? undefined : resolve(next, depth + 1)) ?? plain.get(offset);
  };
  for (const [pc, die] of pending) {
    const n = resolve(die);
    if (n && !result.has(pc)) result.set(pc, n);
  }
  return result;
}
