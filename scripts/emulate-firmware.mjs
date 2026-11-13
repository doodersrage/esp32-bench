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
// with --strict a crash, a boot loop or no boot at all exits 1.
//
// It also writes <project>/preview.json next to the images: what each board
// printed, with timings, for projects that need nothing attached and printed
// what the lab expects. Project pages replay it as "What it prints". Every
// project gets the file, empty when there is nothing to show, so a preview
// that stops being true is overwritten rather than left behind. A missing
// expected line never fails the run: QEMU's timing and missing peripherals make
// that a hint, not a verdict.
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, globSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { cpus, homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { gunzipSync } from "node:zlib";

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
// Peripherals QEMU models only partly or not at all. A crash inside their
// drivers (PWM for tone() and servos, the RMT behind NeoPixels, the ADC, touch)
// is the emulator's gap too: on QEMU's C3, ledc_ll_get_slow_clk_sel reads a
// clock register QEMU leaves at an invalid value and aborts.
// Deep sleep too: QEMU has no RTC power domains, so rtc_sleep_pd faults where a real chip powers down.
const PERIPHERAL = /^(ledc|rmt|adc|sar|touch|i2s|mcpwm|pcnt)_|_(ledc|rmt|adc|touch)_|^(ledcAttach|ledcWrite|analogRead|analogWrite|tone|touchRead)|^(rtc_sleep|esp_deep_sleep|esp_light_sleep)/;
// The interrupt watchdog fires when code spins with interrupts off; under QEMU
// that is a driver polling a peripheral register that never changes.
const INT_WDT = /Interrupt wdt timeout/i;

// Turn crash addresses into function names with the build's own ELF (written
// by build-firmware-library.mjs as elf/<sha>.gz) and the toolchain's addr2line.
const ADDR2LINE = {
  esp32: findTool("xtensa-esp32-elf-addr2line") ?? findTool("xtensa-esp-elf-addr2line"),
  esp32c3: findTool("riscv32-esp-elf-addr2line") ?? which("llvm-addr2line"),
};
function findTool(name) {
  return globSync(join(homedir(), ".platformio", "packages", "*", "bin", name))[0] ?? null;
}
function which(name) {
  const r = spawnSync("sh", ["-c", `command -v ${name}`], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}
const APP = 0x10000;
function functionsAt(job, out, at) {
  const tool = ADDR2LINE[job.board];
  if (!tool) return [];
  const sha = readFileSync(job.image).subarray(APP + 0xb0, APP + 0xb0 + 16).toString("hex");
  const gz = join(dir, "elf", `${sha}.gz`);
  if (!existsSync(gz)) return [];
  const elf = join(work, `${sha}.elf`);
  if (!existsSync(elf)) writeFileSync(elf, gunzipSync(readFileSync(gz)));
  // Code addresses in the panic dump: the PC, the return address and the backtrace.
  const addrs = [...new Set(out.slice(at, at + 4000).match(/0x4[0-2][0-9a-f]{6}/gi) ?? [])].slice(0, 40);
  if (addrs.length === 0) return [];
  const r = spawnSync(tool, ["-f", "-e", elf, ...addrs], { encoding: "utf8" });
  return (r.stdout ?? "").split("\n").filter((_, i) => i % 2 === 0).map((f) => f.trim()).filter((f) => f && f !== "??");
}

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
    const started = Date.now();
    /** [ms since start, text] per chunk, for the replay on project pages */
    const timed = [];
    const take = (d) => {
      if (out.length >= 200_000) return;
      const text = d.toString("utf8");
      out += text;
      timed.push([Date.now() - started, text]);
    };
    child.stdout.on("data", take);
    child.stderr.on("data", take);
    const timer = setTimeout(() => child.kill("SIGTERM"), seconds * 1000);
    child.on("error", (e) => {
      clearTimeout(timer);
      done({ ...job, status: "error", note: e.message, out, timed });
    });
    child.on("exit", () => {
      clearTimeout(timer);
      rmSync(file, { force: true });
      done({ ...judge(job, out), timed });
    });
  });
}

function judge(job, out) {
  const resets = (out.match(RESET) ?? []).length;
  const crash = CRASH.exec(out);
  if (!BOOTED.test(out)) return { ...job, status: "no boot", note: "the ROM never started the app", out };
  if (crash && RADIO.test(lineAround(out, crash.index) + out.slice(crash.index, crash.index + 400)))
    return { ...job, status: "radio", note: "booted, then stopped at the Wi-Fi or Bluetooth radio, which QEMU does not emulate", out };
  if (crash) {
    const fns = functionsAt(job, out, crash.index);
    // The crash text may not name the radio, but the functions it stopped in do (btdm_controller_task).
    const radio = fns.find((f) => RADIO.test(f));
    if (radio) return { ...job, status: "radio", note: `stopped in ${radio}: the Wi-Fi or Bluetooth radio, which QEMU does not emulate`, out };
    const hal = fns.find((f) => PERIPHERAL.test(f));
    if (hal) return { ...job, status: "peripheral", note: `stopped in ${hal}, a driver for hardware QEMU does not fully emulate`, out };
    if (INT_WDT.test(lineAround(out, crash.index)))
      return { ...job, status: "peripheral", note: `interrupt watchdog${fns[0] ? ` in ${fns[0]}` : ""}: usually a driver waiting on hardware QEMU does not emulate`, out };
    return { ...job, status: "crash", note: `${lineAround(out, crash.index)}${fns.length ? ` (in ${fns.slice(0, 3).join(" < ")})` : ""}`, out };
  }
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

const BAD = new Set(["crash", "boot loop", "no boot", "error"]);

// Run several at once: each QEMU uses one core.
const results = [];
let next = 0;
const width = Math.max(1, Math.min(cpus().length, 8));
await Promise.all(
  Array.from({ length: width }, async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      let r = await run(job);
      // QEMU now and then faults at startup (a cache error in system init on an image that booted
      // fine before). Run a failure once more and keep it only if it happens again.
      if (BAD.has(r.status)) {
        const again = await run(job);
        r = BAD.has(again.status) ? { ...again, note: `${again.note} (twice)` } : { ...again, note: `${again.note}; the first run failed: ${r.note}` };
      }
      results.push(r);
      console.log(`${r.status.padEnd(9)} ${r.id} on ${r.board}: ${r.note}`);
    }
  }),
);
rmSync(work, { recursive: true, force: true });

results.sort((a, b) => a.id.localeCompare(b.id) || a.board.localeCompare(b.board));
const count = (s) => results.filter((r) => r.status === s).length;
const bad = results.filter((r) => BAD.has(r.status));
const summary = `${results.length} images in QEMU: ${count("ok")} ok, ${count("radio")} stopped at the radio QEMU lacks, ${count("peripheral")} stopped in a peripheral QEMU lacks, ${count("missing")} missing an expected line, ${bad.length} crashed or did not boot.`;
console.log(`\n${summary}`);

// Previews: the serial output of images that ran as the lab expects, per project.
const ANSI = /\x1b\[[0-9;]*m/g;
const NOISE = /^(qemu-system|esp_core_dump|E \(\d+\) esp_core_dump)/;
function transcript(timed) {
  const lines = [];
  let partial = "";
  let at = 0;
  for (const [t, chunk] of timed) {
    const parts = (partial + chunk.replace(ANSI, "").replace(/\r/g, "")).split("\n");
    partial = parts.pop() ?? "";
    for (const line of parts) lines.push([at || t, line]);
    at = partial ? t : 0;
  }
  if (partial) lines.push([at, partial]);
  const kept = lines.filter(([, l]) => !NOISE.test(l));
  // The ROM's boot messages come before "entry 0x..."; the page shows them dimmed.
  const app = kept.findIndex(([, l]) => BOOTED.test(l)) + 1;
  let size = 0;
  const capped = kept.filter(([, l]) => (size += l.length) < 16_000).slice(0, 400);
  return { app, lines: capped.map(([t, l]) => [Math.round(t), l.slice(0, 300)]) };
}
let builtAt = null;
try {
  builtAt = JSON.parse(readFileSync(join(dir, "index.json"), "utf8")).builtAt ?? null;
} catch {
  // A library built without an index (a local --only run): previews carry no date.
}
const previews = {};
for (const r of results) {
  const e = r.expect;
  const shows = r.status === "ok" && e?.needs === "none" && (e.settings ?? []).length === 0 && /lab expects/.test(r.note);
  (previews[r.id] ??= { builtAt, emulator: "Espressif QEMU", boards: {} });
  if (shows) previews[r.id].boards[r.board] = transcript(r.timed);
}
for (const [id, preview] of Object.entries(previews)) writeFileSync(join(dir, id, "preview.json"), `${JSON.stringify(preview)}\n`);
const shown = Object.values(previews).filter((p) => Object.keys(p.boards).length > 0).length;
console.log(`Previews: ${shown} of ${Object.keys(previews).length} projects have one.`);

const QUIET = new Set(["ok", "radio"]);
const report = [
  "## Firmware in QEMU",
  "",
  summary,
  strict ? "" : "Report only: nothing here blocks publishing yet.",
  "",
  "| Project | Board | Result | Detail |",
  "|---|---|---|---|",
  ...results.filter((r) => !QUIET.has(r.status)).map((r) => `| ${r.id} | ${r.board} | ${r.status} | ${r.note.replace(/\|/g, "\\|")} |`),
  "",
  "<details><summary>Output of the images that did not pass</summary>",
  "",
  ...results
    .filter((r) => !QUIET.has(r.status) && r.status !== "peripheral")
    .flatMap((r) => [`**${r.id} on ${r.board}**`, "```", r.out.split("\n").slice(-25).join("\n"), "```", ""]),
  "</details>",
  "",
];
writeFileSync("emulator-report.md", report.join("\n"));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report.join("\n"));
process.exit(strict && bad.length > 0 ? 1 : 0);
