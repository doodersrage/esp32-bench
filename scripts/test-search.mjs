// Site search scorer tests.
//   npm run build && node --experimental-strip-types scripts/test-search.mjs
// The first part uses made-up entries; the second ranks real queries against
// the built dist/search-index.json.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { normalize, prepare, search, unpackIndex, packIndex } from "../src/lib/search.ts";

let checks = 0;
const ok = (cond, msg) => {
  assert.ok(cond, msg);
  checks++;
};

// normalize
ok(normalize("GPIO34") === "gpio 34", "letters split from digits");
ok(normalize("GPIO-34") === normalize("gpio 34"), "punctuation ignored");
ok(normalize("ESP32-C6") === "esp 32 c 6", "board names");
ok(normalize("Café") === "cafe", "accents removed");

// synthetic ranking
const fake = [
  { title: "Guru Meditation Error: LoadProhibited", url: "/e/load", kind: "Error", snippet: "Read from a bad address.", text: "LoadProhibited crash" },
  { title: "Guru Meditation Error: StoreProhibited", url: "/e/store", kind: "Error", snippet: "Wrote to a bad address.", text: "StoreProhibited crash" },
  { title: "GPIO 34", url: "/b/esp32#gpio-34", kind: "Pin", snippet: "ESP32-DevKitC. ADC1_CH6. Input only.", text: "input only" },
  { title: "GPIO 3", url: "/b/esp32#gpio-3", kind: "Pin", snippet: "ESP32-DevKitC. UART0 RX.", text: "" },
  { title: "ESP32-C6-DevKitC-1", url: "/b/c6", kind: "Board", snippet: "ESP32-C6 pinout.", text: "wifi 6 thread" },
  { title: "GPIO 6", url: "/b/c6#gpio-6", kind: "Pin", snippet: "ESP32-C6-DevKitC-1. ADC1_CH6.", text: "C6" },
  { title: "GPIO 6", url: "/b/c3#gpio-6", kind: "Pin", snippet: "ESP32-C3-DevKitM-1. ADC1_CH6.", text: "C3" },
];
const idx = prepare(fake);
const top = (q) => search(idx, q)[0]?.url;
ok(top("loadprohibited") === "/e/load", "one word, case folded");
ok(top("Load Prohibited") === "/e/load", "split words still find LoadProhibited");
ok(top("gpio34") === "/b/esp32#gpio-34", "gpio34 without a space");
ok(top("GPIO 34") === "/b/esp32#gpio-34", "GPIO 34 with a space");
ok(top("gpio 3") === "/b/esp32#gpio-3", "exact pin number beats a longer one");
ok(top("c6") === "/b/c6", "board before its own pins");
ok(!search(idx, "c6").some((e) => e.url === "/b/c3#gpio-6"), "c6 does not match GPIO 6 on a C3");
ok(top("gpio 6 c6") === "/b/c6#gpio-6", "a pin on a named board");
ok(search(idx, "").length === 0 && search(idx, "   ").length === 0, "empty query finds nothing");
ok(search(idx, "zzzzqqq").length === 0, "nonsense finds nothing");

// pack and unpack round trip
const round = unpackIndex(JSON.parse(JSON.stringify(packIndex(fake))));
ok(JSON.stringify(round) === JSON.stringify(fake), "index packs and unpacks");

// real index
const path = new URL("../dist/search-index.json", import.meta.url);
if (!existsSync(path)) {
  console.log(`search: ${checks} checks pass (no dist/search-index.json; run npm run build for the real-index checks)`);
  process.exit(0);
}
const real = prepare(unpackIndex(JSON.parse(readFileSync(path, "utf8"))));
const first = (q) => search(real, q)[0];
const expectFirst = (q, test, what) => {
  const e = first(q);
  ok(!!e && test(e), `"${q}" should find ${what} first, got ${e ? `${e.kind} ${e.title}` : "nothing"}`);
};
expectFirst("brownout", (e) => e.kind === "Error" && /brownout/i.test(e.title), "the brownout error");
expectFirst("c6", (e) => e.kind === "Board" && /C6/.test(e.title), "the ESP32-C6 board");
expectFirst("dht", (e) => e.kind === "Project" && /DHT22/.test(e.title), "the DHT22 project");
expectFirst("loadprohibited", (e) => /LoadProhibited/.test(e.title), "the LoadProhibited error");
expectFirst("Load Prohibited", (e) => /LoadProhibited/.test(e.title), "the LoadProhibited error");
expectFirst("gpio34", (e) => e.kind === "Pin" && /^GPIO 34\b/.test(e.title), "a GPIO 34 pin");
expectFirst("i2c", (e) => /I2C/.test(e.title), "an I2C result");
expectFirst("oled", (e) => /OLED/.test(e.title), "the OLED project");
ok(!search(real, "oled").some((e) => /Blink/.test(e.title)), "oled does not match Blink through run-together words");
expectFirst("GPIO 34", (e) => e.kind === "Pin" && /^GPIO 34\b/.test(e.title), "a GPIO 34 pin");
expectFirst("backtrace", (e) => /backtrace/i.test(e.title), "a backtrace result");
expectFirst("partition", (e) => e.kind === "Tool" && /Partition/.test(e.title), "the partition tool");
expectFirst("xiao s3", (e) => e.kind === "Board" && /XIAO ESP32S3/.test(e.title), "the XIAO ESP32S3 board");
expectFirst("ch340", (e) => e.kind === "Guide", "the drivers guide section");
expectFirst("ota", (e) => e.kind === "Project" && /air/i.test(e.title), "the OTA project");
ok(search(real, "strapping").some((e) => e.kind === "Pin"), "strapping finds pins");
ok(search(real, "adc2").some((e) => e.kind === "Pin" && /ADC2/.test(e.snippet)), "adc2 finds ADC2 pins");
ok(search(real, "touch").some((e) => e.kind === "Pin"), "touch finds touch pins");
ok(search(real, "probeharbor").length >= 8, "probeharbor finds its sketches");

console.log(`search: ${checks} checks pass, ${real.length} entries in the real index`);
