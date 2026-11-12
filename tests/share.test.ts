// Run: node --experimental-strip-types tests/share.test.ts
import assert from "node:assert/strict";
import { decodeLog, encodeLog, logCodeFromHash, trimLog, MAX_SHARE_CHARS } from "../src/lib/share.ts";

const crash = [
  "rst:0x1 (POWERON_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)",
  "Guru Meditation Error: Core  1 panic'ed (LoadProhibited). Exception was unhandled.",
  "Backtrace: 0x400d1a2b:0x3ffb1f50 0x400d2c3d:0x3ffb1f70",
  "température °C ✓ ünïcode",
].join("\n");

const code = await encodeLog(crash);
assert.match(code, /^1\.[A-Za-z0-9_-]+$/, "url-safe");
assert.equal(await decodeLog(code), crash, "round trip");
assert.equal(logCodeFromHash(`#log=${code}`), code, "hash parsing");
assert.equal(await decodeLog("1.!!!"), null, "garbage rejected");
assert.equal(await decodeLog("2.abc"), null, "unknown version rejected");
assert.equal(await decodeLog("1.AAAA"), null, "corrupt data rejected");

const big = Array.from({ length: 2000 }, (_, i) => `line ${i} heartbeat temperature 21.${i % 10}`).join("\n") + "\nGuru Meditation Error: the end";
const t = trimLog(big);
assert.ok(t.trimmed && t.text.length <= MAX_SHARE_CHARS, "trimmed to the limit");
assert.ok(t.text.endsWith("Guru Meditation Error: the end"), "keeps the end");
assert.ok(t.text.startsWith("line "), "starts on a whole line");
const bigCode = await encodeLog(t.text);
console.log(`a ${t.text.length}-character log becomes a ${bigCode.length}-character link code`);
assert.equal(await decodeLog(bigCode), t.text);
console.log("share links: all checks pass");
