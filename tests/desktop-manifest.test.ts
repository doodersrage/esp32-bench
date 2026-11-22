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

// The format, as published at its $id (public/schema/, copied from esp32-desktop by
// scripts/sync-schemas.mjs): what the site generates must match what it publishes.
{
  const { default: Ajv2020 } = await import("ajv/dist/2020.js");
  const schema = JSON.parse(readFileSync("public/schema/project-manifest/v1.schema.json", "utf8"));
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  assert.ok(validate(m), `desktop manifest does not match its schema: ${JSON.stringify(validate.errors?.slice(0, 5))}`);
}

// 1.3: each board's pins and the part catalogue.
const catalogue = new Set<string>();
for (const part of m.parts ?? []) {
  assert.ok(!catalogue.has(part.id), `part ${part.id} listed twice`);
  catalogue.add(part.id);
}
for (const b of m.boards) {
  assert.ok(b.pins, `board ${b.id}: pins`);
  assert.ok(b.pins.i2c, `board ${b.id}: I2C pins`);
  assert.equal(new Set(b.pins.safe).size, b.pins.safe.length, `board ${b.id}: a safe pin listed twice`);
}

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
  for (const set of p.needs ?? [])
    for (const id of set) assert.ok(catalogue.has(id), `${p.id}: needs ${id}, which the part catalogue lacks`);
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
// The output explanations: each pattern compiles, keys are unique, pages are the site's.
const keys = new Set<string>();
for (const r of m.explain ?? []) {
  new RegExp(r.pattern, r.flags ?? "");
  assert.ok(!keys.has(r.key), `explain ${r.key} twice`);
  keys.add(r.key);
  assert.ok(["problem", "info"].includes(r.level), `explain ${r.key}: level`);
  if (r.url) assert.match(r.url, /^https:\/\/esp32bench\.dev\/errors\/[a-z0-9-]+\/$/, `explain ${r.key}: url`);
  // No lookaround or backreferences: the app reads these with Rust's regex crate.
  assert.doesNotMatch(r.pattern, /\(\?[=!<]|\\[1-9]/, `explain ${r.key}: a pattern the app cannot read`);
}
assert.ok(keys.has("panic-load") && keys.has("brownout"), "explain: crash rules are there");
// The app's latest release, which older apps offer: the version /desktop/ links to.
assert.match(m.desktop.version, /^[0-9]+\.[0-9]+\.[0-9]+$/, "desktop: version");
const offered = /export const DESKTOP = \{\s*version: "([^"]+)"/.exec(readFileSync("src/lib/site.ts", "utf8"))?.[1];
assert.equal(m.desktop.version, offered, "desktop: the release /desktop/ offers");
assert.equal(m.desktop.url, "https://esp32bench.dev/desktop/", "desktop: url");

console.log(`desktop manifest ${m.version}: ${m.projects.length} projects, ${m.boards.length} boards valid`);
