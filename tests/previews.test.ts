// Run: node --experimental-strip-types tests/previews.test.ts
import assert from "node:assert/strict";
import { Framebuffer, OLED_H, OLED_W, glyph } from "../src/lib/preview/oled.ts";
import {
  FIRE, IR, MorseDecoder, PONG, SEGMENTS, SimonGame, colorHSV, fireStep, heatColor, irCmToVolts, irVoltsToCm,
  lavaColors, pips, pongServe, pongStep, simonSpeed, thereminHz, tumble, type PongState,
} from "../src/lib/preview/logic.ts";

// A small deterministic random source (mulberry32).
function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Font and framebuffer ----------
{
  // Every printable character has 5 columns of at most 8 rows, inside its 6 x 8 cell. Only the
  // descender letters g, j, p, q and y use the 8th row, as in Adafruit GFX's font.
  for (let c = 0x20; c <= 0x7e; c++) {
    const ch = String.fromCharCode(c);
    const g = glyph(ch);
    assert.equal(g.length, 5, `glyph ${c}`);
    for (const col of g) {
      assert.ok(col >= 0 && col <= 0xff, `glyph ${c}`);
      if (!"gjpqy".includes(ch)) assert.ok(col < 0x80, `glyph ${ch} uses the descender row`);
    }
  }
  assert.ok(glyph("g").some((col) => col >= 0x80), "g has a descender");
  assert.equal(glyph(" ").every((x) => x === 0), true);
  assert.ok(glyph("A").some((x) => x !== 0));
  assert.notDeepEqual(glyph("O"), glyph("0"));
  assert.notDeepEqual(glyph("°"), glyph("o"));

  const fb = new Framebuffer();
  fb.textSize = 2;
  fb.setCursor(0, 0);
  fb.println("ESP32");
  // Size-2 text: 5 characters x 12 px wide, 16 px high, nothing outside that box.
  for (let y = 0; y < OLED_H; y++) for (let x = 0; x < OLED_W; x++) if (fb.get(x, y)) assert.ok(x < 60 && y < 16, `pixel ${x},${y}`);
  assert.equal(fb.cursorY, 16);
  assert.ok(fb.litCount() > 50);
  assert.equal(Framebuffer.textWidth("RIGHT WINS", 2), 120);

  // Drawing off the screen never throws or wraps.
  fb.clear();
  fb.fillRect(-10, -10, 300, 300);
  assert.equal(fb.litCount(), OLED_W * OLED_H);
  fb.invert();
  assert.equal(fb.litCount(), 0);

  // A die outline plus pips stays inside the die.
  fb.clear();
  fb.drawRoundRect(12, 10, 44, 44, 6);
  for (const [x, y] of pips(6, 12, 10)) fb.fillCircle(x, y, 4);
  for (let y = 0; y < OLED_H; y++) for (let x = 0; x < OLED_W; x++) if (fb.get(x, y)) assert.ok(x >= 12 && x < 56 && y >= 10 && y < 54);
}

// ---------- Dice ----------
{
  for (let v = 1; v <= 6; v++) assert.equal(pips(v).length, v, `face ${v} has ${v} pips`);
  // Opposite corners and the centre, as the sketch draws them.
  assert.deepEqual(pips(1), [[22, 22]]);
  assert.deepEqual(pips(2), [[11, 11], [33, 33]]);
  // The tumble: 10 frames from 30 to 210 ms, faces 1..6, roughly uniform over many rolls.
  const rand = seeded(7);
  const frames = tumble(rand, 2);
  assert.deepEqual(frames.map((f) => f.wait), [30, 50, 70, 90, 110, 130, 150, 170, 190, 210]);
  const counts = new Array(7).fill(0);
  for (let i = 0; i < 6000; i++) for (const f of tumble(rand, 1).at(-1)!.faces) counts[f]++;
  assert.equal(counts[0], 0);
  for (let v = 1; v <= 6; v++) assert.ok(counts[v] > 850 && counts[v] < 1150, `face ${v}: ${counts[v]}`);
}

// ---------- Simon ----------
{
  const game = new SimonGame(seeded(3));
  let seq = game.nextRound();
  assert.equal(seq.length, 1);
  assert.ok(seq[0] >= 0 && seq[0] < 4);
  assert.equal(game.press(seq[0]), "round");
  seq = game.nextRound();
  assert.equal(seq.length, 2);
  assert.equal(game.press(seq[0]), "ok");
  assert.equal(game.press((seq[1] + 1) % 4), "wrong");
  assert.equal(game.end(), 1, "score is rounds completed");
  assert.equal(game.best, 1);
  assert.equal(game.sequence.length, 0);
  assert.equal(new SimonGame(seeded(1), 5).best, 5);
  assert.equal(simonSpeed(1), 435);
  assert.equal(simonSpeed(10), 300);
  assert.equal(simonSpeed(40), 150, "never faster than 150 ms");
}

// ---------- Morse ----------
{
  // Key "SOS" at 100 ms dots (dash 300 ms, gaps 100 / 300 / 700 ms) and decode it.
  const d = new MorseDecoder();
  let t = 1000;
  const key = (ms: number, gap: number) => {
    d.key(true, t);
    t += ms;
    d.key(false, t);
    for (let g = 0; g < gap; g += 10) {
      t += 10;
      d.tick(t);
    }
  };
  for (const [ms, gap] of [[100, 100], [100, 100], [100, 400], [300, 100], [300, 100], [300, 400], [100, 100], [100, 100], [100, 900]]) key(ms, gap);
  assert.equal(d.text.trim(), "SOS");
  assert.ok(d.unit > 80 && d.unit < 125, `unit adapted to ~100 ms: ${d.unit}`);
  assert.ok(d.wpm >= 10 && d.wpm <= 15);
  // A bounce shorter than 15 ms is ignored.
  const e = new MorseDecoder();
  assert.equal(e.key(true, 100), null);
  assert.equal(e.key(false, 105), null);
}

// ---------- Fire and colours ----------
{
  const rand = seeded(11);
  const heat = new Uint8Array(30);
  for (let i = 0; i < 2000; i++) {
    fireStep(heat, rand);
    for (const h of heat) assert.ok(h >= 0 && h <= 255);
  }
  assert.ok(heat.some((h) => h > 0), "the fire is burning");
  assert.equal(FIRE.COOLING, 55);
  assert.deepEqual(heatColor(0), [0, 0, 0]);
  assert.deepEqual(heatColor(255), [255, 255, 252]);
  assert.deepEqual(colorHSV(0), [255, 0, 0]);
  assert.deepEqual(colorHSV(21845), [0, 255, 0]);
  assert.deepEqual(colorHSV(43690), [0, 0, 255]);
  for (const [r, g, b] of lavaColors(30, 12.3)) for (const v of [r, g, b]) assert.ok(v >= 0 && v <= 255);
}

// ---------- Theremin ----------
{
  assert.equal(thereminHz(4), 0, "too near: silence");
  assert.equal(thereminHz(61), 0, "too far: silence");
  assert.equal(thereminHz(60), 220, "far end is A3");
  assert.equal(thereminHz(5), 1760, "near end is A6");
  assert.equal(thereminHz(32.5, false), 622);
  assert.equal(thereminHz(32.5, true), 622, "snapped to D#5");
}

// ---------- Pong ----------
{
  const rand = seeded(5);
  const s: PongState = { ballX: 0, ballY: 0, velX: 0, velY: 0, leftY: 25, rightY: 25, scoreLeft: 0, scoreRight: 0 };
  pongServe(s, 1, rand);
  assert.equal(s.ballX, 64);
  assert.equal(s.velX, 1.6);
  // With the left paddle parked at the top, the computer eventually scores; the ball stays in bounds.
  s.leftY = 0;
  let points = 0;
  for (let i = 0; i < 20000 && points < 3; i++) {
    if (pongStep(s, rand)) points++;
    assert.ok(s.ballY > -5 && s.ballY < PONG.H + 5);
    assert.ok(Math.abs(s.velX) <= 4);
  }
  assert.equal(points, 3);
  assert.ok(s.scoreRight > 0);
}

// ---------- Visitor counter and IR ----------
{
  const lit = (d: number) => [...Array(7).keys()].filter((b) => (SEGMENTS[d] >> b) & 1).length;
  assert.deepEqual([...Array(10).keys()].map(lit), [6, 2, 5, 5, 4, 5, 6, 3, 7, 6]);
  for (const cm of [10, 20, 37, 60, 80]) assert.ok(Math.abs(irVoltsToCm(irCmToVolts(cm)) - cm) < 0.01);
  assert.equal(irVoltsToCm(0.2), IR.MAX_CM + 1, "nothing in range");
}

console.log("previews: all checks pass");
