// Checks the partition table builder and flasher logic: node scripts/test-tools.mjs
import { build } from "rolldown";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const out = mkdtempSync(join(tmpdir(), "tools-"));
const load = async (name) => {
  await build({
    input: new URL(`../src/lib/${name}.ts`, import.meta.url).pathname,
    platform: "node",
    logLevel: "silent",
    output: { file: join(out, `${name}.mjs`), format: "esm" },
  });
  return import(pathToFileURL(join(out, `${name}.mjs`)).href);
};
const pt = await load("partitions");
const fp = await load("flash-plan");
rmSync(out, { recursive: true, force: true });

let failures = 0;
const ok = (cond, what) => {
  if (!cond) {
    failures++;
    console.log(`FAIL ${what}`);
  }
};

for (const preset of pt.PRESETS) {
  const flash = preset.flashMB * pt.MB;
  const errors = pt.check(preset.rows, flash).filter((p) => p.level === "error");
  ok(errors.length === 0, `${preset.id} has no errors: ${errors.map((e) => e.text).join("; ")}`);
  const auto = pt.autoOffsets(preset.rows);
  ok(auto.every((r, i) => r.offset === preset.rows[i].offset), `${preset.id} automatic offsets match the Arduino file`);
  const round = pt.parseCsv(pt.toCsv(preset.rows)).rows;
  ok(JSON.stringify(round) === JSON.stringify(preset.rows), `${preset.id} survives a CSV round trip`);
  ok(pt.toCsv(preset.rows).split("\n")[0].startsWith("# Name,"), `${preset.id} CSV has the header`);
}
const def = pt.PRESETS.find((p) => p.id === "default");
ok(pt.maxApp(def.rows) === 0x140000, "default max app is 1.25 MB");
ok(pt.maxApp(pt.PRESETS.find((p) => p.id === "huge_app").rows) === 0x300000, "huge_app max app is 3 MB");

const shifted = def.rows.map((r) => (r.name === "app1" ? { ...r, offset: 0x140000 } : r));
ok(pt.check(shifted, 4 * pt.MB).some((p) => /overlaps/.test(p.text)), "overlap detected");
ok(pt.check(def.rows, 2 * pt.MB).some((p) => /past the end/.test(p.text)), "too big for 2 MB detected");
ok(pt.check([{ ...def.rows[2], offset: 0x11000 }], 4 * pt.MB).some((p) => /64 KB/.test(p.text)), "unaligned app detected");
ok(pt.parseSize("1.25M") === 0x140000 && pt.parseSize("1280K") === 0x140000 && pt.parseSize("0x140000") === 0x140000, "sizes parse");
const blank = pt.parseCsv("nvs, data, nvs, , 0x5000,\notadata, data, ota, , 0x2000,\napp0, app, ota_0, , 1M,\n");
ok(blank.blankOffsets && blank.rows[2].offset === 0x10000, "blank offsets are filled in like ESP-IDF does");

ok(fp.bootloaderOffset("ESP32") === 0x1000 && fp.bootloaderOffset("ESP32-S2") === 0x1000, "bootloader at 0x1000 on ESP32 and S2");
ok(["ESP32-S3", "ESP32-C3", "ESP32-C6", "ESP32-H2"].every((c) => fp.bootloaderOffset(c) === 0), "bootloader at 0x0 on S3, C3, C6, H2");
const names = {
  "sketch.ino.bootloader.bin": ["bootloader", "auto"],
  "sketch.ino.partitions.bin": ["partitions", 0x8000],
  "boot_app0.bin": ["boot_app0", 0xe000],
  "sketch.ino.bin": ["app", 0x10000],
  "firmware.bin": ["app", 0x10000],
  "sketch.ino.merged.bin": ["merged", 0],
  "bootloader.bin": ["bootloader", "auto"],
  "partition-table.bin": ["partitions", 0x8000],
  "ota_data_initial.bin": ["boot_app0", 0xe000],
};
for (const [n, [role, offset]] of Object.entries(names)) {
  const g = fp.guessRole(n);
  ok(g.role === role && g.offset === offset, `guess ${n} -> ${g.role} ${g.offset}`);
}
const plan = [
  { name: "b.bin", size: 0x5000, role: "bootloader", offset: "auto" },
  { name: "p.bin", size: 0xc00, role: "partitions", offset: 0x8000 },
  { name: "a.bin", size: 0x40000, role: "app", offset: 0x10000 },
];
ok(fp.checkPlan(plan, "ESP32").filter((p) => p.level === "error").length === 0, "Arduino-style plan is valid on ESP32");
ok(fp.checkPlan([{ ...plan[0], size: 0x9000 }, plan[1]], "ESP32").some((p) => /overlaps/.test(p.text)), "bootloader overlapping the table detected");
ok(fp.checkPlan([{ name: "x.bin", size: 10, role: "app", offset: 0x10100 }]).some((p) => /boundary/.test(p.text)), "unaligned offset detected");

console.log(failures ? `${failures} failure(s)` : "partitions and flash plan: all checks pass");
process.exit(failures ? 1 : 0);
