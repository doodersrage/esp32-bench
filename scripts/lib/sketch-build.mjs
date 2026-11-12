// Shared by scripts/check-sketches.mjs (the weekly compile check) and
// scripts/build-firmware-library.mjs (the prebuilt firmware library): how a
// library sketch becomes a PlatformIO project, gets compiled with the newest
// Arduino-ESP32 core (pioarduino "stable"), and how its images are merged.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const PLATFORM =
  process.env.PIOARDUINO_PLATFORM ??
  "https://github.com/pioarduino/platform-espressif32/releases/download/stable/platform-espressif32.zip";

// Library names as the project pages list them, mapped to PlatformIO registry ids.
// A new library on the site must be added here; unknown names fail loudly.
export const LIBS = {
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
  LiquidCrystal: "arduino-libraries/LiquidCrystal",
  RF24: "nrf24/RF24",
};

/** Site board id → PlatformIO board. */
export const BOARDS = {
  esp32: "esp32dev",
  esp32s3: "esp32-s3-devkitc-1",
  esp32c3: "esp32-c3-devkitm-1",
  esp32s2: "esp32-s2-saola-1",
  esp32c6: "esp32-c6-devkitc-1",
  "xiao-esp32c3": "seeed_xiao_esp32c3",
  "xiao-esp32s3": "seeed_xiao_esp32s3",
  "esp32-cam": "esp32cam",
};

/**
 * Site board id → chip. `family` is the ESP Web Tools chipFamily name;
 * `bootloaderOffset` is where the second-stage bootloader lives in flash
 * (0x1000 on the ESP32 and ESP32-S2, 0x0 on the S3, C3 and C6). `devkit`
 * marks the board a project's auto-detect manifest prefers when two boards
 * share a chip family (the XIAOs and the ESP32-CAM get their own manifests).
 */
export const CHIPS = {
  esp32: { family: "ESP32", chip: "esp32", bootloaderOffset: 0x1000, devkit: true },
  esp32s3: { family: "ESP32-S3", chip: "esp32s3", bootloaderOffset: 0x0, devkit: true },
  esp32c3: { family: "ESP32-C3", chip: "esp32c3", bootloaderOffset: 0x0, devkit: true },
  esp32s2: { family: "ESP32-S2", chip: "esp32s2", bootloaderOffset: 0x1000, devkit: true },
  esp32c6: { family: "ESP32-C6", chip: "esp32c6", bootloaderOffset: 0x0, devkit: true },
  "xiao-esp32c3": { family: "ESP32-C3", chip: "esp32c3", bootloaderOffset: 0x0, devkit: false },
  "xiao-esp32s3": { family: "ESP32-S3", chip: "esp32s3", bootloaderOffset: 0x0, devkit: false },
  "esp32-cam": { family: "ESP32", chip: "esp32", bootloaderOffset: 0x1000, devkit: false },
};

// esptool image header byte 12-13: the chip the image was built for.
const CHIP_IDS = { esp32: 0x0000, esp32s2: 0x0002, esp32c3: 0x0005, esp32s3: 0x0009, esp32c6: 0x000d };

// Sketches that need more app space than the default partition table gives.
export const HUGE_APP = new Set(["ble-scan"]);

/** Read the sketch export (built with DUMP_SKETCHES=1), optionally one project or board. */
export function loadSketches(dump, only = "") {
  if (!existsSync(dump)) {
    console.error(`${dump} is missing. Build with DUMP_SKETCHES=1 first.`);
    process.exit(2);
  }
  let sketches = JSON.parse(readFileSync(dump, "utf8"));
  if (only) sketches = sketches.filter((s) => s.id === only || s.board === only);
  return sketches;
}

/** Write a PlatformIO project for one sketch on one board. Throws on an unknown library or board. */
export function prepareProject(s, dir) {
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "src", "main.ino"), s.code);
  const libs = s.libs
    .filter((l) => !/built in/i.test(l))
    .map((l) => {
      if (!LIBS[l]) throw new Error(`Unknown library "${l}" in ${s.id}: add it to LIBS in scripts/lib/sketch-build.mjs`);
      return LIBS[l];
    });
  if (!BOARDS[s.board]) throw new Error(`Unknown board "${s.board}": add it to BOARDS in scripts/lib/sketch-build.mjs`);
  writeFileSync(
    join(dir, "platformio.ini"),
    [
      "[env:b]",
      `platform = ${PLATFORM}`,
      "framework = arduino",
      `board = ${BOARDS[s.board]}`,
      ...(HUGE_APP.has(s.id) ? ["board_build.partitions = huge_app.csv"] : []),
      ...(libs.length ? ["lib_deps =", ...libs.map((l) => `  ${l}`)] : []),
      "",
    ].join("\n"),
  );
}

/** Run `pio run` in a prepared project. Returns the log, whether it passed, and the core version it used. */
export function compile(dir) {
  let ok = true;
  let log = "";
  try {
    log = execFileSync("pio", ["run", "-d", dir], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    ok = false;
    log = `${e.stdout ?? ""}\n${e.stderr ?? ""}`;
  }
  const core = /framework-arduinoespressif32 @ ([\w.+-]+)/.exec(log)?.[1] ?? "";
  return { ok, log, core };
}

/** The first few compiler errors from a build log. */
export function firstErrors(log, count = 6) {
  return log
    .split("\n")
    .filter((l) => /error:|Error \d+|\*\*\* \[/.test(l))
    .slice(0, count)
    .join("\n");
}

/** Where PlatformIO put the build output of a prepared project. */
export const buildDir = (dir) => join(dir, ".pio", "build", "b");

/**
 * Merge images into one flash image, the way `esptool merge_bin` does: each
 * part at its offset, gaps filled with 0xFF (erased flash). Parts must not overlap.
 */
export function mergeImage(parts) {
  const sorted = [...parts].sort((a, b) => a.offset - b.offset);
  let end = 0;
  for (const p of sorted) {
    if (p.offset < end) throw new Error(`Image parts overlap at 0x${p.offset.toString(16)}`);
    end = p.offset + p.data.length;
  }
  const out = Buffer.alloc(end, 0xff);
  for (const p of sorted) p.data.copy(out, p.offset);
  return out;
}

/** Sanity-check a merged image: image headers where the bootloader and app must be, a partition table at 0x8000, the right chip. */
export function checkImage(image, boardId) {
  const chip = CHIPS[boardId];
  if (!chip) throw new Error(`Unknown board "${boardId}"`);
  if (image[chip.bootloaderOffset] !== 0xe9) {
    throw new Error(`${boardId}: no image header (0xE9) at the bootloader offset 0x${chip.bootloaderOffset.toString(16)}`);
  }
  if (image[0x8000] !== 0xaa || image[0x8001] !== 0x50) throw new Error(`${boardId}: no partition table magic (0xAA50) at 0x8000`);
  if (image[0x10000] !== 0xe9) throw new Error(`${boardId}: no app image header at 0x10000`);
  const id = image.readUInt16LE(0x10000 + 12);
  if (id !== CHIP_IDS[chip.chip]) throw new Error(`${boardId}: the app image is for chip id ${id}, expected ${CHIP_IDS[chip.chip]} (${chip.chip})`);
}

/**
 * The merged image for a built project on a board: bootloader at the chip's
 * offset, partition table at 0x8000, boot_app0 at 0xE000, app at 0x10000.
 * Compared with the firmware.factory.bin pioarduino writes, when present.
 */
export function mergedImageFor(dir, boardId, coreDir) {
  const chip = CHIPS[boardId];
  if (!chip) throw new Error(`Unknown board "${boardId}"`);
  const b = buildDir(dir);
  const bootApp0 = join(coreDir, "packages", "framework-arduinoespressif32", "tools", "partitions", "boot_app0.bin");
  for (const f of [join(b, "bootloader.bin"), join(b, "partitions.bin"), join(b, "firmware.bin"), bootApp0]) {
    if (!existsSync(f)) throw new Error(`Missing ${f}`);
  }
  const image = mergeImage([
    { offset: chip.bootloaderOffset, data: readFileSync(join(b, "bootloader.bin")) },
    { offset: 0x8000, data: readFileSync(join(b, "partitions.bin")) },
    { offset: 0xe000, data: readFileSync(bootApp0) },
    { offset: 0x10000, data: readFileSync(join(b, "firmware.bin")) },
  ]);
  checkImage(image, boardId);
  const factory = join(b, "firmware.factory.bin");
  if (existsSync(factory)) {
    const theirs = readFileSync(factory);
    if (!theirs.subarray(0, image.length).equals(image)) throw new Error(`${boardId}: merged image differs from pioarduino's firmware.factory.bin`);
  }
  return image;
}
