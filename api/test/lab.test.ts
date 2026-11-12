// Run: node --experimental-strip-types test/lab.test.ts
import assert from "node:assert/strict";
import { checkLabRun, publicLab, tail, tokenMatches, MAX_OUTPUT } from "../src/lab.ts";

const result = { project: "blink", board: "esp32", chip: "esp32", status: "passed", seconds: 8, matched: ["tick \\d+ ms"], missing: [], output: "tick 1000 ms\ntick 2000 ms" };
const run = { runner: "garage-pi", started_at: "2026-11-12T20:00:00Z", finished_at: "2026-11-12T20:30:00Z", core: "3.3.12", firmware_built_at: "2026-11-12T07:00:00Z", results: [result] };

let c = checkLabRun(run);
assert.ok(c.ok, "valid run accepted");
assert.equal(c.ok && c.run.results[0].status, "passed");
assert.equal(checkLabRun(null).ok, false);
assert.equal(checkLabRun({ ...run, results: [] }).ok, false, "needs results");
assert.equal(checkLabRun({ ...run, started_at: "yesterday" }).ok, false, "iso times");
assert.equal(checkLabRun({ ...run, results: [{ ...result, project: "../x" }] }).ok, false, "project slug");
assert.equal(checkLabRun({ ...run, results: [{ ...result, status: "great" }] }).ok, false, "status enum");
assert.equal(checkLabRun({ ...run, results: [{ ...result, seconds: -1 }] }).ok, false, "seconds range");
assert.equal(checkLabRun({ ...run, results: [{ ...result, matched: "x" }] }).ok, false, "matched is an array");
c = checkLabRun({ ...run, results: [{ ...result, output: "x".repeat(MAX_OUTPUT + 500) }] });
assert.ok(c.ok && c.run.results[0].output.length === MAX_OUTPUT, "output is trimmed to the last MAX_OUTPUT chars");
c = checkLabRun({ ...run, results: [{ ...result, output: "a\r\nb\rc" }] });
assert.ok(c.ok && c.run.results[0].output === "a\nb\nc", "line endings normalised");
assert.equal(checkLabRun({ ...run, runner: "x".repeat(61) }).ok, false, "runner length");

assert.ok(tokenMatches("abc", "abc"));
assert.ok(!tokenMatches("abc", "abd"));
assert.ok(!tokenMatches("", ""), "empty never matches");
assert.ok(!tokenMatches("abc", "abcd"));

assert.equal(tail("1\n2\n3\n4\n", 2), "3\n4");
assert.equal(tail("only", 20), "only");

const pub = publicLab(
	{ id: 7, finished_at: "2026-11-12T20:30:00Z", core: "3.3.12", firmware_built_at: "2026-11-12T07:00:00Z" },
	[{ project: "blink", board: "esp32", chip: "esp32", status: "failed", seconds: 8, matched: "[\"a\"]", missing: "[\"tick \\\\d+ ms\"]", output: Array.from({ length: 30 }, (_, i) => `line ${i}`).join("\n") }],
);
assert.deepEqual(Object.keys(pub.run).sort(), ["core", "finished_at", "firmware_built_at"]);
assert.ok(!("id" in pub.run), "no run id");
assert.deepEqual(Object.keys(pub.results[0]).sort(), ["board", "chip", "missing", "output", "seconds", "status"]);
assert.equal(pub.results[0].output.split("\n").length, 20, "only the last 20 lines");
assert.deepEqual(pub.results[0].missing, ["tick \\d+ ms"]);
assert.ok(!JSON.stringify(pub).includes("garage"), "no runner details");
console.log("lab runs: all checks pass");
