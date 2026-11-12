// Pure logic for the browser previews, written to match each project's sketch.
// No DOM here, so it can be unit-tested (tests/previews.test.ts).

export type Rand = () => number; // 0 <= r < 1, like Math.random

/** random(lo, hi) from Arduino: lo inclusive, hi exclusive. */
export const randomInt = (rand: Rand, lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo));

// ---------- Dice (dice sketch) ----------

/**
 * Pip positions for a face on a die of side S at (x, y), exactly as drawDie() in
 * the sketch: three columns and rows 11 px in from the edges, centre in the middle.
 */
export function pips(value: number, x = 0, y = 0, S = 44): [number, number][] {
  const a = x + 11, b = x + Math.floor(S / 2), c = x + S - 11;
  const d = y + 11, e = y + Math.floor(S / 2), f = y + S - 11;
  const out: [number, number][] = [];
  if (value % 2 === 1) out.push([b, e]);
  if (value >= 2) out.push([a, d], [c, f]);
  if (value >= 4) out.push([c, d], [a, f]);
  if (value === 6) out.push([a, e], [c, e]);
  return out;
}

/** The tumble: delays of 30, 50 ... 210 ms, a random face at each, as the sketch's loop. */
export function tumble(rand: Rand, dice = 2): { faces: number[]; wait: number }[] {
  const frames: { faces: number[]; wait: number }[] = [];
  for (let wait = 30; wait < 220; wait += 20) {
    frames.push({ faces: Array.from({ length: dice }, () => 1 + Math.floor(rand() * 6)), wait });
  }
  return frames;
}

// ---------- Simon (simon sketch) ----------

export const SIMON_TONES = [415, 310, 252, 209]; // green, red, yellow, blue
export const SIMON_MAX = 64;

/** Step length: max(150, 450 - length * 15) ms, so it speeds up as you go. */
export const simonSpeed = (length: number) => Math.max(150, 450 - length * 15);

export class SimonGame {
  sequence: number[] = [];
  position = 0; // how far the player has repeated
  best: number;
  over = false;
  private rand: Rand;

  constructor(rand: Rand, best = 0) {
    this.rand = rand;
    this.best = best;
  }

  /** Add a step (the sketch's sequence[length++] = random(4)). */
  nextRound(): number[] {
    if (this.sequence.length >= SIMON_MAX) return this.sequence;
    this.sequence.push(randomInt(this.rand, 0, 4));
    this.position = 0;
    this.over = false;
    return this.sequence;
  }

  /** A button press: "ok", "round" when the whole sequence was repeated, or "wrong". */
  press(button: number): "ok" | "round" | "wrong" {
    if (this.over || this.sequence.length === 0) return "wrong";
    if (button !== this.sequence[this.position]) return "wrong";
    this.position++;
    return this.position === this.sequence.length ? "round" : "ok";
  }

  /** Game over: the score is the rounds completed, length - 1, as gameOver(length - 1). */
  end(): number {
    const score = Math.max(0, this.sequence.length - 1);
    if (score > this.best) this.best = score;
    this.over = true;
    this.sequence = [];
    this.position = 0;
    return score;
  }
}

// ---------- Morse (morse-decoder sketch) ----------

export const MORSE: Record<string, string> = {
  ".-": "A", "-...": "B", "-.-.": "C", "-..": "D", ".": "E", "..-.": "F", "--.": "G", "....": "H", "..": "I",
  ".---": "J", "-.-": "K", ".-..": "L", "--": "M", "-.": "N", "---": "O", ".--.": "P", "--.-": "Q", ".-.": "R",
  "...": "S", "-": "T", "..-": "U", "...-": "V", ".--": "W", "-..-": "X", "-.--": "Y", "--..": "Z",
  "-----": "0", ".----": "1", "..---": "2", "...--": "3", "....-": "4", ".....": "5", "-....": "6",
  "--...": "7", "---..": "8", "----.": "9",
};

/**
 * The sketch's decoder: a press shorter than 2 units is a dot, longer a dash; the
 * unit adapts to your speed (40 to 400 ms). A gap of 3 units ends a letter, 7 a word.
 */
export class MorseDecoder {
  unit = 120;
  symbol = "";
  text = "";
  private inWord = false;
  private down = false;
  private changedAt = 0;

  /** Key pressed or released at time `now` (ms). Returns the dot or dash just keyed, if any. */
  key(down: boolean, now: number): "." | "-" | null {
    const held = now - this.changedAt;
    if (down === this.down || held <= 15) return null; // 15 ms debounce
    let mark: "." | "-" | null = null;
    if (this.down) {
      if (held < 2 * this.unit) {
        mark = ".";
        this.unit = (this.unit * 3 + held) / 4;
      } else {
        mark = "-";
        this.unit = (this.unit * 3 + held / 3) / 4;
      }
      this.unit = Math.min(400, Math.max(40, this.unit));
      this.symbol += mark;
    } else {
      this.tick(now); // a press after a long gap closes the previous letter first
    }
    this.down = down;
    this.changedAt = now;
    return mark;
  }

  /** Call while the key is up to close letters and words. Returns new text, if any. */
  tick(now: number): string {
    if (this.down) return "";
    const held = now - this.changedAt;
    if (this.symbol && held > 3 * this.unit) {
      const letter = MORSE[this.symbol] ?? "?";
      this.text += letter;
      this.symbol = "";
      this.inWord = true;
      return letter;
    }
    if (this.inWord && held > 7 * this.unit) {
      this.text += " ";
      this.inWord = false;
      return " ";
    }
    return "";
  }

  get wpm(): number {
    return Math.round(1200 / this.unit);
  }
}

// ---------- Fire (fire-lamp sketch, Fire2012) ----------

export const FIRE = { COOLING: 55, SPARKING: 120 };

/** One frame of the sketch's fire(): cool, drift up, maybe spark. Mutates and returns heat. */
export function fireStep(heat: Uint8Array, rand: Rand): Uint8Array {
  const n = heat.length;
  for (let i = 0; i < n; i++) {
    const cool = randomInt(rand, 0, Math.floor((FIRE.COOLING * 10) / n) + 2);
    heat[i] = heat[i] > cool ? heat[i] - cool : 0;
  }
  for (let k = n - 1; k >= 2; k--) heat[k] = Math.floor((heat[k - 1] + 2 * heat[k - 2]) / 3);
  if (randomInt(rand, 0, 255) < FIRE.SPARKING) {
    const y = randomInt(rand, 0, Math.min(7, n));
    heat[y] = Math.min(255, heat[y] + randomInt(rand, 160, 255));
  }
  return heat;
}

/** heatColor(): black, red, orange, yellow, white as heat rises. Returns [r, g, b]. */
export function heatColor(t: number): [number, number, number] {
  const scaled = Math.floor((t * 191) / 255);
  const ramp = (scaled & 63) << 2;
  if (scaled > 127) return [255, 255, ramp];
  if (scaled > 63) return [255, ramp, 0];
  return [ramp, 0, 0];
}

/** HSV to RGB the way Adafruit NeoPixel's ColorHSV does (hue 0..65535, sat and val 0..255). */
export function colorHSV(hue: number, sat = 255, val = 255): [number, number, number] {
  hue = ((hue % 65536) + 65536) % 65536;
  hue = Math.floor((hue * 1530 + 32768) / 65536);
  let r: number, g: number, b: number;
  if (hue < 510) {
    b = 0;
    if (hue < 255) {
      r = 255;
      g = hue;
    } else {
      r = 510 - hue;
      g = 255;
    }
  } else if (hue < 1020) {
    r = 0;
    if (hue < 765) {
      g = 255;
      b = hue - 510;
    } else {
      g = 1020 - hue;
      b = 255;
    }
  } else if (hue < 1530) {
    g = 0;
    if (hue < 1275) {
      r = hue - 1020;
      b = 255;
    } else {
      r = 255;
      b = 1530 - hue;
    }
  } else {
    r = 255;
    g = 0;
    b = 0;
  }
  const v1 = 1 + val, s1 = 1 + sat, s2 = 255 - sat;
  const ch = (c: number) => ((((c * s1) >> 8) + s2) * v1) >> 8;
  return [ch(r), ch(g), ch(b)];
}

/** The lava-lamp colours at time t seconds, as lavaLamp() (before gamma). */
export function lavaColors(n: number, t: number): [number, number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const a = (Math.sin(i * 0.35 + t * 0.6) + 1) / 2;
    const b = (Math.sin(i * 0.17 - t * 0.4 + 2) + 1) / 2;
    const hue = (60000 + Math.floor(a * 9000)) & 0xffff;
    return colorHSV(hue, 255, 60 + Math.floor(b * 195));
  });
}

// ---------- Theremin (theremin sketch) ----------

export const THEREMIN = { NEAR_CM: 5, FAR_CM: 60, LOW_HZ: 220, OCTAVES: 3 };

/** Pitch for a hand distance: 0 (silence) outside 5..60 cm; snapped to semitones when `snap`. */
export function thereminHz(cm: number, snap = true): number {
  const { NEAR_CM, FAR_CM, LOW_HZ, OCTAVES } = THEREMIN;
  if (!(cm >= NEAR_CM && cm <= FAR_CM)) return 0;
  let f = LOW_HZ * 2 ** (((FAR_CM - cm) / (FAR_CM - NEAR_CM)) * OCTAVES);
  if (snap) f = 440 * 2 ** (Math.round(12 * Math.log2(f / 440)) / 12);
  return Math.round(f);
}

// ---------- Pong (oled-pong sketch) ----------

export const PONG = { W: 128, H: 64, PADDLE_H: 14, PADDLE_W: 3, WIN: 7 };

export interface PongState {
  ballX: number;
  ballY: number;
  velX: number;
  velY: number;
  leftY: number;
  rightY: number;
  scoreLeft: number;
  scoreRight: number;
}

export function pongServe(s: PongState, direction: number, rand: Rand): void {
  s.ballX = PONG.W / 2;
  s.ballY = PONG.H / 2;
  s.velX = 1.6 * direction;
  s.velY = randomInt(rand, -10, 11) / 10;
}

/** One frame of the sketch's loop() physics. Returns "left"/"right" when a point is scored. */
export function pongStep(s: PongState, rand: Rand): "left" | "right" | null {
  const { W, H, PADDLE_H } = PONG;
  // The right paddle plays itself, beatable on purpose (the sketch with TWO_PLAYERS = false).
  const aim = s.ballY - PADDLE_H / 2;
  s.rightY += Math.max(-1.3, Math.min(1.3, aim - s.rightY));
  s.rightY = Math.max(0, Math.min(H - PADDLE_H, s.rightY));

  s.ballX += s.velX;
  s.ballY += s.velY;
  if (s.ballY <= 0 || s.ballY >= H - 2) s.velY = -s.velY;
  if (s.velX < 0 && s.ballX <= 4 && s.ballY + 2 >= s.leftY && s.ballY <= s.leftY + PADDLE_H) {
    s.velX = -s.velX * 1.05;
    s.velY = (s.ballY - (s.leftY + PADDLE_H / 2)) / 4;
  }
  if (s.velX > 0 && s.ballX >= W - 6 && s.ballY + 2 >= s.rightY && s.ballY <= s.rightY + PADDLE_H) {
    s.velX = -s.velX * 1.05;
    s.velY = (s.ballY - (s.rightY + PADDLE_H / 2)) / 4;
  }
  s.velX = Math.max(-4, Math.min(4, s.velX));
  if (s.ballX < 0 || s.ballX > W) {
    const leftScored = s.ballX > W;
    if (leftScored) s.scoreLeft++;
    else s.scoreRight++;
    pongServe(s, leftScored ? -1 : 1, rand);
    return leftScored ? "left" : "right";
  }
  return null;
}

// ---------- Visitor counter (visitor-counter sketch) ----------

/** Segments a..g (bit 0..6) for digits 0 to 9, as DIGITS[] in the sketch. */
export const SEGMENTS = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f];
export const REARM_MS = 2000;

// ---------- IR sweep (ir-sweep sketch) ----------

export const IR = { STEP_DEG: 10, MIN_CM: 10, MAX_CM: 80 };

/** The GP2Y0A21 fit the sketch uses (cm = 27.86 * V^-1.15), and its inverse. */
export const irVoltsToCm = (v: number) =>
  v < 0.35 ? IR.MAX_CM + 1 : Math.min(IR.MAX_CM + 1, Math.max(IR.MIN_CM - 1, 27.86 * v ** -1.15));
export const irCmToVolts = (cm: number) => (cm / 27.86) ** (-1 / 1.15);
