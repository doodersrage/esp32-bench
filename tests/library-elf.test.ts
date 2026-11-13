// Run:  node --experimental-strip-types tests/library-elf.test.ts
// Finding the firmware library's ELF from the hash a crash prints.
import assert from "node:assert/strict";
import { elfShaIn, matchElf } from "../src/lib/library-elf.ts";

const crash = [
  "Guru Meditation Error: Core  1 panic'ed (LoadProhibited). Exception was unhandled.",
  "Backtrace: 0x400d1234:0x3ffb1f20 0x400d5678:0x3ffb1f40",
  "",
  "ELF file SHA256: 1A2B3C4D5",
  "",
  "Rebooting...",
].join("\r\n");

assert.equal(elfShaIn(crash), "1a2b3c4d5", "reads the printed hash, lower case");
assert.equal(elfShaIn("Backtrace: 0x400d1234:0x3ffb1f20"), null, "no hash line");
assert.equal(elfShaIn("ELF file SHA256: 0000000"), null, "fewer than 8 digits is not a hash");

const entry = { project: "dht22", board: "esp32", builtAt: "2026-11-17T08:00:00Z", core: "3.3.12" };
const entries = {
  "1a2b3c4d5e6f708192a3b4c5d6e7f801": entry,
  "1a2b3c4d6000000000000000000000ff": { ...entry, project: "oled" },
};
assert.equal(matchElf(entries, "1a2b3c4d5")?.project, "dht22", "a 9-digit prefix finds its build");
assert.equal(matchElf(entries, "1a2b3c4d5e6f708192a3b4c5d6e7f80199887766")?.sha, "1a2b3c4d5e6f708192a3b4c5d6e7f801", "a longer printed hash matches on 32 digits");
assert.equal(matchElf(entries, "1a2b3c4d"), null, "two builds share the prefix: no guess");
assert.equal(matchElf(entries, "ffffffff"), null, "unknown build");
console.log("library ELF lookup: all checks pass");
