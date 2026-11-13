// Run: node --experimental-strip-types test/builds.test.ts
import assert from "node:assert/strict";
import { checkReport } from "../src/report.ts";
import { moderationPage, newToken, publicBuild, sameHash, sha256, summarise, type BuildRow } from "../src/builds.ts";

const now = 1_800_000_000_000;
const base = { kind: "build", project: "DHT22 climate logger", projectId: "dht22", board: "ESP32-DevKitC V4", result: "Yes, as described", t: now - 10_000 };

// Publishing is opt-in and only for build reports.
let r = checkReport(base, now);
assert.ok(r.ok && r.report.publish === false, "not published unless asked");
r = checkReport({ ...base, publish: "true" }, now);
assert.ok(r.ok && r.report.publish === false, "only a real true counts");
r = checkReport({ ...base, publish: true, publicName: "Rob" }, now);
assert.ok(r.ok && r.report.publish && r.report.publicName === "Rob");
r = checkReport({ kind: "message", notes: "hi", publish: true, t: now - 9000 }, now);
assert.ok(r.ok && r.report.publish === false, "messages are never published");
assert.equal(checkReport({ ...base, projectId: "../etc" }, now).ok, false, "project id must be a slug");
assert.equal(checkReport({ ...base, projectId: "", publish: true }, now).ok, false, "publishing needs a project");
assert.equal(checkReport({ ...base, publicName: "x".repeat(41) }, now).ok, false, "public name length");

// Tokens: random, URL-safe, stored only as a hash.
const a = await newToken();
const b = await newToken();
assert.match(a.token, /^[A-Za-z0-9_-]{32}$/);
assert.notEqual(a.token, b.token);
assert.equal(a.hash, await sha256(a.token));
assert.ok(sameHash(a.hash, await sha256(a.token)));
assert.ok(!sameHash(a.hash, b.hash));
assert.ok(!sameHash(a.hash, a.hash.slice(1)));

// Public view: no ids, tokens or exact times; name falls back to Anonymous.
const row: BuildRow = {
	id: 7, project: "dht22", board: "ESP32-C3", core: "3.3.12", result: "No", output: "rst:0x1", notes: "<b>hi</b>",
	public_name: "", created_at: "2026-11-12T16:00:00.000Z", status: "approved",
};
const pub = publicBuild(row);
assert.deepEqual(Object.keys(pub).sort(), ["board", "core", "date", "name", "notes", "output", "result", "worked"]);
assert.equal(pub.name, "Anonymous");
assert.equal(pub.date, "2026-11-12");
assert.equal(pub.worked, false);
assert.equal(publicBuild({ ...row, result: "Yes, after a change" }).worked, true);

// The compatibility table's counts.
const cells = summarise([
  { project: "dht22", board: "ESP32-DevKitC V4, 38 pin", result: "Yes, as described" },
  { project: "dht22", board: "ESP32-DevKitC V4, 38 pin", result: "No, it did not work" },
  { project: "dht22", board: "ESP32-DevKitC V4, 38 pin", result: "Yes, after a change" },
  { project: "oled", board: "ESP32-C3 SuperMini", result: "No" },
]);
assert.deepEqual(cells.find((c) => c.project === "dht22"), { project: "dht22", board: "ESP32-DevKitC V4, 38 pin", worked: 2, failed: 1 });
assert.deepEqual(cells.find((c) => c.project === "oled"), { project: "oled", board: "ESP32-C3 SuperMini", worked: 0, failed: 1 });
assert.equal(cells.length, 2);

// Moderation page: escaped, buttons post, nothing approves on GET.
const html = moderationPage({ ...row, status: "pending", public_name: "<script>x</script>" }, "tok", "dht22");
assert.ok(!html.includes("<script>x"), "escaped");
assert.match(html, /<form method="post">/);
assert.match(html, /value="approve"/);
console.log("build reports: all checks pass");
