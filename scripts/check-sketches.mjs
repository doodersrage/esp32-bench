// Compile every library sketch for every board it lists, with the newest
// Arduino-ESP32 core (pioarduino "stable"), one build at a time.
//
//   DUMP_SKETCHES=1 npx astro build && node scripts/check-sketches.mjs [--only <id-or-board>] [--work <dir>]
//
// Needs PlatformIO on PATH. Writes a Markdown report to sketch-report.md (and to
// the GitHub job summary) and exits non-zero if anything fails to compile.
// The library and board maps live in scripts/lib/sketch-build.mjs.
import { appendFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { compile, firstErrors, loadSketches, prepareProject } from "./lib/sketch-build.mjs";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const only = opt("--only", "");
const work = resolve(opt("--work", ".sketch-check"));

const sketches = loadSketches("dist/sketch-dump/all.json", only);

rmSync(work, { recursive: true, force: true });
const rows = [];
let core = "";
for (const s of sketches) {
  const name = `${s.id}@${s.board}`;
  const dir = join(work, name);
  prepareProject(s, dir);
  const started = Date.now();
  const result = compile(dir);
  core ||= result.core;
  const errors = firstErrors(result.log);
  rows.push({ name, ok: result.ok, secs: Math.round((Date.now() - started) / 1000), errors });
  console.log(`${result.ok ? "OK  " : "FAIL"} ${name} (${rows.at(-1).secs} s)`);
  if (!result.ok) console.log(errors || result.log.slice(-3000));
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
