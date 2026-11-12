// Run: node --experimental-strip-types test/checks.test.ts
import assert from "node:assert/strict";
import { CHECKS, decide, runChecks, type Result, type State } from "../src/checks.ts";

const ok = (name: string): Result => ({ name, ok: true, detail: "HTTP 200", ms: 50 });
const bad = (name: string): Result => ({ name, ok: false, detail: "HTTP 503", ms: 50 });
const t0 = new Date("2026-11-12T10:00:00Z");
const later = (min: number) => new Date(t0.getTime() + min * 60000);

// First run: a "started" email, state saved.
let r = decide(null, [ok("Home"), ok("API")], t0);
assert.equal(r.alert?.subject, "[ESP32 Bench] Monitoring started");
assert.equal(r.state.status, "up");
let s: State = r.state;

// Healthy runs: no email, no KV write.
r = decide(s, [ok("Home"), ok("API")], later(5));
assert.equal(r.alert, null);
assert.equal(r.changed, false, "no write when nothing changed");

// One blip: no email yet, but the counter is saved.
r = decide(s, [bad("Home"), ok("API")], later(10));
assert.equal(r.alert, null, "a single failure is not an outage");
assert.equal(r.state.status, "up");
assert.equal(r.changed, true);
s = r.state;

// Blip clears: no email.
r = decide(s, [ok("Home"), ok("API")], later(15));
assert.equal(r.alert, null);
s = r.state;

// Two failures in a row: DOWN email naming the check.
s = decide(s, [bad("API"), ok("Home")], later(20)).state;
r = decide(s, [bad("API"), ok("Home")], later(25));
assert.equal(r.alert?.subject, "[ESP32 Bench] DOWN: API");
assert.equal(r.state.status, "down");
s = r.state;

// Still down: no repeat email.
r = decide(s, [bad("API"), ok("Home")], later(30));
assert.equal(r.alert, null, "no repeat while down");
s = r.state;

// Recovery: one email with the duration.
r = decide(s, [ok("API"), ok("Home")], later(65));
assert.equal(r.alert?.subject, "[ESP32 Bench] Recovered");
assert.match(r.alert!.text, /about 40 minutes/);
assert.equal(r.state.status, "up");
assert.equal(r.state.downSince, undefined);

// runChecks: verify functions and errors, with a fake fetch.
const fake = (async (url: string) => {
	if (url.includes("search-index")) return new Response("{oops", { status: 200 });
	if (url.includes("api.")) return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "https://esp32bench.dev" } });
	if (url.includes("www.")) return new Response(null, { status: 301, headers: { Location: "https://esp32bench.dev/" } });
	if (url.includes("manifest")) throw new Error("connection refused");
	return new Response("<title>ESP32 Bench</title> DHT22", { status: 200 });
}) as unknown as typeof fetch;
const results = await runChecks(fake);
const by = Object.fromEntries(results.map((x) => [x.name, x]));
assert.equal(results.length, CHECKS.length);
assert.equal(by["Home page"].ok, true);
assert.equal(by["Report API"].ok, true);
assert.equal(by["www redirect"].ok, true);
assert.equal(by["Search index"].detail, "not valid JSON");
assert.equal(by["Firmware manifest"].detail, "connection refused");
console.log("monitor logic: all checks pass");
