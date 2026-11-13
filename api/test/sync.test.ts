// Run: node --experimental-strip-types test/sync.test.ts
import assert from "node:assert/strict";
import { checkSyncData, codeFrom, newSyncCode, normaliseCode } from "../src/sync.ts";

// Codes: 4 groups of 4 Crockford base32 characters, random each time.
const a = newSyncCode();
assert.match(a, /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
assert.notEqual(a, newSyncCode());
assert.equal(normaliseCode(a), a, "a fresh code is already canonical");

// Typing is forgiving: case, spaces, missing dashes, O for 0, I and L for 1.
assert.equal(normaliseCode("7kq4 m2xd 9pqa r3tw"), "7KQ4-M2XD-9PQA-R3TW");
assert.equal(normaliseCode("7KQ4M2XD9PQAR3TW"), "7KQ4-M2XD-9PQA-R3TW");
assert.equal(normaliseCode("OKQ4-M2XD-9PQA-R3TI"), "0KQ4-M2XD-9PQA-R3T1");
assert.equal(normaliseCode("lKQ4-M2XD-9PQA-R3TW"), "1KQ4-M2XD-9PQA-R3TW");
// But not too forgiving.
assert.equal(normaliseCode("7KQ4-M2XD-9PQA"), null, "too short");
assert.equal(normaliseCode("7KQ4-M2XD-9PQA-R3TWX"), null, "too long");
assert.equal(normaliseCode("7KQ4-M2XD-9PQA-R3TU"), null, "U is not in the alphabet");
assert.equal(normaliseCode(42), null);
assert.equal(normaliseCode("x".repeat(100)), null);

// Bearer header.
const req = (auth?: string) => new Request("https://api.example/sync", auth ? { headers: { Authorization: auth } } : {});
assert.equal(codeFrom(req(`Bearer ${a.toLowerCase()}`)), a);
assert.equal(codeFrom(req()), null);
assert.equal(codeFrom(req(`Basic ${a}`)), null);
assert.equal(codeFrom(req("Bearer nope")), null);

// Data: known keys only, strings only, size limits.
let r = checkSyncData({ built: '{"blink":{"at":"2026-11-13T00:00:00Z"}}', shop: '["dht22"]', sort: "name", extra: "x" });
assert.ok(r.ok);
assert.deepEqual(Object.keys(r.data).sort(), ["built", "shop"], "unknown keys are dropped");
assert.ok(checkSyncData({}).ok, "empty is fine");
assert.ok(checkSyncData({ board: null }).ok, "null means absent");
assert.equal(checkSyncData({ built: 5 }).ok, false);
assert.equal(checkSyncData([]).ok, false);
assert.equal(checkSyncData("x").ok, false);
assert.equal(checkSyncData({ built: "x".repeat(48_001) }).ok, false, "one value too long");
assert.equal(checkSyncData({ built: "x".repeat(40_000), shop: "y".repeat(40_000) }).ok, false, "total too long");

console.log("sync tests passed");
