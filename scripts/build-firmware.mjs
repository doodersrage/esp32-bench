#!/usr/bin/env node
/**
 * Compile the pin detective firmware and publish one merged image per chip
 * family, plus the ESP Web Tools manifest, into public/firmware/pin-detective/.
 * The images are committed so site builds do not need the ESP32 toolchain.
 * Adapted from ProbeHarbor's scripts/build-firmware.mjs.
 *
 * Two platform releases are used (see platformio.ini): the ESP32, S3 and C3
 * stay on espressif32@7.1.3 (Arduino core 2.0.17), the S2 and C6 use
 * pioarduino (core 3.x). Their packages share names but not versions, so each
 * group gets its own PlatformIO home:
 *   PLATFORMIO_CORE_DIR    core 2 group, default ~/.platformio
 *   PLATFORMIO_CORE3_DIR   core 3 group, default ~/.platformio-core3
 *
 * Needs PlatformIO (`pip install platformio`). Set PIO to a non-default binary.
 * Usage: node scripts/build-firmware.mjs [--check] [--only esp32s2,esp32c6]
 *   --check  compiles only
 *   --only   builds and merges just these envs; other images are left as they are
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
const CORE_DIRS = {
  core2: process.env.PLATFORMIO_CORE_DIR ?? join(homedir(), ".platformio"),
  core3: process.env.PLATFORMIO_CORE3_DIR ?? join(homedir(), ".platformio-core3"),
};
const checkOnly = process.argv.includes("--check");
const onlyArg = process.argv[process.argv.indexOf("--only") + 1];
const only = process.argv.includes("--only") && onlyArg ? new Set(onlyArg.split(",")) : null;

/** PlatformIO env, ESP Web Tools chip family, second-stage bootloader offset and platform group. */
const TARGETS = [
  { env: "esp32", chipFamily: "ESP32", chip: "esp32", bootloaderOffset: "0x1000", core: "core2" },
  { env: "esp32s3", chipFamily: "ESP32-S3", chip: "esp32s3", bootloaderOffset: "0x0", core: "core2" },
  { env: "esp32c3", chipFamily: "ESP32-C3", chip: "esp32c3", bootloaderOffset: "0x0", core: "core2" },
  { env: "esp32s2", chipFamily: "ESP32-S2", chip: "esp32s2", bootloaderOffset: "0x1000", core: "core3" },
  { env: "esp32c6", chipFamily: "ESP32-C6", chip: "esp32c6", bootloaderOffset: "0x0", core: "core3" },
];
const building = TARGETS.filter((t) => !only || only.has(t.env));
if (only && building.length !== only.size) {
  console.error(`Unknown env in --only. Known: ${TARGETS.map((t) => t.env).join(", ")}`);
  process.exit(1);
}

const source = readFileSync(join(projectDir, "src", "main.cpp"), "utf8");
const version = source.match(/#define FIRMWARE_VERSION "([^"]+)"/)?.[1];
if (!version) {
  console.error("FIRMWARE_VERSION not found in main.cpp");
  process.exit(1);
}

const withCore = (core) => ({ ...process.env, PLATFORMIO_CORE_DIR: CORE_DIRS[core] });

function merge(target) {
  const coreDir = CORE_DIRS[target.core];
  const bootApp0 = join(coreDir, "packages", "framework-arduinoespressif32", "tools", "partitions", "boot_app0.bin");
  if (!existsSync(bootApp0)) {
    console.error("Missing", bootApp0);
    process.exit(1);
  }
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
    // esptool 4.11 from the core 2 home merges every chip, the S2 and C6 too.
    // (pioarduino's esptool 5 needs its own Python environment to run.)
    { cwd: projectDir, stdio: "inherit", env: withCore("core2") },
  );
}

// One group at a time: never two PlatformIO runs on the same home at once.
// Switching homes makes PlatformIO clean the build folder, so merge each
// group's images before building the next.
mkdirSync(outDir, { recursive: true });
for (const core of ["core2", "core3"]) {
  const group = building.filter((t) => t.core === core);
  if (group.length === 0) continue;
  execFileSync(pio, ["run", ...group.flatMap((t) => ["-e", t.env])], { cwd: projectDir, stdio: "inherit", env: withCore(core) });
  if (!checkOnly) group.forEach(merge);
}
if (checkOnly) process.exit(0);

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
console.log(`Wrote public/firmware/${NAME}/ (version ${version}${only ? `, rebuilt ${[...only].join(", ")}` : ""})`);
