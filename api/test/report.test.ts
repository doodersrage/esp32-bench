// Run: node --experimental-strip-types test/report.test.ts
import assert from "node:assert/strict";
import { checkReport, subjectFor, textFor, htmlFor, MIN_FILL_MS } from "../src/report.ts";

const now = 1_800_000_000_000;
const base = { kind: "build", project: "DHT22 climate logger", board: "ESP32-DevKitC V4", result: "Yes, as described", t: now - 10_000, website: "" };

let r = checkReport(base, now);
assert.ok(r.ok, "valid build report passes");
assert.equal(checkReport({ ...base, website: "http://spam" }, now).ok, false);
assert.equal((checkReport({ ...base, website: "x" }, now) as { spam?: boolean }).spam, true, "honeypot is silent spam");
assert.equal(checkReport({ ...base, t: now - MIN_FILL_MS + 500 }, now).ok, false, "too fast");
assert.equal(checkReport({ ...base, t: "nope" }, now).ok, false, "missing timestamp");
assert.equal(checkReport({ ...base, board: "" }, now).ok, false, "build needs a board");
assert.equal(checkReport({ ...base, kind: "admin" }, now).ok, false, "unknown kind");
assert.equal(checkReport({ ...base, notes: "x".repeat(4001) }, now).ok, false, "too long");
assert.equal(checkReport({ ...base, email: "not-an-email" }, now).ok, false, "bad email");
assert.ok(checkReport({ ...base, email: "maker@example.com" }, now).ok, "good email");
assert.equal(checkReport({ kind: "correction", page: "/boards/", notes: "", t: now - 9000 }, now).ok, false, "correction needs text");
assert.ok(checkReport({ kind: "message", notes: "Love the site", t: now - 9000 }, now).ok, "message passes");
assert.equal(checkReport(null, now).ok, false);

r = checkReport({ ...base, project: "Evil\r\nBcc: x@y.z", notes: "<script>alert(1)</script>", output: "rst:0x1" }, now);
assert.ok(r.ok);
if (r.ok) {
  const subject = subjectFor(r.report);
  assert.ok(!/[\r\n]/.test(subject), "no header injection in subject");
  const text = textFor(r.report, { country: "US", agent: "test" });
  assert.match(text, /Serial output:\nrst:0x1/);
  assert.ok(!htmlFor(text).includes("<script>"), "html is escaped");
}
console.log("report validation: all checks pass");
