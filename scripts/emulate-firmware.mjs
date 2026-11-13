// Boot every ESP32 and ESP32-C3 image of the firmware library in Espressif's
// QEMU and read its serial output: did it boot, did it crash or reboot in a
// loop, and (for projects that need nothing attached) did it print what the
// hardware lab expects. QEMU has no Wi-Fi and no sensors, so Wi-Fi and parts
// projects only get the crash check.
//
//   DUMP_SKETCHES=1 npx astro build && node scripts/build-firmware-library.mjs
//   QEMU_DIR=/path/to/qemu node scripts/emulate-firmware.mjs [--dir .firmware-library] [--only <id>] [--strict]
//
// QEMU_DIR holds bin/qemu-system-xtensa and bin/qemu-system-riscv32 from
// https://github.com/espressif/qemu/releases. Without --strict it only reports;
// with --strict a crash, a boot loop or no boot at all exits 1. A missing
// expected line never fails the run: QEMU's timing and missing peripherals make
// that a hint, not a verdict.
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { cpus, tmpdir } from "node:os";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const dir = resolve(opt("--dir", ".firmware-library"));
const only = opt("--only", "");
const strict = args.includes("--strict");
const qemuDir = resolve(process.env.QEMU_DIR ?? "qemu");
const manifestPath = resolve(opt("--manifest", "dist/lab-manifest.json"));

// Boards QEMU can run whose serial output goes to UART0. The XIAO C3 and the
// C3 SuperMini print over native USB, which QEMU does not emulate.
const MACHINES = {
  esp32: { bin: "qemu-system-xtensa", args: ["-machine", "esp32"] },
  esp32c3: { bin: "qemu-system-riscv32", args: ["-machine", "esp32c3", "-icount", "3"] },
};
const FLASH = 4 * 1024 * 1024;

const CRASH = /Guru Meditation|abort\(\) was called|panic'ed|Stack smashing|assert failed|Backtrace: 0x/i;
const RESET = /rst:0x[0-9a-f]+ \(/gi;
const BOOTED = /entry 0x[0-9a-f]+/i;
// QEMU has no Wi-Fi or Bluetooth radio: starting one asserts in the PHY or
// controller code. That is the emulator's limit, not a bug in the sketch.
const RADIO = /esp_phy_enable|phy_init\.c|esp_wifi_init|wifi_init|btdm|bt_controller|esp_bt_|ble_controller/i;

const manifest = JSON.parse(readFileSync(manifestPath, "utf8")).projects;
const jobs = [];
for (const [id, p] of Object.entries(manifest)) {
  if (only && id !== only) continue;
  for (const board of Object.keys(MACHINES)) {
    const image = join(dir, id, `${board}.bin`);
    if (p.boards.includes(board) && existsSync(image)) jobs.push({ id, board, image, expect: p.expect });
  }
}
if (jobs.length === 0) {
  console.error(`No ESP32 or ESP32-C3 images found in ${dir}.`);
  process.exit(2);
}

const work = mkdtempSync(join(tmpdir(), "emulate-"));

function run(job) {
  return new Promise((done) => {
    const m = MACHINES[job.board];
    // QEMU wants the whole flash chip: the image, then erased (0xFF) flash.
    const flash = Buffer.alloc(FLASH, 0xff);
    readFileSync(job.image).copy(flash);
    const file = join(work, `${job.id}-${job.board}.bin`);
    writeFileSync(file, flash);

    const seconds = Math.min(Math.max(job.expect?.seconds ?? 8, 6), 20);
    const child = spawn(join(qemuDir, "bin", m.bin), ["-nographic", ...m.args, "-drive", `file=${file},if=mtd,format=raw`], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    const take = (d) => {
      if (out.length < 200_000) out += d.toString("utf8");
    };
    child.stdout.on("data", take);
    child.stderr.on("data", take);
    const timer = setTimeout(() => child.kill("SIGTERM"), seconds * 1000);
    child.on("error", (e) => {
      clearTimeout(timer);
      done({ ...job, status: "error", note: e.message, out });
    });
    child.on("exit", () => {
      clearTimeout(timer);
      rmSync(file, { force: true });
      done(judge(job, out));
    });
  });
}

function judge(job, out) {
  const resets = (out.match(RESET) ?? []).length;
  const crash = CRASH.exec(out);
  if (!BOOTED.test(out)) return { ...job, status: "no boot", note: "the ROM never started the app", out };
  if (crash && RADIO.test(lineAround(out, crash.index) + out.slice(crash.index, crash.index + 400)))
    return { ...job, status: "radio", note: "booted, then stopped at the Wi-Fi or Bluetooth radio, which QEMU does not emulate", out };
  if (crash) return { ...job, status: "crash", note: lineAround(out, crash.index), out };
  if (resets > 1) return { ...job, status: "boot loop", note: `${resets} resets`, out };
  const e = job.expect;
  if (!e || e.needs !== "none" || (e.settings ?? []).length > 0) return { ...job, status: "ok", note: e ? `boots (needs ${e.needs})` : "boots", out };
  const missing = e.patterns.filter((p) => !new RegExp(p).test(out));
  if (missing.length === 0) return { ...job, status: "ok", note: "printed what the lab expects", out };
  // Nothing at all after the ROM hands over: usually setup() waiting on hardware QEMU lacks (the RMT behind NeoPixels, for one).
  const after = out.slice(out.search(BOOTED)).split("\n").slice(1).filter((l) => l.trim() && !/^qemu-system|esp_core_dump/.test(l));
  return after.length === 0
    ? { ...job, status: "missing", note: "booted but printed nothing: probably waiting on hardware QEMU does not emulate", out }
    : { ...job, status: "missing", note: `no line matching ${missing.map((p) => `/${p}/`).join(", ")}`, out };
}

const lineAround = (text, at) => text.slice(text.lastIndexOf("\n", at) + 1, text.indexOf("\n", at) >= 0 ? text.indexOf("\n", at) : undefined).trim().slice(0, 160);

// Run several at once: each QEMU uses one core.
const results = [];
let next = 0;
const width = Math.max(1, Math.min(cpus().length, 8));
await Promise.all(
  Array.from({ length: width }, async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      const r = await run(job);
      results.push(r);
      console.log(`${r.status.padEnd(9)} ${r.id} on ${r.board}: ${r.note}`);
    }
  }),
);
rmSync(work, { recursive: true, force: true });

results.sort((a, b) => a.id.localeCompare(b.id) || a.board.localeCompare(b.board));
const count = (s) => results.filter((r) => r.status === s).length;
const bad = results.filter((r) => ["crash", "boot loop", "no boot", "error"].includes(r.status));
const summary = `${results.length} images in QEMU: ${count("ok")} ok, ${count("radio")} stopped at the radio QEMU lacks, ${count("missing")} missing an expected line, ${bad.length} crashed or did not boot.`;
console.log(`\n${summary}`);

const report = [
  "## Firmware in QEMU",
  "",
  summary,
  strict ? "" : "Report only: nothing here blocks publishing yet.",
  "",
  "| Project | Board | Result | Detail |",
  "|---|---|---|---|",
  ...results.filter((r) => r.status !== "ok" && r.status !== "radio").map((r) => `| ${r.id} | ${r.board} | ${r.status} | ${r.note.replace(/\|/g, "\\|")} |`),
  "",
  "<details><summary>Output of the images that did not pass</summary>",
  "",
  ...results
    .filter((r) => r.status !== "ok" && r.status !== "radio")
    .flatMap((r) => [`**${r.id} on ${r.board}**`, "```", r.out.split("\n").slice(-25).join("\n"), "```", ""]),
  "</details>",
  "",
];
writeFileSync("emulator-report.md", report.join("\n"));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report.join("\n"));
process.exit(strict && bad.length > 0 ? 1 : 0);
