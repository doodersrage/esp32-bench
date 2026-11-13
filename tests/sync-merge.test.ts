// Run: node --experimental-strip-types tests/sync-merge.test.ts
import assert from "node:assert/strict";
import { fingerprint, mergeSync, normaliseCode, plan, type SyncData } from "../src/lib/sync-merge.ts";

const built = (o: Record<string, string>) => JSON.stringify(Object.fromEntries(Object.entries(o).map(([id, at]) => [id, { at }])));

// Merging two copies that both changed loses nothing.
const phone: SyncData = { built: built({ blink: "2026-11-10T10:00:00Z", dht22: "2026-11-12T10:00:00Z" }), shop: '["simon"]', drawer: "oled,button", board: "esp32c3", seen: '["guru"]' };
const laptop: SyncData = { built: built({ blink: "2026-11-01T10:00:00Z", simon: "2026-11-13T10:00:00Z" }), shop: '["simon","neopixel"]', drawer: "button,dht22", board: "esp32s3", flashed: '["blink"]' };
const m = mergeSync(phone, laptop);
const b = JSON.parse(m.built!);
assert.deepEqual(Object.keys(b).sort(), ["blink", "dht22", "simon"]);
assert.equal(b.blink.at, "2026-11-01T10:00:00Z", "a project built on both keeps the earlier date");
assert.deepEqual(JSON.parse(m.shop!), ["simon", "neopixel"]);
assert.deepEqual(m.drawer!.split(",").sort(), ["button", "dht22", "oled"]);
assert.equal(m.board, "esp32s3", "the board is mine");
assert.deepEqual(JSON.parse(m.seen!), ["guru"]);
assert.deepEqual(JSON.parse(m.flashed!), ["blink"]);

// Empty and broken values do not throw or invent keys.
assert.deepEqual(mergeSync({}, {}), {});
assert.equal(mergeSync({ board: "esp32" }, {}).board, "esp32");
const junk = mergeSync({ built: "not json", shop: "{}" }, { built: built({ blink: "2026-11-01T00:00:00Z" }) });
assert.deepEqual(Object.keys(JSON.parse(junk.built!)), ["blink"]);
assert.deepEqual(JSON.parse(junk.shop!), []);

// Planning: who changed since the copy both sides last agreed on.
const base: SyncData = { shop: '["a"]' };
const agreed = fingerprint(base);
assert.equal(plan(base, base, agreed), "nothing");
assert.equal(plan(base, { shop: '["a","b"]' }, agreed), "push", "only this browser changed");
assert.equal(plan({ shop: '["a","c"]' }, base, agreed), "pull", "only the cloud changed");
assert.equal(plan({ shop: '["a","c"]' }, { shop: '["a","b"]' }, agreed), "merge", "both changed");
assert.equal(plan({ shop: '["x"]' }, { shop: '["x"]' }, agreed), "nothing", "both made the same change");
// A removal on one side alone is honoured, not undone by a union.
assert.equal(plan({}, base, agreed), "pull");
assert.equal(plan(base, {}, agreed), "push");

// Codes typed by hand.
assert.equal(normaliseCode("7kq4 m2xd 9pqa r3tw"), "7KQ4-M2XD-9PQA-R3TW");
assert.equal(normaliseCode("OKQ4M2XD9PQAR3TI"), "0KQ4-M2XD-9PQA-R3T1");
assert.equal(normaliseCode("7KQ4-M2XD"), null);

console.log("sync merge tests passed");
