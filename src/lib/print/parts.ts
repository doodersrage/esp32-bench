// The printable parts, as code. Each part has a list of parameters (with the
// defaults the catalog downloads are built from) and a `make` function that
// turns parameter values into a solid. Everything is in millimetres.
//
// Every part is laid out the way it prints: flat face on the bed, nothing that
// needs support material. Where a part is used upside down (the chassis plate,
// the case lid), the comments say so.
//
// The dimensions of boards, motors and modules are nominal: clones differ by a
// millimetre or two. The parameters exist so a printer can measure their own
// parts and adjust; tests/prints.test.ts checks that the nominal parts fit.
import type { CrossSection, Kernel, Manifold } from "./kernel";

export type ParamValue = number | boolean | string;
export type Values = Record<string, ParamValue>;

export type Param =
  | { key: string; kind: "number"; value: number; min: number; max: number; step: number }
  | { key: string; kind: "bool"; value: boolean }
  | { key: string; kind: "choice"; value: string; options: string[]; presets?: Record<string, Values> };

export interface PartDef {
  id: string;
  params: Param[];
  make: (k: Kernel, v: Values) => Manifold;
}

export const defaults = (def: PartDef): Values => Object.fromEntries(def.params.map((p) => [p.key, p.value]));

/** Clamp and fill values from a URL or a form, so a part never builds from nonsense. */
export function cleanValues(def: PartDef, input: Record<string, unknown>): Values {
  const out = defaults(def);
  for (const p of def.params) {
    const raw = input[p.key];
    if (raw === undefined || raw === null || raw === "") continue;
    if (p.kind === "number") {
      const n = Number(raw);
      if (Number.isFinite(n)) out[p.key] = Math.min(p.max, Math.max(p.min, n));
    } else if (p.kind === "bool") out[p.key] = raw === true || raw === "1" || raw === "true" || raw === "on";
    else if (p.options.includes(String(raw))) out[p.key] = String(raw);
  }
  return out;
}

const num = (v: Values, k: string) => Number(v[k]);
const on = (v: Values, k: string) => v[k] === true;

// --- Shape helpers -----------------------------------------------------------

const SEG = 40; // segments on a full circle for large round features
const HOLE_SEG = 20; // for screw holes

function roundedRect(k: Kernel, x: number, y: number, w: number, h: number, r: number): CrossSection {
  const rr = Math.max(0.01, Math.min(r, w / 2 - 0.01, h / 2 - 0.01));
  return k.CrossSection.square([w - 2 * rr, h - 2 * rr]).translate([x + rr, y + rr]).offset(rr, "Round", 2, SEG);
}

const box = (k: Kernel, x: number, y: number, z: number, w: number, d: number, h: number) => k.Manifold.cube([w, d, h]).translate([x, y, z]);

/** A vertical hole (along Z) through everything between z0 and z1. */
const zHole = (k: Kernel, x: number, y: number, d: number, z0 = -1, z1 = 100) =>
  k.Manifold.cylinder(z1 - z0, d / 2, d / 2, HOLE_SEG).translate([x, y, z0]);

/** A rounded slot along Z: a stadium of length `len` along the given axis in the XY plane. */
function zSlot(k: Kernel, x: number, y: number, w: number, len: number, along: "x" | "y", z0 = -1, z1 = 100): Manifold {
  const sx = along === "x" ? len : w;
  const sy = along === "x" ? w : len;
  return roundedRect(k, x - sx / 2, y - sy / 2, sx, sy, w / 2).extrude(z1 - z0).translate([0, 0, z0]);
}

/**
 * Turn a 2D shape drawn as (Y, Z) into a solid running along X from x0 to x1.
 * Rotating 90 degrees about X then 90 about Z maps the section's (u, v) and the
 * extrusion w to (x, y, z) = (w, u, v).
 */
const alongX = (s: CrossSection, x0: number, x1: number) => s.extrude(x1 - x0).rotate([90, 0, 0]).rotate([0, 0, 90]).translate([x0, 0, 0]);

/**
 * Turn a 2D shape drawn as (X, Z) into a solid running along Y from y0 to y1.
 * Rotating 90 degrees about X maps (u, v, w) to (u, -w, v).
 */
const alongY = (s: CrossSection, y0: number, y1: number) => s.extrude(y1 - y0).rotate([90, 0, 0]).translate([0, y1, 0]);

/** Rounded rectangle opening through a wall that faces X. */
const xOpening = (k: Kernel, x0: number, x1: number, yc: number, zc: number, w: number, h: number, r: number) =>
  alongX(roundedRect(k, yc - w / 2, zc - h / 2, w, h, r), x0, x1);

/** Rounded slot through a wall that faces Y, `h` tall. */
const yOpening = (k: Kernel, y0: number, y1: number, xc: number, zc: number, w: number, h: number, r: number) =>
  alongY(roundedRect(k, xc - w / 2, zc - h / 2, w, h, r), y0, y1);

// --- Board cases ---------------------------------------------------------------

/**
 * Board shapes for the case. Length runs from the USB end. `usb` lists the
 * plug openings across the USB end: centre (from the board's middle) and width.
 */
export const CASE_BOARDS: Record<string, { length: number; width: number; rows: number; usb: { y: number; w: number }[] }> = {
  // ESP32-DevKitC V4 and its 38-pin clones: rows a full inch apart.
  esp32: { length: 55, width: 28, rows: 25.4, usb: [{ y: 0, w: 13 }] },
  // ESP32 DevKit V1 (DOIT), 30 pin: rows 0.9 inch apart.
  "esp32-doit": { length: 51.5, width: 28.5, rows: 22.86, usb: [{ y: 0, w: 13 }] },
  // ESP32-S3-DevKitC-1: two USB-C sockets side by side at one end.
  esp32s3: { length: 62.7, width: 28, rows: 25.4, usb: [{ y: 0, w: 26 }] },
  // ESP32-C3 SuperMini: 22.5 x 18 mm, rows 0.6 inch apart.
  "esp32c3-supermini": { length: 22.5, width: 18, rows: 15.24, usb: [{ y: 0, w: 12 }] },
  custom: { length: 55, width: 28, rows: 25.4, usb: [{ y: 0, w: 13 }] },
};

const PCB = 1.6;
/** Plug opening height: a USB-C or micro-USB plug's overmould. */
const USB_H = 7.5;
/** 0.96 inch SSD1306 module: board size, window over the glass, screw hole spacing. */
const OLED = { board: 28, window: [25, 14] as [number, number], windowOffset: 2.5, holes: [23.4, 23.8] as [number, number], hole: 2.3 };
/**
 * KY-023 style thumb joystick: its board (with the header) and the M3 holes,
 * which sellers give as about 27 x 20 mm apart. It hangs under the lid on four
 * posts, with the stick up through a round hole.
 */
const STICK = { board: [40, 27] as [number, number], holes: [27, 20] as [number, number] };
const LIP = 1.6;
const LIP_H = 4;

/** Every measurement of a board case, worked out once and shared with the tests. */
export function caseLayout(v: Values) {
  const length = num(v, "length");
  const width = num(v, "width");
  const rows = num(v, "rows");
  const c = num(v, "clearance");
  const wall = num(v, "wall");
  const floor = 2;
  const fit = num(v, "fit");
  const oled = on(v, "oled");
  const button = num(v, "button");
  const stick = on(v, "joystick");
  const stickDrop = num(v, "stickDrop");
  const under = num(v, "under");
  // Room above the board: at least 10 mm so the lid's lip clears the header pins,
  // 24 with a display (its pins and plugs hang under the lid), 20 with a panel
  // button, and with a joystick its posts and board plus 5 mm over the ESP32's parts.
  const above = Math.max(num(v, "above"), 10, oled ? 24 : 0, button > 0 ? 20 : 0, stick ? stickDrop + PCB + 5 : 0);
  // Lid features in a row from the USB end, each with the length and width it needs.
  const slots: { kind: "oled" | "stick" | "button"; len: number; wid: number }[] = [];
  if (oled) slots.push({ kind: "oled", len: OLED.board + 2, wid: OLED.board + 2 });
  if (stick) slots.push({ kind: "stick", len: STICK.board[0] + 2, wid: STICK.board[1] + 2 });
  if (button > 0) slots.push({ kind: "button", len: button + 8, wid: button + 6 });
  const lidNeed = slots.reduce((sum, x) => sum + x.len, 0);
  const innerL = Math.max(length + 2 * c, lidNeed + 2 * (LIP + fit) + 2);
  const innerW = Math.max(width + 2 * c, Math.max(0, ...slots.map((x) => x.wid)) + 2 * (LIP + fit) + 1);
  const outerL = innerL + 2 * wall;
  const outerW = innerW + 2 * wall;
  const height = floor + under + PCB + above;
  const boardX = wall + c; // USB end of the board, against the clearance
  const boardY = (outerW - width) / 2;
  const boardZ = floor + under; // underside of the board
  // The rail the board rests on: between the header rows, clear of the plastic under each row.
  const railW = Math.max(4, rows - 2 * (1.27 + 1.0));
  const lidZ = height; // the lid's inner face sits here
  // Lid features along the length: spread the slots evenly inside the lip.
  const free = innerL - 2 * (LIP + fit) - lidNeed;
  const gap = free / (slots.length + 1);
  const centres: Record<string, number> = {};
  let x = wall + LIP + fit + gap;
  for (const sl of slots) {
    centres[sl.kind] = x + sl.len / 2;
    x += sl.len + gap;
  }
  const oledX = centres.oled ?? 0;
  const stickX = centres.stick ?? 0;
  const buttonX = centres.button ?? 0;
  return { length, width, rows, c, wall, floor, fit, oled, button, stick, stickDrop, under, above, innerL, innerW, outerL, outerW, height, boardX, boardY, boardZ, railW, lidZ, oledX, stickX, buttonX };
}

function boardCase(k: Kernel, v: Values): Manifold {
  const L = caseLayout(v);
  const board = CASE_BOARDS[String(v.board)] ?? CASE_BOARDS.custom;
  const r = L.wall + 1.5;
  const parts: Manifold[] = [];

  // Base: a rounded box with the cavity cut out.
  let base = roundedRect(k, 0, 0, L.outerL, L.outerW, r).extrude(L.height);
  base = base.subtract(roundedRect(k, L.wall, L.wall, L.innerL, L.innerW, 1).extrude(L.height).translate([0, 0, L.floor]));
  // The rail under the board.
  const railLen = Math.max(4, L.length - 6);
  // A hollow frame, not a solid block: the board only needs its edges.
  const rail = roundedRect(k, L.boardX + 3, L.outerW / 2 - L.railW / 2, railLen, L.railW, 0.5);
  const railHole = roundedRect(k, L.boardX + 4.6, L.outerW / 2 - L.railW / 2 + 1.6, railLen - 3.2, L.railW - 3.2, 0.5);
  base = base.add((L.railW > 6 ? rail.subtract(railHole) : rail).extrude(L.under + 0.01).translate([0, 0, L.floor - 0.01]));
  // USB plug openings in the end wall, centred on the sockets on top of the board.
  const usbZ = L.boardZ + PCB + 1.6;
  for (const u of board.usb) {
    const w = Math.min(u.w, L.innerW - 2);
    base = base.subtract(xOpening(k, -1, L.wall + 1, L.outerW / 2 + u.y, usbZ, w, USB_H, 2));
  }
  // Slot in the far end wall for the jumper wires.
  if (on(v, "wireSlot")) {
    const h = Math.max(3, L.under - 3);
    const w = Math.min(L.innerW - 4, L.rows + 4);
    base = base.subtract(xOpening(k, L.outerL - L.wall - 1, L.outerL + 1, L.outerW / 2, L.floor + 1.5 + h / 2, w, h, 1.5));
  }
  // Vents: slots in both long walls, above the board.
  if (on(v, "vents")) {
    const z = L.boardZ + PCB + Math.min(L.above, 12) / 2 + 0.5;
    const h = Math.max(1.5, Math.min(2, L.above - 4));
    for (let x = L.wall + 8; x + 6 < L.outerL - L.wall - 6; x += 5) {
      for (const [y0, y1] of [[-1, L.wall + 1], [L.outerW - L.wall - 1, L.outerW + 1]]) {
        base = base.subtract(box(k, x, y0, z - h / 2, 2, y1 - y0, h));
      }
    }
  }
  // Mounting tabs on both ends, with M3 holes a whole number of centimetres
  // apart so they line up with the chassis plate's 10 mm grid.
  if (on(v, "tabs")) {
    const span = Math.ceil((L.outerL + 8) / 10) * 10;
    const x0 = (L.outerL - span) / 2;
    for (const hx of [x0, x0 + span]) {
      const left = hx < L.outerL / 2;
      const xa = left ? hx - 5 : L.outerL - 5;
      const xb = left ? 5 : hx + 5;
      base = base.add(roundedRect(k, xa, L.outerW / 2 - 6, xb - xa, 12, 3).extrude(3));
    }
    for (const hx of [x0, x0 + span]) base = base.subtract(zHole(k, hx, L.outerW / 2, 3.4));
  }
  parts.push(base);

  // Lid, printed outside face down next to the base. Flipped over, its lip drops into the base.
  const ly = L.outerW + 8; // where the lid sits on the bed
  let lid = roundedRect(k, 0, 0, L.outerL, L.outerW, r).extrude(2);
  const lipOuter = roundedRect(k, L.wall + L.fit, L.wall + L.fit, L.innerL - 2 * L.fit, L.innerW - 2 * L.fit, 1);
  const lipInner = roundedRect(k, L.wall + L.fit + LIP, L.wall + L.fit + LIP, L.innerL - 2 * (L.fit + LIP), L.innerW - 2 * (L.fit + LIP), 0.5);
  lid = lid.add(lipOuter.subtract(lipInner).extrude(LIP_H).translate([0, 0, 2 - 0.01]));
  // Lid features. Flipping the lid over the X axis keeps X and mirrors Y; everything is centred in Y.
  if (L.oled) {
    const [ww, wh] = OLED.window;
    lid = lid.subtract(roundedRect(k, L.oledX - wh / 2 - OLED.windowOffset, L.outerW / 2 - ww / 2, wh, ww, 1).extrude(10).translate([0, 0, -1]));
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) lid = lid.subtract(zHole(k, L.oledX + (sx * OLED.holes[1]) / 2, L.outerW / 2 + (sy * OLED.holes[0]) / 2, OLED.hole));
  }
  if (L.button > 0) lid = lid.subtract(k.Manifold.cylinder(10, L.button / 2, L.button / 2, SEG).translate([L.buttonX, L.outerW / 2, -1]));
  if (L.stick) {
    // Four posts for the joystick's board, holes for M3 screws to cut their own thread, and the stick's hole.
    const posts: Manifold[] = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const [px, py] = [L.stickX + (sx * STICK.holes[0]) / 2, L.outerW / 2 + (sy * STICK.holes[1]) / 2];
      posts.push(k.Manifold.cylinder(L.stickDrop + 0.01, 3, 3, SEG).translate([px, py, 2 - 0.01]));
    }
    lid = lid.add(k.Manifold.union(posts));
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) lid = lid.subtract(zHole(k, L.stickX + (sx * STICK.holes[0]) / 2, L.outerW / 2 + (sy * STICK.holes[1]) / 2, 2.6, 0.6));
    const d = num(v, "stickHole");
    lid = lid.subtract(k.Manifold.cylinder(10, d / 2, d / 2, SEG).translate([L.stickX, L.outerW / 2, -1]));
  }
  parts.push(lid.translate([0, ly, 0]));
  return k.Manifold.union(parts);
}

// --- Robot plates: TT motors, wheel wells, 10 mm grid ----------------------------

/** Every measurement of a plate with two TT motors under it, shared with the tests. */
export function motorLayout(v: Values, length: number, width: number, axleX: number) {
  const mW = num(v, "motorWidth");
  const mH = num(v, "motorHeight");
  const mL = num(v, "motorLength");
  const inset = num(v, "axleInset");
  const R = num(v, "wheel") / 2;
  const g = mW / 2 + 0.3; // half the gap between the rails
  const motorY = width / 2 - (g + 8); // centre line of each motor, from the plate's middle
  const rear = axleX - inset; // gearbox end of the motor
  const front = rear + mL;
  const well = R + 3; // half the length of the wheel well
  const deck = R + mH / 2; // height of the plate's underside above the floor
  return { mW, mH, mL, inset, R, g, motorY, rear, front, well, deck, axleX };
}

/**
 * A plate in the XY plane, centred on the origin, `t` thick. Features that hang
 * under the plate in use (motor rails, the skid) point up here: print it as it
 * comes and turn it over.
 */
function motorPlate(k: Kernel, v: Values, o: { length: number; width: number; axleX: number; skid: boolean; corners: boolean }): Manifold {
  const t = num(v, "thickness");
  const M = motorLayout(v, o.length, o.width, o.axleX);
  let plate = roundedRect(k, -o.length / 2, -o.width / 2, o.length, o.width, 8).extrude(t);
  const cut: Manifold[] = [];
  const keepOut: ((x: number, y: number) => boolean)[] = [];

  for (const side of [-1, 1]) {
    const my = side * M.motorY;
    // Rails either side of the motor, 4 mm tall, and a stop at the front end.
    const railH = 4;
    for (const s of [-1, 1]) {
      const y0 = s > 0 ? my + M.g : my - M.g - 3;
      plate = plate.add(box(k, M.rear + 3, y0, t - 0.01, M.mL - 3, 3, railH + 0.01));
    }
    plate = plate.add(box(k, M.front + 0.3, my - M.g - 3, t - 0.01, 3, 2 * M.g + 6, railH + 0.01));
    // Zip tie slots either side of the motor, ahead of the wheel well.
    const slotXs = [M.front - 8, Math.max(M.axleX + M.well + 5, M.front - 24)].filter((x, i, a) => i === 0 || Math.abs(x - a[0]) > 8);
    for (const sx of slotXs) for (const s of [-1, 1]) cut.push(zSlot(k, sx, my + s * (M.g + 5), 2.2, 4.5, "x"));
    // Wheel well: no plate between the motor's outer face and the edge, beside the wheel.
    const wy0 = side > 0 ? my + M.g : -o.width / 2 - 1;
    const wy1 = side > 0 ? o.width / 2 + 1 : my - M.g;
    cut.push(box(k, M.axleX - M.well, wy0, -1, 2 * M.well, wy1 - wy0, 50));
    keepOut.push((x, y) => x > M.rear - 4 && x < M.front + 8 && Math.abs(y - my) < M.g + 9);
    keepOut.push((x, y) => Math.abs(x - M.axleX) < M.well + 4 && side * y > M.motorY);
  }

  if (o.skid) {
    // A skid at the front: a post with a round foot, as tall as the axle is high plus half the motor.
    const sx = o.length / 2 - 15;
    const rad = 7;
    plate = plate.add(k.Manifold.cylinder(M.deck - rad, rad, rad, SEG).translate([sx, 0, t - 0.01]));
    plate = plate.add(k.Manifold.sphere(rad, SEG).translate([sx, 0, t + M.deck - rad]));
    keepOut.push((x, y) => Math.hypot(x - sx, y) < rad + 4);
  }

  const corners: [number, number][] = [];
  if (o.corners) {
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) corners.push([sx * (o.length / 2 - 6), sy * (o.width / 2 - 6)]);
    for (const [x, y] of corners) cut.push(zHole(k, x, y, 3.4));
    keepOut.push((x, y) => corners.some(([cx, cy]) => Math.hypot(x - cx, y - cy) < 8));
  }

  // The 10 mm grid of M3 holes for standoffs, boards, battery holders and zip ties.
  for (let x = -Math.floor(o.length / 20) * 10; x <= o.length / 2 - 6; x += 10) {
    for (let y = -Math.floor(o.width / 20) * 10; y <= o.width / 2 - 6; y += 10) {
      if (Math.abs(x) > o.length / 2 - 6 || Math.abs(y) > o.width / 2 - 6) continue;
      if (keepOut.some((f) => f(x, y))) continue;
      cut.push(zHole(k, x, y, 3.4, -1, t + 1));
    }
  }
  return plate.subtract(k.Manifold.union(cut));
}

const motorParams = (): Param[] => [
  { key: "wheel", kind: "number", value: 65, min: 40, max: 90, step: 0.5 },
  { key: "motorLength", kind: "number", value: 70, min: 55, max: 80, step: 0.5 },
  { key: "motorWidth", kind: "number", value: 22.5, min: 18, max: 28, step: 0.1 },
  { key: "motorHeight", kind: "number", value: 18.8, min: 15, max: 25, step: 0.1 },
  { key: "axleInset", kind: "number", value: 11, min: 6, max: 20, step: 0.5 },
];

// --- Sensor mounts --------------------------------------------------------------

/**
 * HC-SR04 bracket, printed with its face on the bed. In use the face stands
 * up at the front of the car, the foot bolts to the deck behind it, and the
 * module sits behind the face with its transducers through the holes,
 * pins pointing up.
 */
export function sonarLayout(v: Values) {
  const t = num(v, "thickness");
  const hole = num(v, "hole");
  const spacing = num(v, "spacing");
  const centre = num(v, "centre");
  const width = Math.max(52, spacing + hole + 8);
  const faceH = t + centre + hole / 2 + 4;
  return { t, hole, spacing, centre, width, faceH, foot: num(v, "foot") };
}

function sonarBracket(k: Kernel, v: Values): Manifold {
  const S = sonarLayout(v);
  // Face in XY (Y is height above the deck in use), thickness along Z.
  const face = roundedRect(k, -S.width / 2, 0, S.width, S.faceH, 3).extrude(S.t);
  // Foot along the bottom edge, standing up here; in use it lies on the deck.
  const foot = box(k, -S.width / 2, 0, 0, S.width, S.t, S.t + S.foot);
  let part = face.add(foot);
  // Gussets at both ends: triangles in the YZ plane, 3 mm thick.
  const g = Math.min(12, S.foot - 2, S.faceH - S.t - 2);
  const tri = k.CrossSection.ofPolygons([[[0, 0], [g, 0], [0, g]]]);
  for (const x of [-S.width / 2, S.width / 2 - 3]) part = part.add(alongX(tri.translate([S.t - 0.01, S.t - 0.01]), x, x + 3));
  // Transducer holes.
  for (const s of [-1, 1]) part = part.subtract(k.Manifold.cylinder(S.t + 2, S.hole / 2, S.hole / 2, 64).translate([(s * S.spacing) / 2, S.t + S.centre, -1]));
  // Slots in the foot, 30 mm apart to suit the 10 mm grid, 8 mm long to slide the bracket.
  for (const s of [-1, 1]) part = part.subtract(yOpening(k, -1, S.t + 1, s * 15, S.t + S.foot / 2 + 1, 3.4, 8, 1.7));
  return part;
}

/**
 * Line sensor mount: a bar that bolts under the front of the chassis plate
 * (holes 40 mm apart, on the grid) with two tabs hanging down. Each TCRT5000
 * module bolts to a tab through a slot, so its height above the floor can be
 * set. Printed bar down, tabs up.
 */
export function lineLayout(v: Values) {
  return { spacing: num(v, "spacing"), drop: num(v, "drop"), bar: 4, tabW: 10, tabT: 3, length: Math.max(60, num(v, "spacing") + 22), depth: 14 };
}

function lineMount(k: Kernel, v: Values): Manifold {
  const L = lineLayout(v);
  let part = roundedRect(k, -L.length / 2, 0, L.length, L.depth, 3).extrude(L.bar);
  for (const s of [-1, 1]) {
    const x = (s * L.spacing) / 2;
    part = part.add(box(k, x - L.tabW / 2, 0, L.bar - 0.01, L.tabW, L.tabT, L.drop + 0.01));
    // Slot through the tab, running down its length, so the module's height can be set.
    const len = Math.max(3.4, L.drop - 5);
    part = part.subtract(yOpening(k, -1, L.tabT + 1, x, L.bar + 3 + len / 2, 3.4, len, 1.7));
  }
  for (const s of [-1, 1]) part = part.subtract(zHole(k, s * 20, L.depth / 2 + 1.5, 3.4));
  return part;
}

/** The balance base puts its axle as near the middle as the motor allows, so the wheels sit under the frame. */
export const balanceAxleX = (v: Values) => {
  const length = num(v, "length");
  return Math.max(-length / 2 + num(v, "axleInset") + 4, num(v, "axleInset") - num(v, "motorLength") / 2);
};

// --- Fit test -------------------------------------------------------------------

/**
 * One small print that checks a printer's tolerances before a whole set: a peg
 * and three square pockets 0.1, 0.2 and 0.3 mm bigger each side (the case
 * lid's "fit" setting), marked with one, two and three dots; M3 holes for a
 * bolt (3.4 mm) and for a screw to cut its thread (2.6 mm), an M2 hole for the
 * display screws, and the 16.6 mm transducer hole.
 */
export const FIT_TEST = { peg: 10, gaps: [0.1, 0.2, 0.3], t: 3, w: 76, h: 44, pegH: 8 };
export const fitPocketX = (i: number) => 12 + i * 15;

function fitTest(k: Kernel): Manifold {
  const F = FIT_TEST;
  let plate = roundedRect(k, 0, 0, F.w, F.h, 3).extrude(F.t);
  F.gaps.forEach((g, i) => {
    const side = F.peg + 2 * g;
    plate = plate.subtract(roundedRect(k, fitPocketX(i) - side / 2, 14 - side / 2, side, side, 0.5).extrude(F.t + 2).translate([0, 0, -1]));
    for (let d = 0; d <= i; d++) plate = plate.subtract(k.Manifold.cylinder(1, 0.8, 0.8, 16).translate([fitPocketX(i) - i * 1.5 + d * 3, 4, F.t - 0.8]));
  });
  plate = plate.subtract(zHole(k, 54, 10, 3.4));
  plate = plate.subtract(zHole(k, 54, 22, 2.6));
  plate = plate.subtract(zHole(k, 64, 10, 2.3));
  plate = plate.subtract(k.Manifold.cylinder(F.t + 2, 8.3, 8.3, 64).translate([62, 32, -1]));
  // The peg, beside the plate.
  const peg = roundedRect(k, fitPocketX(0) - F.peg / 2, F.h + 6, F.peg, F.peg, 0.5).extrude(F.pegH);
  return plate.add(peg);
}

// --- Weather radiation shield --------------------------------------------------------

/**
 * A stack of rings that shades a temperature sensor from the sun and rain
 * while air flows through, like a small Stevenson screen. Every piece prints
 * flat with its skirt and posts up; in use they point down, each ring resting
 * on the posts of the one above, all held by three M3 threaded rods.
 */
export function shieldLayout(v: Values) {
  const D = num(v, "diameter");
  const opening = Math.min(num(v, "opening"), D - 30);
  const gap = num(v, "gap");
  const skirt = Math.min(num(v, "skirt"), gap - 4);
  const t = 2;
  const postR = (opening / 2 + D / 2) / 2;
  const posts = [90, 210, 330].map((a) => [postR * Math.cos((a * Math.PI) / 180), postR * Math.sin((a * Math.PI) / 180)] as [number, number]);
  return { D, opening, gap, skirt, t, posts };
}

function shieldPiece(k: Kernel, v: Values, kind: "plate" | "top" | "base"): Manifold {
  const S = shieldLayout(v);
  const R = S.D / 2;
  if (kind === "base") {
    const t = S.t + 2;
    let base = k.CrossSection.circle(R, 96).extrude(t);
    // A tab to screw it to a post or a wall, with two holes for 4 mm wood screws.
    base = base.add(roundedRect(k, -20, -R - 32, 40, 40, 4).extrude(t));
    base = base.subtract(zHole(k, -10, -R - 20, 4.5)).subtract(zHole(k, 10, -R - 20, 4.5));
    base = base.subtract(zHole(k, 0, 0, 10)); // the sensor's cable
    for (const [x, y] of S.posts) base = base.subtract(zHole(k, x, y, 3.4));
    return base;
  }
  let piece = (kind === "top" ? k.CrossSection.circle(R, 96) : k.CrossSection.circle(R, 96).subtract(k.CrossSection.circle(S.opening / 2, 96))).extrude(S.t);
  piece = piece.add(k.CrossSection.circle(R, 96).subtract(k.CrossSection.circle(R - 1.6, 96)).extrude(S.skirt + 0.01).translate([0, 0, S.t - 0.01]));
  for (const [x, y] of S.posts) piece = piece.add(k.Manifold.cylinder(S.gap + 0.01, 4.5, 4.5, SEG).translate([x, y, S.t - 0.01]));
  for (const [x, y] of S.posts) piece = piece.subtract(zHole(k, x, y, 3.4));
  return piece;
}

const shieldParams = (): Param[] => [
  { key: "diameter", kind: "number", value: 100, min: 70, max: 150, step: 1 },
  { key: "opening", kind: "number", value: 50, min: 30, max: 100, step: 1 },
  { key: "gap", kind: "number", value: 16, min: 10, max: 30, step: 0.5 },
  { key: "skirt", kind: "number", value: 10, min: 4, max: 24, step: 0.5 },
];

// --- The parts -------------------------------------------------------------------

export const PART_DEFS: PartDef[] = [
  {
    id: "board-case",
    params: [
      {
        key: "board",
        kind: "choice",
        value: "esp32",
        options: Object.keys(CASE_BOARDS),
        presets: Object.fromEntries(Object.entries(CASE_BOARDS).map(([id, b]) => [id, { length: b.length, width: b.width, rows: b.rows }])),
      },
      { key: "length", kind: "number", value: 55, min: 15, max: 120, step: 0.1 },
      { key: "width", kind: "number", value: 28, min: 12, max: 60, step: 0.1 },
      { key: "rows", kind: "number", value: 25.4, min: 7.62, max: 55, step: 0.01 },
      { key: "clearance", kind: "number", value: 0.5, min: 0.1, max: 2, step: 0.1 },
      { key: "under", kind: "number", value: 16, min: 6, max: 40, step: 0.5 },
      { key: "above", kind: "number", value: 12, min: 10, max: 50, step: 0.5 },
      { key: "wall", kind: "number", value: 2, min: 1.2, max: 4, step: 0.1 },
      { key: "fit", kind: "number", value: 0.2, min: 0, max: 0.6, step: 0.05 },
      { key: "oled", kind: "bool", value: false },
      { key: "button", kind: "number", value: 0, min: 0, max: 16, step: 0.5 },
      { key: "joystick", kind: "bool", value: false },
      { key: "stickHole", kind: "number", value: 24, min: 18, max: 26, step: 0.5 },
      { key: "stickDrop", kind: "number", value: 10, min: 4, max: 20, step: 0.5 },
      { key: "wireSlot", kind: "bool", value: true },
      { key: "vents", kind: "bool", value: true },
      { key: "tabs", kind: "bool", value: false },
    ],
    make: boardCase,
  },
  {
    id: "chassis-plate",
    params: [
      { key: "length", kind: "number", value: 160, min: 130, max: 200, step: 1 },
      { key: "width", kind: "number", value: 120, min: 100, max: 160, step: 1 },
      { key: "thickness", kind: "number", value: 4, min: 3, max: 6, step: 0.5 },
      ...motorParams(),
    ],
    make: (k, v) => {
      const length = num(v, "length");
      return motorPlate(k, v, { length, width: num(v, "width"), axleX: -length / 2 + 30, skid: true, corners: false });
    },
  },
  {
    id: "sonar-bracket",
    params: [
      { key: "hole", kind: "number", value: 16.6, min: 15.5, max: 18, step: 0.1 },
      { key: "spacing", kind: "number", value: 26, min: 23, max: 30, step: 0.1 },
      { key: "centre", kind: "number", value: 10.5, min: 9, max: 30, step: 0.5 },
      { key: "foot", kind: "number", value: 18, min: 12, max: 30, step: 1 },
      { key: "thickness", kind: "number", value: 3, min: 2, max: 5, step: 0.5 },
    ],
    make: sonarBracket,
  },
  {
    id: "line-mount",
    params: [
      { key: "spacing", kind: "number", value: 26, min: 20, max: 60, step: 1 },
      { key: "drop", kind: "number", value: 22, min: 12, max: 40, step: 1 },
    ],
    make: lineMount,
  },
  {
    id: "balance-base",
    params: [
      { key: "length", kind: "number", value: 90, min: 80, max: 130, step: 1 },
      { key: "width", kind: "number", value: 120, min: 100, max: 160, step: 1 },
      { key: "thickness", kind: "number", value: 4, min: 3, max: 6, step: 0.5 },
      ...motorParams(),
    ],
    make: (k, v) => motorPlate(k, v, { length: num(v, "length"), width: num(v, "width"), axleX: balanceAxleX(v), skid: false, corners: true }),
  },
  {
    id: "balance-deck",
    params: [
      { key: "length", kind: "number", value: 90, min: 80, max: 130, step: 1 },
      { key: "width", kind: "number", value: 120, min: 100, max: 160, step: 1 },
      { key: "thickness", kind: "number", value: 3, min: 2, max: 6, step: 0.5 },
    ],
    make: (k, v) => {
      const length = num(v, "length");
      const width = num(v, "width");
      const t = num(v, "thickness");
      let plate = roundedRect(k, -length / 2, -width / 2, length, width, 8).extrude(t);
      const cut: Manifold[] = [];
      const corners: [number, number][] = [];
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) corners.push([sx * (length / 2 - 6), sy * (width / 2 - 6)]);
      for (const [x, y] of corners) cut.push(zHole(k, x, y, 3.4));
      for (let x = -Math.floor(length / 20) * 10; x <= length / 2 - 6; x += 10) {
        for (let y = -Math.floor(width / 20) * 10; y <= width / 2 - 6; y += 10) {
          if (Math.abs(x) > length / 2 - 6 || Math.abs(y) > width / 2 - 6) continue;
          if (corners.some(([cx, cy]) => Math.hypot(x - cx, y - cy) < 8)) continue;
          cut.push(zHole(k, x, y, 3.4));
        }
      }
      return plate.subtract(k.Manifold.union(cut));
    },
  },
  { id: "shield-plate", params: shieldParams(), make: (k, v) => shieldPiece(k, v, "plate") },
  { id: "shield-top", params: shieldParams(), make: (k, v) => shieldPiece(k, v, "top") },
  { id: "shield-base", params: shieldParams(), make: (k, v) => shieldPiece(k, v, "base") },
  { id: "fit-test", params: [], make: (k) => fitTest(k) },
];

export const partDef = (id: string): PartDef | undefined => PART_DEFS.find((d) => d.id === id);

