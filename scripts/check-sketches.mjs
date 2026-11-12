// Compile every library sketch for every board it lists, with the newest
// Arduino-ESP32 core (pioarduino "stable"), one build at a time.
//
//   DUMP_SKETCHES=1 npx astro build && node scripts/check-sketches.mjs [--only <id-or-board>] [--work <dir>]
//
// Needs PlatformIO on PATH. Writes a Markdown report to sketch-report.md (and to
// the GitHub job summary) and exits non-zero if anything fails to compile.
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const only = opt("--only", "");
const work = resolve(opt("--work", ".sketch-check"));
const platform =
  process.env.PIOARDUINO_PLATFORM ??
  "https://github.com/pioarduino/platform-espressif32/releases/download/stable/platform-espressif32.zip";

// Library names as the project pages list them, mapped to PlatformIO registry ids.
// A new library on the site must be added here; unknown names fail loudly.
const LIBS = {
  "DHT sensor library (Adafruit)": "adafruit/DHT sensor library",
  "Adafruit Unified Sensor": "adafruit/Adafruit Unified Sensor",
  "Adafruit SSD1306": "adafruit/Adafruit SSD1306",
  "Adafruit GFX Library": "adafruit/Adafruit GFX Library",
  "Adafruit NeoPixel": "adafruit/Adafruit NeoPixel",
  "Adafruit BME280 Library": "adafruit/Adafruit BME280 Library",
  "Adafruit MAX31855 library": "adafruit/Adafruit MAX31855 library",
  "MAX6675 library": "adafruit/MAX6675 library",
  "PubSubClient (Nick O'Leary)": "knolleary/PubSubClient",
  OneWire: "paulstoffregen/OneWire",
  DallasTemperature: "milesburton/DallasTemperature",
  "WiFiManager (tzapu)": "tzapu/WiFiManager",
  ESP32Servo: "madhephaestus/ESP32Servo",
  GxEPD2: "zinggjm/GxEPD2",
  ArduinoJson: "bblanchon/ArduinoJson",
};
const BOARDS = {
  esp32: "esp32dev",
  esp32s3: "esp32-s3-devkitc-1",
  esp32c3: "esp32-c3-devkitm-1",
  esp32s2: "esp32-s2-saola-1",
  esp32c6: "esp32-c6-devkitc-1",
  "xiao-esp32c3": "seeed_xiao_esp32c3",
  "xiao-esp32s3": "seeed_xiao_esp32s3",
  "esp32-cam": "esp32cam",
};
// Sketches that need more app space than the default partition table gives.
const HUGE_APP = new Set(["ble-scan"]);

const dump = "dist/sketch-dump/all.json";
if (!existsSync(dump)) {
  console.error(`${dump} is missing. Build with DUMP_SKETCHES=1 first.`);
  process.exit(2);
}
let sketches = JSON.parse(readFileSync(dump, "utf8"));
if (only) sketches = sketches.filter((s) => s.id === only || s.board === only);

rmSync(work, { recursive: true, force: true });
const rows = [];
let core = "";
for (const s of sketches) {
  const name = `${s.id}@${s.board}`;
  const dir = join(work, name);
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "src", "main.ino"), s.code);
  const libs = s.libs
    .filter((l) => !/built in/i.test(l))
    .map((l) => {
      if (!LIBS[l]) throw new Error(`Unknown library "${l}" in ${s.id}: add it to LIBS in scripts/check-sketches.mjs`);
      return LIBS[l];
    });
  if (!BOARDS[s.board]) throw new Error(`Unknown board "${s.board}": add it to BOARDS in scripts/check-sketches.mjs`);
  writeFileSync(
    join(dir, "platformio.ini"),
    [
      "[env:b]",
      `platform = ${platform}`,
      "framework = arduino",
      `board = ${BOARDS[s.board]}`,
      ...(HUGE_APP.has(s.id) ? ["board_build.partitions = huge_app.csv"] : []),
      ...(libs.length ? ["lib_deps =", ...libs.map((l) => `  ${l}`)] : []),
      "",
    ].join("\n"),
  );
  const started = Date.now();
  let ok = true;
  let log = "";
  try {
    log = execFileSync("pio", ["run", "-d", dir], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    ok = false;
    log = `${e.stdout ?? ""}\n${e.stderr ?? ""}`;
  }
  core ||= /framework-arduinoespressif32 @ ([\w.+-]+)/.exec(log)?.[1] ?? "";
  const errors = log
    .split("\n")
    .filter((l) => /error:|Error \d+|\*\*\* \[/.test(l))
    .slice(0, 6)
    .join("\n");
  rows.push({ name, ok, secs: Math.round((Date.now() - started) / 1000), errors });
  console.log(`${ok ? "OK  " : "FAIL"} ${name} (${rows.at(-1).secs} s)`);
  if (!ok) console.log(errors || log.slice(-3000));
}

const failed = rows.filter((r) => !r.ok);
const report = [
  `## Sketch compile check`,
  ``,
  `Arduino-ESP32 core ${core || "(version not found in the log)"}: ${rows.length - failed.length} of ${rows.length} sketch and board combinations compile.`,
  ``,
  ...(failed.length
    ? ["| Sketch | First errors |", "|---|---|", ...failed.map((r) => `| ${r.name} | <pre>${r.errors.replace(/\|/g, "\\|").replace(/\n/g, "<br>") || "see the job log"}</pre> |`)]
    : ["Everything compiles."]),
  ``,
].join("\n");
writeFileSync("sketch-report.md", report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
console.log(`\n${rows.length - failed.length}/${rows.length} compile with core ${core}`);
process.exit(failed.length ? 1 : 0);
