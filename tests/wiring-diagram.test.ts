// Run after a build with the wiring export:
//   DUMP_WIRING=1 npx astro build && node --experimental-strip-types tests/wiring-diagram.test.ts
// Checks every project on every board: each wiring row is drawn or listed, never
// dropped; every drawn pad exists on that board's header; and the layout has no
// wires starting or ending in the wrong place.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { findPad, firstPlacement, layout, overlaps, parseWiring, splitPart, type WiringRow } from "../src/lib/wiring-diagram.ts";

// Unit checks on the splitter and pad finder.
assert.deepEqual(splitPart("DHT22 VCC"), ["DHT22", "VCC"]);
assert.deepEqual(splitPart("LCD 4 RS"), ["LCD", "4 RS"]);
assert.deepEqual(splitPart("Green LED"), ["Green LED", ""]);
assert.deepEqual(splitPart("Button, side A"), ["Button", "side A"]);
assert.deepEqual(splitPart("Servo orange or yellow (signal)"), ["Servo", "orange or yellow (signal)"]);
assert.deepEqual(splitPart("ESP32 nRF24 SCK"), ["nRF24", "SCK"]);
assert.deepEqual(splitPart("Leak contact, wire A"), ["Leak contact", "wire A"]);
assert.deepEqual(splitPart("Green LED cathode"), ["Green LED", "cathode"]);
assert.deepEqual(splitPart("Left knob, other outer pin"), ["Left knob", "other outer pin"]);
assert.deepEqual(splitPart("Trimmer, outer pin"), ["Trimmer", "outer pin"]);
assert.deepEqual(splitPart("Encoder push switch, other leg"), ["Encoder", "push switch, other leg"]);
const esp32 = { left: ["3V3", "EN", "VP", "VN", "34", "GND"], right: ["GND", "23", "22"], gpioOf: { VP: 36, VN: 39 } };
assert.equal(findPad("GPIO 36", esp32)?.header, "VP");
assert.equal(findPad("GPIO 36", esp32)?.label, "GPIO 36");
assert.equal(findPad("GPIO 22", esp32)?.side, "right");
assert.equal(findPad("GPIO 99", esp32), null);
assert.equal(findPad("U0R (GPIO 34)", esp32)?.header, "34");

/**
 * Connections that live only in a note: "to GND", "from GPIO 4 to 3V3", "to 5V" in a
 * note need a drawn wire from that row's part to that pad, or someone following the
 * diagram and the steps would miss them. Rows on another board are not drawn here.
 */
function noteOnly(rows: readonly WiringRow[], model: ReturnType<typeof parseWiring>): string[] {
  const out: string[] = [];
  const otherBoard = new Set(model.listed.filter((l) => l.why === "other-board").map((l) => l.row));
  rows.forEach(([from, , note], i) => {
    if (otherBoard.has(i)) return;
    for (const m of note.matchAll(/\b(?:to|from)\s+(?:the\s+)?(GND|3V3|5 ?V)\b/gi)) {
      const pad = m[1].replace(" ", "").toUpperCase();
      const parts = new Set(model.wires.filter((w) => w.row === i).map((w) => w.part));
      const ok = model.wires.some((w) => parts.has(w.part) && "pad" in w.to && w.to.pad === pad);
      if (!ok) out.push(`row ${i} "${from}" says "${m[0]}" in its note, but no row draws it`);
    }
  });
  return out;
}

// The check catches the old Simon table, where the grounds were only in notes ...
const oldSimon: WiringRow[] = [
  ["Green LED, through 220 Ω", "GPIO 23", "LED cathodes to GND"],
  ["Green button", "GPIO 22", "Other side of each button to GND"],
];
assert.equal(noteOnly(oldSimon, parseWiring(oldSimon, esp32)).length, 2, "note-only grounds are caught");
// ... and passes once each ground is its own row.
const newSimon: WiringRow[] = [
  ["Green LED anode, through 220 Ω", "GPIO 23", ""],
  ["Green LED cathode", "GND", "Cathode to GND"],
];
assert.equal(noteOnly(newSimon, parseWiring(newSimon, esp32)).length, 0, "explicit rows pass");

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
const nudged: string[] = [];

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
  for (const v of noteOnly(d.wiring, model)) assert.fail(`${d.id}@${d.board}: ${v}`);

  // Steps cover every row once.
  assert.deepEqual([...model.steps.map((s) => s.row)].sort((a, b) => a - b), d.wiring.map((_, i) => i), `${d.id}@${d.board}: steps`);
  // Power and ground steps come first.
  const firstSignal = model.steps.findIndex((s) => !s.pads.every((p) => ["3V3", "5V", "GND"].includes(p)) || !s.drawn);
  assert.ok(model.steps.slice(firstSignal).every((s) => !s.drawn || !s.pads.every((p) => ["3V3", "5V", "GND"].includes(p)) || s.pads.length === 0), `${d.id}@${d.board}: power steps first`);

  // Layout: every wire starts at its pad or part and ends on a part pin.
  const lay = layout(model);
  for (const w of lay.wires) {
    if ("pad" in w.wire.to) {
      const padName = (w.wire.to as { pad: string }).pad;
      const pad = lay.pads.find((p) => p.pad.header === padName)!;
      assert.equal(w.geo?.padY, pad.y, `${d.id}@${d.board}: wire starts at its pad`);
      // A wire on a rail draws only its stub, and its pad's rail reaches it.
      const rail = lay.railPaths.find((r) => r.pad === padName);
      if (rail) {
        assert.ok(w.d.startsWith(`M${w.geo!.lane} ${w.geo!.pinY}`), `${d.id}@${d.board}: rail stub`);
        const ys = [...(rail.solid + rail.dashed).matchAll(/V(\d+(?:\.\d+)?)/g)].map((m) => +m[1]);
        const tops = [...(rail.solid + rail.dashed).matchAll(/M\S+ (\d+(?:\.\d+)?)V/g)].map((m) => +m[1]);
        const lo = Math.min(...tops, pad.y);
        const hi = Math.max(...ys, pad.y);
        assert.ok(lo <= w.geo!.pinY && w.geo!.pinY <= hi, `${d.id}@${d.board}: ${padName} rail reaches ${w.wire.part} ${w.wire.pin}`);
        assert.ok(rail.rows.includes(w.wire.row), `${d.id}@${d.board}: rail knows row ${w.wire.row}`);
        if (!w.wire.optional) assert.ok(rail.solid.length > 0, `${d.id}@${d.board}: a required wire on a solid rail`);
      }
    }
    const part = lay.parts.find((p) => p.part.name === w.wire.part)!;
    assert.ok(part, `${d.id}@${d.board}: part ${w.wire.part} placed`);
    assert.ok(Number.isFinite(w.end.y), `${d.id}@${d.board}: wire end`);
  }
  // No two different connections share a stretch of line (they would look joined).
  assert.deepEqual(overlaps(lay), [], `${d.id}@${d.board}: wires run along each other`);
  if (overlaps(firstPlacement(model)).length) nudged.push(`${d.id}@${d.board}`);
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
// The LCD readout's 5V pad sits level with a GND pin; the first placement drew them
// along one line, and nudging must have moved it.
assert.ok(nudged.includes("ph-lcd@esp32"), "the overlap check sees the ph-lcd clash before nudging");
console.log(`nudged to avoid shared lines: ${nudged.join(", ") || "none"}`);
console.log(`wiring diagrams: ${panels} project×board panels, ${drawnTotal} rows drawn, ${listedTotal} listed ${JSON.stringify(listedWhy)}; all checks pass`);
