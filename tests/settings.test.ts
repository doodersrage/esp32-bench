// Run: node --experimental-strip-types tests/settings.test.ts
// With a DUMP_SKETCHES=1 build it also checks every sketch's BENCH_KEYS against its settings.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  encodeSet,
  encodeUnset,
  missingRequired,
  parseBoardLine,
  planSends,
  QUERY_LINE,
  SAVE_LINE,
} from "../src/lib/settings-protocol.ts";

type S = { key: string; label: string; kind: "text" | "password" | "url" | "number"; required?: boolean };
const settings: S[] = [
  { key: "wifi_ssid", label: "Wi-Fi", kind: "text", required: true },
  { key: "wifi_pass", label: "Password", kind: "password" },
  { key: "share_url", label: "Link", kind: "url", required: true },
];

// Board lines
assert.deepEqual(parseBoardLine("SETTINGS\twifi_ssid=set\twifi_pass=unset\tshare_url=set\r"), {
  type: "settings",
  stored: { wifi_ssid: true, wifi_pass: false, share_url: true },
});
assert.deepEqual(parseBoardLine("SETTINGS"), { type: "settings", stored: {} });
assert.deepEqual(parseBoardLine("SETUP\twaiting"), { type: "waiting" });
assert.equal(parseBoardLine("SETUP\tsomething"), null);
assert.deepEqual(parseBoardLine("OK\twifi_ssid"), { type: "ok", key: "wifi_ssid" });
assert.equal(parseBoardLine("OK\t../x"), null);
assert.deepEqual(parseBoardLine("ERR\tunknown key\tfoo"), { type: "err", message: "unknown key", key: "foo" });
assert.deepEqual(parseBoardLine("SAVED"), { type: "saved" });
assert.equal(parseBoardLine("SAVED\textra"), null);
assert.equal(parseBoardLine("wifi ok 192.168.1.5"), null, "ordinary output is ignored");
assert.equal(parseBoardLine("Wi-Fi name not set: use the settings form on the project page or edit WIFI_SSID in the sketch"), null);

// Framing
assert.deepEqual(encodeSet("wifi_ssid", "My Network 5"), { ok: true, line: "SET\twifi_ssid\tMy Network 5\n" });
assert.deepEqual(encodeSet("wifi_pass", " spaced "), { ok: true, line: "SET\twifi_pass\t spaced \n" }, "passwords keep their spaces");
assert.equal(encodeSet("wifi_ssid", "a\tb").ok, false, "tabs rejected");
assert.equal(encodeSet("wifi_ssid", "a\nb").ok, false, "newlines rejected");
assert.equal(encodeSet("Wifi", "x").ok, false, "bad key rejected");
assert.equal(encodeSet("wifi_ssid", "x".repeat(241)).ok, false, "too long rejected");
assert.deepEqual(encodeUnset("tz_rule"), { ok: true, line: "UNSET\ttz_rule\n" });
assert.equal(QUERY_LINE, "SETTINGS?\n");
assert.equal(SAVE_LINE, "SAVE\n");

// Required keys: missing only when neither typed nor stored
assert.deepEqual(
  missingRequired(settings, { wifi_ssid: "", share_url: "" }, {}).map((s) => s.key),
  ["wifi_ssid", "share_url"],
);
assert.deepEqual(missingRequired(settings, { wifi_ssid: "Home" }, { share_url: true }), []);
assert.deepEqual(missingRequired(settings, { wifi_ssid: "   " }, { wifi_ssid: false, share_url: true }).map((s) => s.key), ["wifi_ssid"], "blank counts as not typed");

// Plan: empty fields are left alone, text is trimmed, passwords are not
const plan = planSends(settings, { wifi_ssid: " Home ", wifi_pass: " p w ", share_url: "" });
assert.deepEqual(plan, [
  { ok: true, line: "SET\twifi_ssid\tHome\n" },
  { ok: true, line: "SET\twifi_pass\t p w \n" },
]);

// Every sketch with settings carries the block with exactly those keys, and no other sketch has it.
const dump = "dist/sketch-dump/all.json";
if (existsSync(dump)) {
  type Row = { id: string; board: string; code: string; settings?: S[] };
  const rows = JSON.parse(readFileSync(dump, "utf8")) as Row[];
  let withBlock = 0;
  const seen = new Set<string>();
  for (const r of rows) {
    const m = /const char\* BENCH_KEYS\[\] = \{([^}]*)\};/.exec(r.code);
    const keys = m ? [...m[1].matchAll(/"([a-z0-9_]+)"/g)].map((x) => x[1]) : null;
    const wanted = r.settings?.map((x) => x.key) ?? null;
    assert.deepEqual(keys, wanted, `${r.id}@${r.board}: BENCH_KEYS must match settings`);
    if (keys) {
      withBlock++;
      seen.add(r.id);
      assert.ok(r.code.includes("benchSettingsBoot();"), `${r.id}: boot window missing`);
      assert.ok(r.code.includes("benchSettingsPoll();"), `${r.id}: loop poll missing`);
      assert.ok(!/const char\* BENCH_KEYS\[\] = \{\};/.test(r.code), `${r.id}: empty key list`);
      assert.equal((r.code.match(/ESP32 Bench settings block/g) ?? []).length, 1, `${r.id}: block once`);
      for (const k of keys) assert.ok(r.code.includes(`benchSetting("${k}"`), `${r.id}: ${k} is never read`);
    } else {
      assert.ok(!r.code.includes("benchSetting"), `${r.id}: has settings code but no settings`);
    }
  }
  console.log(`sketch export: ${withBlock} sketch×board combinations in ${seen.size} projects carry the settings block`);
}
console.log("settings protocol: all checks pass");
