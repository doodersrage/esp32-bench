// Run: node --experimental-strip-types tests/editor.test.ts
import assert from "node:assert/strict";
import {
  MAX_CODE_BYTES,
  base64ToBytes,
  buildRequest,
  checkBeforeBuild,
  errorRange,
  healthMessage,
  kb,
  looksLikeImage,
  percent,
  readAnswer,
  storageKey,
} from "../src/lib/compile-client.ts";

// Request: built-in libraries dropped, duplicates removed, optional fields only when needed.
assert.deepEqual(buildRequest("esp32", "x"), { board: "esp32", code: "x" });
assert.deepEqual(buildRequest("esp32c3", "x", ["WiFi (built in)", "OneWire", "OneWire", " DallasTemperature "], false), {
  board: "esp32c3",
  code: "x",
  libs: ["OneWire", "DallasTemperature"],
});
assert.deepEqual(buildRequest("esp32", "x", [], true), { board: "esp32", code: "x", partitions: "huge_app" });

// Checks before sending.
const sketch = "void setup() {\n}\nvoid loop() {\n}\n";
assert.equal(checkBeforeBuild(sketch), null);
assert.match(checkBeforeBuild("   ") ?? "", /empty/);
assert.match(checkBeforeBuild("int main() {}") ?? "", /setup\(\) and loop\(\)/);
assert.match(checkBeforeBuild(sketch + "x".repeat(MAX_CODE_BYTES)) ?? "", /150 KB/);

// base64 → bytes and the image check.
const img = new Uint8Array(0x10010);
img[0] = 0xe9;
img[0x10000] = 0xe9;
const b64 = Buffer.from(img).toString("base64");
const back = base64ToBytes(b64);
assert.equal(back.length, img.length);
assert.ok(looksLikeImage(back, 0));
assert.ok(!looksLikeImage(back, 0x1000), "ESP32 bootloader is at 0x1000");
assert.deepEqual([...base64ToBytes("AQID\n")], [1, 2, 3], "whitespace in base64 is ignored");

// Answers.
let r = readAnswer(200, { ok: true, chip: "esp32", image_b64: Buffer.from([1, 2]).toString("base64") });
assert.ok(r.kind === "built" && r.image && r.image.length === 2);
r = readAnswer(200, { ok: true });
assert.ok(r.kind === "built" && r.image === null, "no image when the service leaves it out");
r = readAnswer(200, {
  ok: false,
  errors: [
    { file: "main.ino", line: 3, col: 5, message: "'foo' was not declared in this scope", inSketch: true },
    { file: "Wire.h", line: 10, col: 1, message: "bad", inSketch: false },
  ],
});
assert.ok(r.kind === "errors" && r.sketch.length === 1 && r.other.length === 1);
r = readAnswer(200, { ok: false, failure: "Program too big" });
assert.ok(r.kind === "failure" && r.message === "Program too big");
r = readAnswer(200, { ok: false });
assert.ok(r.kind === "failure" && /log/.test(r.message));
r = readAnswer(429, { ok: false, error: "Daily limit reached" });
assert.ok(r.kind === "busy" && r.message === "Daily limit reached");
assert.ok(readAnswer(429, null).kind === "busy");
assert.ok(readAnswer(503, null).kind === "unavailable");
assert.ok(readAnswer(502, null).kind === "unavailable");
r = readAnswer(400, { ok: false, error: "Unknown library: Foo" });
assert.ok(r.kind === "rejected" && r.message === "Unknown library: Foo");
assert.ok(readAnswer(200, null).kind === "rejected", "unreadable 200 body");

// Health wording.
assert.match(healthMessage("sleeping"), /Waking/);
assert.match(healthMessage("starting"), /Waking/);
assert.equal(healthMessage("ready"), "Building...");
assert.equal(healthMessage(undefined), "Building...");

// Error positions in the editor text.
const code = "void setup() {\n  fooBar(1);\n}\n\nvoid loop() {}\n";
let range = errorRange(code, 2, 3);
assert.equal(code.slice(range.from, range.to), "fooBar");
assert.equal(range.line, 2);
range = errorRange(code, 99, 1);
assert.equal(range.line, 6, "lines past the end clamp to the last line");
range = errorRange(code, 4, 7);
assert.equal(range.from, range.to, "an empty line gives an empty range");
range = errorRange(code, 1, 500);
assert.ok(range.from <= code.indexOf("\n") && range.to <= code.indexOf("\n"), "columns clamp to the line");
range = errorRange(code, 0, 0);
assert.equal(range.line, 1);

// Storage keys and number formatting.
assert.equal(storageKey("dht22", "esp32c3"), "bench.edit.dht22.esp32c3");
assert.equal(kb(268905), "263 KB");
assert.equal(percent(268905, 1310720), 21);
assert.equal(percent(undefined, 100), 0);
assert.equal(percent(200, 100), 100);
console.log("editor helpers: all checks pass");
