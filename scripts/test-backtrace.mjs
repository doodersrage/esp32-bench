// Checks the in-browser backtrace decoder against the toolchain's addr2line.
//
//   node scripts/test-backtrace.mjs <firmware.elf>... [--addr2line-dir <dir>] [--count 50]
//
// For each ELF it picks function addresses from the symbol table, decodes them
// with src/lib/backtrace.ts and with `addr2line -pfiaC`, and reports how often
// the function name and the file:line agree. Exits non-zero below 95 %.
import { build } from "rolldown";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  const [v] = args.splice(i, 2).slice(1);
  return v;
};
const toolDirs = (opt("--addr2line-dir", "") || "").split(":").filter(Boolean);
const count = Number(opt("--count", "50"));
const elfs = args;
if (elfs.length === 0) {
  console.error("usage: node scripts/test-backtrace.mjs <firmware.elf>... --addr2line-dir <dir>[:<dir>]");
  process.exit(2);
}

// Bundle the TypeScript modules once.
const out = mkdtempSync(join(tmpdir(), "bt-"));
await build({
  input: new URL("../src/lib/backtrace.ts", import.meta.url).pathname,
  platform: "node",
  logLevel: "silent",
  output: { file: join(out, "backtrace.mjs"), format: "esm" },
});
const lib = await import(pathToFileURL(join(out, "backtrace.mjs")).href);
rmSync(out, { recursive: true, force: true });

function addr2lineFor(machine) {
  const want = machine === 94 ? /^xtensa-esp(32)?-elf-addr2line$/ : /^riscv32-esp-elf-addr2line$/;
  for (const d of toolDirs) {
    const hit = readdirSync(d).find((f) => want.test(f));
    if (hit) return join(d, hit);
  }
  throw new Error(`No addr2line for machine ${machine} in ${toolDirs.join(", ")}`);
}

// Small deterministic generator so runs are repeatable.
let seed = 12345;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

// Clone suffixes print as "foo.isra.0", "foo$isra$0" or "foo [clone .isra.0]": all the same function.
const clean = (fn) => fn.replace(/ \[clone [^\]]*\]/g, "").replace(/[.$](constprop|isra|part|cold|lto_priv)([.$]\d+)*/g, "").trim();
// addr2line sometimes gives only the short DWARF name ("free" for pool::free): compare the last component.
const nameOnly = (fn) => clean(fn).replace(/\(anonymous namespace\)::/g, "").replace(/\(.*$/, "").trim().split("::").pop();
let worst = 1;
const total = { fn: 0, fnOk: 0, line: 0, lineOk: 0 };

for (const path of elfs) {
  const fw = lib.loadFirmware(readFileSync(path));
  const tool = addr2lineFor(fw.elf.machine);
  const candidates = fw.elf.functions.filter((f) => f.size >= 8);
  const picks = [];
  const used = new Set();
  while (picks.length < count && used.size < candidates.length) {
    const i = Math.floor(rand() * candidates.length);
    if (used.has(i)) continue;
    used.add(i);
    const f = candidates[i];
    const addr = (f.value + Math.floor(rand() * (f.size - 2))) & ~1;
    picks.push(addr);
  }
  const text = execFileSync(tool, ["-pfiaC", "-e", path, ...picks.map((a) => `0x${a.toString(16)}`)], { encoding: "utf8" });
  const blocks = text.split(/\n(?=0x[0-9a-f]+: )/).filter(Boolean);

  const tally = { n: 0, fnExact: 0, fnName: 0, fnSkip: 0, lineMatch: 0, lineSkip: 0 };
  const misses = [];
  for (const [i, block] of blocks.entries()) {
    const linesOut = block.trim().split("\n");
    const parse = (s) => {
      const m = /^(?:0x[0-9a-f]+: | \(inlined by\) )(.*) at (.*?):(\?|\d+)(?: \(discriminator \d+\))?$/.exec(s);
      return m ? { fn: m[1], file: m[2], line: m[3] === "?" ? null : Number(m[3]) } : null;
    };
    const inner = parse(linesOut[0]);
    const outer = parse(linesOut[linesOut.length - 1]);
    const frame = lib.decodeAddress(fw, { address: picks[i], source: "address" });
    tally.n++;
    if (!outer || outer.fn === "??") tally.fnSkip++;
    else {
      if (clean(outer.fn) === clean(frame.function ?? "")) tally.fnExact++;
      if (nameOnly(outer.fn) === nameOnly(frame.function ?? "")) tally.fnName++;
      else misses.push(`fn   0x${picks[i].toString(16)} addr2line=${outer.fn} ours=${frame.function}`);
    }
    if (!inner || inner.file === "??" || inner.line === null) tally.lineSkip++;
    else if (frame.line === inner.line && basename(frame.file ?? "") === basename(inner.file)) tally.lineMatch++;
    else misses.push(`line 0x${picks[i].toString(16)} addr2line=${inner.file}:${inner.line} ours=${frame.file}:${frame.line}`);
  }
  const fnBase = tally.n - tally.fnSkip;
  const lineBase = tally.n - tally.lineSkip;
  const pct = (a, b) => (b === 0 ? "n/a" : `${((100 * a) / b).toFixed(1)}%`);
  console.log(
    `${path.split("/").slice(-5, -4)[0] ?? basename(path)} (${fw.elf.arch}, ${fw.lines.units} line units): ` +
      `${tally.n} addresses | function name ${tally.fnName}/${fnBase} ${pct(tally.fnName, fnBase)}` +
      ` (with arguments ${pct(tally.fnExact, fnBase)}) | file:line ${tally.lineMatch}/${lineBase} ${pct(tally.lineMatch, lineBase)}` +
      ` | no debug info: ${tally.lineSkip}`,
  );
  for (const m of misses.slice(0, 8)) console.log(`    ${m}`);
  total.fn += fnBase;
  total.fnOk += tally.fnName;
  total.line += lineBase;
  total.lineOk += tally.lineMatch;
  if (fnBase) worst = Math.min(worst, tally.fnName / fnBase);
  if (lineBase) worst = Math.min(worst, tally.lineMatch / lineBase);
}

console.log(`TOTAL over ${elfs.length} ELFs: function name ${total.fnOk}/${total.fn}, file:line ${total.lineOk}/${total.line}`);

// Address extraction from real log formats.
const xtensa = `Guru Meditation Error: Core  1 panic'ed (LoadProhibited). Exception was unhandled.
PC      : 0x400d1a2b  PS      : 0x00060830  A0      : 0x800d2b3c  A1      : 0x3ffb2270
Backtrace: 0x400d1a28:0x3ffb2270 0x400d2b39:0x3ffb2290 0x40089e5e:0x3ffb22b0`;
const riscv = `Guru Meditation Error: Core  0 panic'ed (Load access fault). Exception was unhandled.
MEPC    : 0x4200289a  RA      : 0x4200287c  SP      : 0x3fc97a90  GP      : 0x3fc8ea00
MCAUSE  : 0x00000005  MTVAL   : 0x00000000
Stack memory:
3fc97a90: 0x00000000 0x42002900 0x3fc97ab0 0x42005b42
3fc97aa0: 0xa5a5a5a5 0x00000000 0x00000000 0x00000000`;
const fx = lib.findAddresses(xtensa).map((f) => `${f.source}:${f.address.toString(16)}`).join(" ");
const fr = lib.findAddresses(riscv, (a) => a >= 0x42000000 && a < 0x42800000).map((f) => `${f.source}:${f.address.toString(16)}`).join(" ");
const okX = fx === "pc:400d1a2b backtrace:400d1a28 backtrace:400d2b39 backtrace:40089e5e";
const okR = fr === "mepc:4200289a ra:4200287c stack:42002900 stack:42005b42";
console.log(`log parsing: xtensa ${okX ? "ok" : `FAIL ${fx}`}, riscv ${okR ? "ok" : `FAIL ${fr}`}`);

// Demangler spot checks against known c++filt output.
const dm = [
  ["_ZN14HardwareSerial5beginEmjaabmh", "HardwareSerial::begin(unsigned long, unsigned int, signed char, signed char, bool, unsigned long, unsigned char)"],
  ["_Z3fooPKc", "foo(char const*)"],
  ["_ZNK6String6equalsEPKc", "String::equals(char const*) const"],
  ["_ZN6StringC2EPKc", "String::String(char const*)"],
  ["_ZN6StringD1Ev", "String::~String()"],
  ["_ZNSt6vectorIiSaIiEE9push_backERKi", "std::vector<int, std::allocator<int> >::push_back(int const&)"],
  ["_ZZ4loopE5count", "loop::count"],
  ["_Z3maxIiET_S0_S0_", "int max<int>(int, int)"],
  ["_ZN5ArrayILj4EE3getEj", "Array<4u>::get(unsigned int)"],
  ["_Z5setupv.constprop.0", "setup() [clone .constprop.0]"],
];
let dmFails = 0;
for (const [m, want] of dm) {
  const got = lib.demangleForTest ? lib.demangleForTest(m) : null;
  if (got !== want) {
    dmFails++;
    console.log(`    demangle ${m}: got ${got} want ${want}`);
  }
}
console.log(`demangler: ${dm.length - dmFails}/${dm.length} known cases`);

if (worst < 0.95 || !okX || !okR || dmFails) process.exit(1);
