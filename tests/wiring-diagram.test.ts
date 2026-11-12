// Run after a build with the wiring export:
//   DUMP_WIRING=1 npx astro build && node --experimental-strip-types tests/wiring-diagram.test.ts
// Checks every project on every board: each wiring row is drawn or listed, never
// dropped; every drawn pad exists on that board's header; and the layout has no
// wires starting or ending in the wrong place.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { findPad, layout, parseWiring, splitPart, type WiringRow } from "../src/lib/wiring-diagram.ts";

// Unit checks on the splitter and pad finder.
assert.deepEqual(splitPart("DHT22 VCC"), ["DHT22", "VCC"]);
assert.deepEqual(splitPart("LCD 4 RS"), ["LCD", "4 RS"]);
assert.deepEqual(splitPart("Green LED"), ["Green LED", ""]);
assert.deepEqual(splitPart("Button, side A"), ["Button", "side A"]);
assert.deepEqual(splitPart("Servo orange or yellow (signal)"), ["Servo", "orange or yellow (signal)"]);
assert.deepEqual(splitPart("ESP32 nRF24 SCK"), ["nRF24", "SCK"]);
const esp32 = { left: ["3V3", "EN", "VP", "VN", "34", "GND"], right: ["GND", "23", "22"], gpioOf: { VP: 36, VN: 39 } };
assert.equal(findPad("GPIO 36", esp32)?.header, "VP");
assert.equal(findPad("GPIO 36", esp32)?.label, "GPIO 36");
assert.equal(findPad("GPIO 22", esp32)?.side, "right");
assert.equal(findPad("GPIO 99", esp32), null);
assert.equal(findPad("U0R (GPIO 34)", esp32)?.header, "34");

interface Dump {
  id: string;
  board: string;
  left: string[];
  right: string[];
  gpioOf: Record<string, number>;
  wiring: WiringRow[];
}
const dump: Dump[] = JSON.parse(readFileSync("dist/wiring-dump/all.json", "utf8"));
let panels = 0;
let drawnTotal = 0;
let listedTotal = 0;
const listedWhy: Record<string, number> = {};
const perProject: string[] = [];

for (const d of dump) {
  if (d.wiring.length === 0) continue;
  if (d.left.length === 0) continue; // no header on file (ESP32-CAM): no diagram, the table stands alone
  panels++;
  const header = { left: d.left, right: d.right, gpioOf: d.gpioOf };
  const model = parseWiring(d.wiring, header);
  const drawn = new Set(model.wires.map((w) => w.row));
  const listed = new Set(model.listed.map((l) => l.row));
  d.wiring.forEach((row, i) => {
    assert.ok(drawn.has(i) || listed.has(i), `${d.id}@${d.board}: row ${i} "${row[0]} → ${row[1]}" was dropped`);
  });
  for (const l of model.listed) listedWhy[l.why] = (listedWhy[l.why] ?? 0) + 1;
  assert.equal(model.listed.filter((l) => l.why === "no-pad").length, 0, `${d.id}@${d.board}: a GPIO missing from the header`);
  // Every drawn pad is on this board's header.
  const headerLabels = new Set([...d.left, ...d.right]);
  for (const p of model.pads) assert.ok(headerLabels.has(p.header), `${d.id}@${d.board}: pad ${p.header} not on the header`);
  // Steps cover every row once.
  assert.deepEqual([...model.steps.map((s) => s.row)].sort((a, b) => a - b), d.wiring.map((_, i) => i), `${d.id}@${d.board}: steps`);
  // Power and ground steps come first.
  const firstSignal = model.steps.findIndex((s) => !s.pads.every((p) => ["3V3", "5V", "GND"].includes(p)) || !s.drawn);
  assert.ok(model.steps.slice(firstSignal).every((s) => !s.drawn || !s.pads.every((p) => ["3V3", "5V", "GND"].includes(p)) || s.pads.length === 0), `${d.id}@${d.board}: power steps first`);

  // Layout: every wire starts at its pad or part and ends on a part pin.
  const lay = layout(model);
  for (const w of lay.wires) {
    const m = /^M(\d+(?:\.\d+)?) (\d+(?:\.\d+)?)/.exec(w.d)!;
    if ("pad" in w.wire.to) {
      const pad = lay.pads.find((p) => p.pad.header === (w.wire.to as { pad: string }).pad)!;
      assert.equal(Number(m[2]), pad.y, `${d.id}@${d.board}: wire starts at its pad`);
    }
    const part = lay.parts.find((p) => p.part.name === w.wire.part)!;
    assert.ok(part, `${d.id}@${d.board}: part ${w.wire.part} placed`);
    assert.ok(Number.isFinite(w.end.y), `${d.id}@${d.board}: wire end`);
  }
  // Parts do not overlap each other.
  const boxes = [...lay.parts].sort((a, b) => a.y - b.y);
  for (let i = 1; i < boxes.length; i++) assert.ok(boxes[i].y >= boxes[i - 1].y + boxes[i - 1].h, `${d.id}@${d.board}: parts overlap`);
  drawnTotal += drawn.size;
  listedTotal += listed.size;
  if (d.board === "esp32" || !dump.some((x) => x.id === d.id && x.board === "esp32")) {
    perProject.push(`${d.id}: ${drawn.size} drawn, ${listed.size} listed`);
  }
}
console.log(perProject.join("\n"));
console.log(`wiring diagrams: ${panels} project×board panels, ${drawnTotal} rows drawn, ${listedTotal} listed ${JSON.stringify(listedWhy)}; all checks pass`);
