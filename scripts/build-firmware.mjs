#!/usr/bin/env node
/**
 * Compile the pin detective firmware and publish one merged image per chip
 * family, plus the ESP Web Tools manifest, into public/firmware/pin-detective/.
 * The images are committed so site builds do not need the ESP32 toolchain.
 * Adapted from ProbeHarbor's scripts/build-firmware.mjs.
 *
 * Needs PlatformIO (`pip install platformio`). Set PIO to a non-default binary.
 * Usage: node scripts/build-firmware.mjs [--check]   (--check compiles only)
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const NAME = "pin-detective";
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const projectDir = join(repoRoot, "firmware", NAME);
const outDir = join(repoRoot, "public", "firmware", NAME);
const pio = process.env.PIO ?? "pio";
const coreDir = process.env.PLATFORMIO_CORE_DIR ?? join(homedir(), ".platformio");
const checkOnly = process.argv.includes("--check");

/** PlatformIO env, ESP Web Tools chip family and second-stage bootloader offset. */
const TARGETS = [
  { env: "esp32", chipFamily: "ESP32", chip: "esp32", bootloaderOffset: "0x1000" },
  { env: "esp32s3", chipFamily: "ESP32-S3", chip: "esp32s3", bootloaderOffset: "0x0" },
  { env: "esp32c3", chipFamily: "ESP32-C3", chip: "esp32c3", bootloaderOffset: "0x0" },
];

const source = readFileSync(join(projectDir, "src", "main.cpp"), "utf8");
const version = source.match(/#define FIRMWARE_VERSION "([^"]+)"/)?.[1];
if (!version) {
  console.error("FIRMWARE_VERSION not found in main.cpp");
  process.exit(1);
}

execFileSync(pio, ["run"], { cwd: projectDir, stdio: "inherit" });
if (checkOnly) process.exit(0);

const bootApp0 = join(coreDir, "packages", "framework-arduinoespressif32", "tools", "partitions", "boot_app0.bin");
if (!existsSync(bootApp0)) {
  console.error("Missing", bootApp0);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
for (const target of TARGETS) {
  const buildDir = join(projectDir, ".pio", "build", target.env);
  execFileSync(
    pio,
    [
      "pkg", "exec", "-p", "tool-esptoolpy", "--",
      "esptool.py", "--chip", target.chip, "merge_bin", "-o", join(outDir, `${NAME}-${target.env}.bin`),
      target.bootloaderOffset, join(buildDir, "bootloader.bin"),
      "0x8000", join(buildDir, "partitions.bin"),
      "0xe000", bootApp0,
      "0x10000", join(buildDir, "firmware.bin"),
    ],
    { cwd: projectDir, stdio: "inherit" },
  );
}

const manifest = {
  name: "ESP32 Bench pin detective",
  version,
  new_install_prompt_erase: false,
  // The firmware has no Improv Serial; skip the dialog's Improv wait after install.
  new_install_improv_wait_time: 0,
  builds: TARGETS.map((target) => ({
    chipFamily: target.chipFamily,
    parts: [{ path: `${NAME}-${target.env}.bin`, offset: 0 }],
  })),
};
writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote public/firmware/${NAME}/ (version ${version})`);
