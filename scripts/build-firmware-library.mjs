// Build the prebuilt firmware library: every library sketch, for every board it
// lists, compiled with the newest Arduino-ESP32 core and merged into one flash
// image per board, plus ESP Web Tools manifests and an index.
//
//   DUMP_SKETCHES=1 npx astro build && node scripts/build-firmware-library.mjs [--only <id-or-board>] [--work <dir>] [--out <dir>] [--skip-build]
//
// Output (default .firmware-library/):
//   <project>/<board>.bin           merged image, flash at offset 0
//   <project>/manifest.json         auto-detect manifest: one build per chip family (DevKit boards preferred)
//   <project>/manifest-<board>.json one manifest per board, for boards that share a family with a DevKit
//   index.json                      what was built, with sizes, the core version and the build time
//
// Needs PlatformIO on PATH, one build at a time. --skip-build merges whatever a
// previous run left in the work dir. The whole run fails if any sketch does not
// compile, and index.json is written only then, so a broken sketch can never
// publish a half-finished library (the uploader needs index.json).
// Writes firmware-report.md (and the GitHub job summary).
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { CHIPS, PLATFORM, buildDir, compile, firstErrors, loadSketches, mergedImageFor, prepareProject } from "./lib/sketch-build.mjs";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const only = opt("--only", "");
const work = resolve(opt("--work", ".firmware-build"));
const out = resolve(opt("--out", ".firmware-library"));
/** ELFs built this run, by the first 32 hex digits of their SHA-256 */
const elves = {};
const skipBuild = args.includes("--skip-build");
const coreDir = process.env.PLATFORMIO_CORE_DIR ?? join(homedir(), ".platformio");

// Prebuilt elsewhere (the ProbeHarbor probe ships its own images) or no sketch.
const EXCLUDE = new Set(["probeharbor-probe"]);

const sketches = loadSketches("dist/sketch-dump/all.json", only).filter((s) => !EXCLUDE.has(s.id));
if (sketches.length === 0) {
  console.error("Nothing to build.");
  process.exit(2);
}

if (!skipBuild) rmSync(work, { recursive: true, force: true });
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const rows = [];
let core = "";
for (const s of sketches) {
  const name = `${s.id}@${s.board}`;
  const dir = join(work, name);
  const started = Date.now();
  let ok = true;
  let errors = "";
  if (!skipBuild) {
    prepareProject(s, dir);
    const result = compile(dir);
    core ||= result.core;
    ok = result.ok;
    errors = firstErrors(result.log);
    if (!ok) console.log(errors || result.log.slice(-3000));
  } else if (!existsSync(join(buildDir(dir), "firmware.bin"))) {
    ok = false;
    errors = "no previous build in the work dir";
  }
  let size = 0;
  if (ok) {
    try {
      const image = mergedImageFor(dir, s.board, coreDir);
      mkdirSync(join(out, s.id), { recursive: true });
      writeFileSync(join(out, s.id, `${s.board}.bin`), image);
      size = image.length;
      // The ELF, gzipped and named by its SHA-256 (the hash a crash prints), so
      // the backtrace decoder can find it from a pasted log.
      const elf = readFileSync(join(buildDir(dir), "firmware.elf"));
      const sha = createHash("sha256").update(elf).digest("hex").slice(0, 32);
      mkdirSync(join(out, "elf"), { recursive: true });
      writeFileSync(join(out, "elf", `${sha}.gz`), gzipSync(elf, { level: 9 }));
      elves[sha] = { project: s.id, board: s.board };
    } catch (e) {
      ok = false;
      errors = e instanceof Error ? e.message : String(e);
    }
  }
  rows.push({ id: s.id, board: s.board, name, ok, size, secs: Math.round((Date.now() - started) / 1000), errors });
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${ok ? ` ${(size / 1024).toFixed(0)} KB` : ""} (${rows.at(-1).secs} s)`);
}

const failed = rows.filter((r) => !r.ok);
const builtAt = new Date().toISOString();
const day = builtAt.slice(0, 10).replace(/-/g, "");
const version = `${core || "core"}-${day}`;

// Manifests and the index, only when everything built.
const projects = {};
if (failed.length === 0) {
  const byProject = new Map();
  for (const r of rows) {
    if (!byProject.has(r.id)) byProject.set(r.id, []);
    byProject.get(r.id).push(r);
  }
  for (const [id, built] of byProject) {
    const boards = built.map((r) => r.board);
    const name = sketches.find((s) => s.id === id)?.name ?? id;
    // One build per chip family; a DevKit board wins over a XIAO or the ESP32-CAM.
    const perFamily = new Map();
    for (const board of boards) {
      const chip = CHIPS[board];
      const current = perFamily.get(chip.family);
      if (!current || (chip.devkit && !CHIPS[current].devkit)) perFamily.set(chip.family, board);
    }
    const manifest = (title, entries) => ({
      name: title,
      version,
      new_install_prompt_erase: true,
      // No Improv Serial in these sketches: do not wait for it after installing.
      new_install_improv_wait_time: 0,
      builds: entries.map(([family, board]) => ({ chipFamily: family, parts: [{ path: `${board}.bin`, offset: 0 }] })),
    });
    writeFileSync(join(out, id, "manifest.json"), `${JSON.stringify(manifest(`ESP32 Bench: ${name}`, [...perFamily]), null, 2)}\n`);
    const manifests = {};
    for (const board of boards) {
      if (perFamily.get(CHIPS[board].family) === board) continue;
      manifests[board] = `${id}/manifest-${board}.json`;
      writeFileSync(join(out, id, `manifest-${board}.json`), `${JSON.stringify(manifest(`ESP32 Bench: ${name} (${board})`, [[CHIPS[board].family, board]]), null, 2)}\n`);
    }
    projects[id] = {
      boards,
      manifest: `${id}/manifest.json`,
      ...(Object.keys(manifests).length ? { manifests } : {}),
      size: Object.fromEntries(built.map((r) => [r.board, r.size])),
    };
  }
  writeFileSync(join(out, "index.json"), `${JSON.stringify({ builtAt, core, version, platform: PLATFORM, projects }, null, 2)}\n`);
  await writeElfIndex();
}

/**
 * elf/index.json: every ELF built in the last ELF_DAYS, so a board flashed from
 * an older build still decodes. Merged with the published index; older entries
 * drop out (and the bucket's lifecycle rule deletes their files).
 */
async function writeElfIndex() {
  const ELF_DAYS = 90;
  let entries = {};
  try {
    const res = await fetch(`${process.env.FW_BASE ?? "https://fw.esp32bench.dev"}/elf/index.json`, { signal: AbortSignal.timeout(20_000) });
    if (res.ok) entries = (await res.json()).entries ?? {};
  } catch {
    // First run, or offline: start a new index.
  }
  const cutoff = Date.now() - ELF_DAYS * 86_400_000;
  entries = Object.fromEntries(Object.entries(entries).filter(([, e]) => Date.parse(e.builtAt) >= cutoff));
  for (const [sha, e] of Object.entries(elves)) entries[sha] = { ...e, builtAt, core };
  writeFileSync(join(out, "elf", "index.json"), `${JSON.stringify({ entries })}\n`);
}

const report = [
  `## Firmware library`,
  ``,
  failed.length === 0
    ? `Arduino-ESP32 core ${core || "(version not found)"}: ${rows.length} images for ${Object.keys(projects).length} projects, version ${version}.`
    : `${failed.length} of ${rows.length} builds failed. Nothing will be published.`,
  ``,
  ...(failed.length
    ? ["| Sketch | First errors |", "|---|---|", ...failed.map((r) => `| ${r.name} | <pre>${r.errors.replace(/\|/g, "\\|").replace(/\n/g, "<br>") || "see the job log"}</pre> |`)]
    : ["| Project | Boards | Largest image |", "|---|---|---|", ...Object.entries(projects).map(([id, p]) => `| ${id} | ${p.boards.join(", ")} | ${(Math.max(...Object.values(p.size)) / 1024).toFixed(0)} KB |`)]),
  ``,
].join("\n");
writeFileSync("firmware-report.md", report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
console.log(`\n${rows.length - failed.length}/${rows.length} images built${failed.length ? "; index.json NOT written" : `; library in ${out}`}`);
process.exit(failed.length ? 1 : 0);
