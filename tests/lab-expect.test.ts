// Run after `npx astro build`:  node --experimental-strip-types tests/lab-expect.test.ts
// Checks that every project with a sketch has a lab expectation, that each
// pattern is a valid regex, and that each pattern matches that project's own
// sample output (the sample is what a working build prints, so a pattern that
// cannot match it would never pass in the lab either).
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { LAB_EXPECT } from "../src/data/lab-expect.ts";

// Patterns allowed not to match the sample, with the reason.
const EXCEPTIONS: Record<string, string> = {};

for (const [id, e] of Object.entries(LAB_EXPECT)) {
  assert.ok(e.patterns.length > 0, `${id}: at least one pattern`);
  assert.ok(e.seconds >= 3 && e.seconds <= 120, `${id}: seconds in range`);
  assert.ok(["none", "wifi", "parts"].includes(e.needs), `${id}: needs`);
  for (const src of e.patterns) new RegExp(src, "m"); // throws if invalid
  if (e.settings) for (const k of e.settings) assert.match(k, /^[a-z][a-z0-9_]{1,30}$/, `${id}: setting key ${k}`);
}

const manifestPath = "dist/lab-manifest.json";
if (!existsSync(manifestPath)) {
  console.log(`lab expect: ${Object.keys(LAB_EXPECT).length} entries valid (build the site for the full check against every project)`);
  process.exit(0);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
  projects: Record<string, { baud: number; boards: string[]; expect: unknown; sample: string[]; chips: Record<string, string> }>;
};
const ids = Object.keys(manifest.projects);
const missing = ids.filter((id) => !LAB_EXPECT[id]);
assert.deepEqual(missing, [], `projects without a lab expectation: ${missing.join(", ")}`);
const stale = Object.keys(LAB_EXPECT).filter((id) => !manifest.projects[id]);
assert.deepEqual(stale, [], `expectations for projects that no longer exist: ${stale.join(", ")}`);

let unmatched = 0;
for (const id of ids) {
  const p = manifest.projects[id];
  const text = p.sample.join("\n");
  for (const src of LAB_EXPECT[id].patterns) {
    const ok = new RegExp(src, "m").test(text);
    const key = `${id}:${src}`;
    if (!ok && !EXCEPTIONS[key]) {
      unmatched++;
      console.error(`${id}: pattern /${src}/ matches no sample line`);
    }
  }
  for (const b of p.boards) assert.ok(p.chips[b], `${id}: chip for board ${b}`);
  assert.ok(p.baud > 0, `${id}: baud`);
}
assert.equal(unmatched, 0, "every pattern matches its project's sample (or is listed as an exception)");

const needs = { none: 0, wifi: 0, parts: 0 };
for (const id of ids) needs[LAB_EXPECT[id].needs]++;
console.log(`lab expect: ${ids.length} projects, needs none ${needs.none}, wifi ${needs.wifi}, parts ${needs.parts}; all patterns match their samples`);
