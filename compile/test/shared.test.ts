// Run: node --experimental-strip-types test/shared.test.ts
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { checkRequest, dayKey, parseBuild, quotaDecision, secondsToMidnight, LIBS, MAX_CODE_BYTES } from "../src/shared.ts";

// The container's library list is a copy of the site's; they must not drift.
const site = new URL("../../src/data/compile-libs.json", import.meta.url);
const copy = JSON.parse(readFileSync(new URL("../container/compile-libs.json", import.meta.url), "utf8"));
if (existsSync(site)) assert.deepEqual(copy, JSON.parse(readFileSync(site, "utf8")), "run node scripts/sync-libs.mjs");
assert.deepEqual(LIBS, Object.keys(copy.libs));

// Request validation
const good = checkRequest({ board: "esp32c3", code: "void setup(){}\nvoid loop(){}", libs: ["OneWire", "WiFi (built in)"] });
assert.ok(good.ok && good.request.libs.length === 1 && good.request.libs[0] === "OneWire", "built-in libraries are dropped, real ones kept");
assert.equal(checkRequest(null).ok, false);
assert.equal(checkRequest({ board: "esp8266", code: "x" }).ok, false, "unknown board");
assert.equal(checkRequest({ board: "esp32", code: "   " }).ok, false, "empty sketch");
assert.equal(checkRequest({ board: "esp32", code: "x".repeat(MAX_CODE_BYTES + 1) }).ok, false, "too long");
assert.equal(checkRequest({ board: "esp32", code: "x", libs: ["Nonexistent"] }).ok, false, "unknown library");
assert.equal(checkRequest({ board: "esp32", code: "x", partitions: "min_spiffs" }).ok, false, "only huge_app");
const huge = checkRequest({ board: "esp32", code: "x", partitions: "huge_app" });
assert.ok(huge.ok && huge.request.partitions === "huge_app");

// Compiler output parsing (real PlatformIO/GCC shapes)
const log = `Processing b (platform: https://github.com/pioarduino/platform-espressif32/releases/download/stable/platform-espressif32.zip; board: esp32dev; framework: arduino)
PLATFORM: Espressif 32 (55.3.312) > Espressif ESP32 Dev Module
PACKAGES:
 - framework-arduinoespressif32 @ 3.3.12
 - toolchain-xtensa-esp-elf @ 14.2.0+20260121
Compiling .pio/build/b/src/main.ino.cpp.o
src/main.ino: In function 'void loop()':
src/main.ino:12:5: error: 'fooBar' was not declared in this scope; did you mean 'foo'?
   12 |     fooBar(1);
      |     ^~~~~~
      |     foo
src/main.ino:12:5: error: 'fooBar' was not declared in this scope; did you mean 'foo'?
src/main.ino:7:9: warning: unused variable 'x' [-Wunused-variable]
/opt/templates/esp32/.pio/libdeps/b/Adafruit SSD1306/Adafruit_SSD1306.cpp:88:3: warning: some library warning [-Wsomething]
*** [.pio/build/b/src/main.ino.cpp.o] Error 1
`;
const p = parseBuild(log);
assert.equal(p.errors.length, 1, "duplicate error lines collapse");
assert.deepEqual(p.errors[0], { file: "main.ino", line: 12, col: 5, message: "'fooBar' was not declared in this scope; did you mean 'foo'?", inSketch: true });
assert.equal(p.warnings.length, 2);
assert.equal(p.warnings[0].inSketch, true);
assert.equal(p.warnings[1].inSketch, false);
assert.equal(p.warnings[1].file, "Adafruit_SSD1306.cpp");
assert.equal(p.core, "3.3.12");
assert.equal(p.sizes, null);

const okLog = `PACKAGES:
 - framework-arduinoespressif32 @ 3.3.12
Linking .pio/build/b/firmware.elf
Retrieving maximum program size .pio/build/b/firmware.elf
Checking size .pio/build/b/firmware.elf
Advanced Memory Usage is available via "PlatformIO Home > Project Inspect"
RAM:   [=         ]   6.3% (used 20744 bytes from 327680 bytes)
Flash: [==        ]  20.5% (used 268905 bytes from 1310720 bytes)
Building .pio/build/b/firmware.bin
`;
const q = parseBuild(okLog);
assert.deepEqual(q.sizes, { flashUsed: 268905, flashTotal: 1310720, ramUsed: 20744, ramTotal: 327680 });
assert.equal(q.errors.length, 0);
assert.equal(q.failure, "");

const tooBig = parseBuild("Error: The program size (1400000 bytes) is greater than maximum allowed (1310720 bytes)\n*** [checkprogsize] Explicit exit, status 1");
assert.match(tooBig.failure, /huge_app/);
const missing = parseBuild("src/main.ino:3:10: fatal error: NoSuch.h: No such file or directory\n    3 | #include <NoSuch.h>\ncompilation terminated.");
assert.equal(missing.errors.length, 1, "fatal error counts as an error");
assert.match(missing.errors[0].message, /NoSuch\.h/);
const stopped = parseBuild("Compiling ...\n*** Build stopped after 120 seconds.");
assert.match(stopped.failure, /too long/);
const link = parseBuild("undefined reference to `missingFunction()'\ncollect2: error: ld returned 1 exit status");
assert.match(link.failure, /missingFunction/);

// Absolute paths, as the container prints them, and library paths with spaces
const abs = parseBuild(` /opt/templates/esp32/src/main.ino:9:3: error: 'undefinedThing' was not declared in this scope
/opt/templates/esp32/.pio/libdeps/b/DHT sensor library/DHT.cpp:40:7: warning: unused [-Wunused]`);
assert.deepEqual(abs.errors[0], { file: "main.ino", line: 9, col: 3, message: "'undefinedThing' was not declared in this scope", inSketch: true });
assert.equal(abs.warnings[0].file, "DHT.cpp");
assert.equal(abs.warnings[0].inSketch, false);

// Quotas
assert.equal(quotaDecision(0, 0).allowed, true);
assert.equal(quotaDecision(39, 100).allowed, true);
assert.equal(quotaDecision(40, 100).allowed, false);
assert.match(quotaDecision(40, 100).reason, /40 builds/);
assert.equal(quotaDecision(0, 600).allowed, false);
assert.match(quotaDecision(0, 600).reason, /daily limit/);
assert.equal(dayKey(new Date("2026-11-12T23:59:59Z")), "2026-11-12");
assert.equal(dayKey(new Date("2026-11-13T00:00:01Z")), "2026-11-13");
assert.equal(secondsToMidnight(new Date("2026-11-12T23:00:00Z")), 3600);
assert.equal(secondsToMidnight(new Date("2026-11-12T23:59:30Z")), 60, "never shorter than a minute");
console.log("compile service: all checks pass");
