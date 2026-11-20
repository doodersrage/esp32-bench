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

// 3D print reports: the part and the fit are required; the email names them as such.
const print = { kind: "print", project: "Robot car chassis plate", board: "Prusa MK4", core: "PETG", result: "Too tight", page: "https://esp32bench.dev/prints/#chassis-plate", notes: "Motor rails 0.3 mm tight", t: now - 9000 };
assert.equal(checkReport({ ...print, result: "" }, now).ok, false, "print needs a fit");
assert.equal(checkReport({ ...print, project: "" }, now).ok, false, "print needs a part");
const pr = checkReport(print, now);
assert.ok(pr.ok, "print report passes");
if (pr.ok) {
  assert.equal(subjectFor(pr.report), "[ESP32 Bench] 3D print report: Robot car chassis plate");
  const text = textFor(pr.report, { country: "US", agent: "test" });
  assert.match(text, /Part: Robot car chassis plate\nPrinter: Prusa MK4\nMaterial: PETG\nFit: Too tight/);
  assert.match(text, /Notes:\nMotor rails/);
  assert.equal(pr.report.publish, false, "print reports are never published");
}

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
