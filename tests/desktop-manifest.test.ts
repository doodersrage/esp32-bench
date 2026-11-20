// Run after `npx astro build`:  node --experimental-strip-types tests/desktop-manifest.test.ts
// Checks dist/desktop-manifest.json, which the ESP32 Bench desktop app reads. Its
// format is defined in the esp32-desktop repository (schema/project-manifest/);
// these are the invariants the app relies on.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const path = "dist/desktop-manifest.json";
if (!existsSync(path)) {
  console.log("desktop manifest: build the site first");
  process.exit(0);
}
const m = JSON.parse(readFileSync(path, "utf8"));

assert.equal(m.format, "esp32bench-project-manifest");
assert.match(m.version, /^\d+\.\d+\.\d+$/);
assert.ok(!Number.isNaN(Date.parse(m.generated)), "generated is a date");

const chips = new Set(["esp32", "esp32s2", "esp32s3", "esp32c3", "esp32c6"]);
const boards = new Set<string>();
for (const b of m.boards) {
  assert.ok(chips.has(b.chip), `board ${b.id}: chip ${b.chip}`);
  assert.ok(!boards.has(b.id), `board ${b.id} listed twice`);
  boards.add(b.id);
}
for (const b of m.boards) {
  if (b.variantOf) assert.ok(boards.has(b.variantOf), `board ${b.id}: variantOf ${b.variantOf}`);
  if (b.buildAs) assert.ok(boards.has(b.buildAs), `board ${b.id}: buildAs ${b.buildAs}`);
}

const ids = new Set<string>();
const unfilled = /%[A-Z][A-Z0-9_]*%/;
for (const p of m.projects) {
  assert.match(p.id, /^[a-z0-9][a-z0-9-]*$/, `project id ${p.id}`);
  assert.ok(!ids.has(p.id), `project ${p.id} listed twice`);
  ids.add(p.id);
  assert.ok(["sketch", "prebuilt"].includes(p.firmware), `${p.id}: firmware`);
  assert.ok(p.builds.length > 0, `${p.id}: at least one board`);
  assert.ok(Number.isInteger(p.baud) && p.baud > 0, `${p.id}: baud`);
  for (const part of p.parts) assert.ok(part.quantity > 0 && part.name, `${p.id}: part ${JSON.stringify(part)}`);
  for (const e of p.expect?.patterns ?? []) new RegExp(e, "m");
  // Every library that is not part of the ESP32 core can be installed.
  const installable = new Set((p.install ?? []).map((i: any) => i.library));
  for (const lib of p.libraries) {
    if (/built in|built into/i.test(lib)) continue;
    assert.ok(installable.has(lib), `${p.id}: no registry id for library "${lib}" (add it to compile-libs.json)`);
  }
  for (const i of p.install ?? []) assert.match(i.registry, /^[^/\s]+\/[^/]+$/, `${p.id}: registry id ${i.registry}`);
  if (p.partitions !== undefined) assert.equal(p.partitions, "huge_app", `${p.id}: partitions`);

  const seen = new Set<string>();
  for (const b of p.builds) {
    assert.ok(boards.has(b.board), `${p.id}: unknown board ${b.board}`);
    assert.ok(!seen.has(b.board), `${p.id}: board ${b.board} twice`);
    seen.add(b.board);
    if (p.firmware === "sketch") assert.ok(typeof b.code === "string" && b.code.length > 0, `${p.id}/${b.board}: code`);
    else assert.equal(b.code, undefined, `${p.id}/${b.board}: prebuilt firmware has no code`);
    if (b.image !== undefined) {
      // Prebuilt firmware the app downloads: on this site, with the file's real hash.
      assert.equal(p.firmware, "prebuilt", `${p.id}/${b.board}: only prebuilt firmware has an image`);
      assert.match(b.image.url, /^https:\/\/esp32bench\.dev\/firmware\//, `${p.id}/${b.board}: image url`);
      assert.match(b.image.sha256, /^[0-9a-f]{64}$/, `${p.id}/${b.board}: image sha256`);
      const local = "dist" + new URL(b.image.url).pathname;
      const bytes = readFileSync(local);
      assert.equal(bytes.length, b.image.size, `${p.id}/${b.board}: image size`);
      assert.equal(createHash("sha256").update(bytes).digest("hex"), b.image.sha256, `${p.id}/${b.board}: image hash`);
    }
    const text = [b.code ?? "", ...b.pins, ...b.sample, ...b.wiring.flatMap((w: any) => [w.from, w.to, w.note])].join("\n");
    assert.doesNotMatch(text, unfilled, `${p.id}/${b.board}: a %VAR% was left unfilled`);
  }
}
console.log(`desktop manifest ${m.version}: ${m.projects.length} projects, ${m.boards.length} boards valid`);
