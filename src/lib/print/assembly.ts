// "How it goes together": a printed part as it is used, with the things that
// fit it drawn in plain colours (motors, wheels, boards, rods). The positions
// come from the same layouts the fit tests check, so the picture shows what
// the tests prove. Rendered at build time to /prints/<id>-assembly.png.
import type { Kernel, Manifold } from "./kernel";
import { caseLayout, defaults, lineLayout, motorLayout, partDef, shieldLayout, sonarLayout, balanceAxleX, type Values } from "./parts.ts";

export type Colour = [number, number, number];
export const COLOURS = {
  part: [46, 125, 91] as Colour,
  part2: [70, 150, 115] as Colour,
  metal: [150, 152, 158] as Colour,
  dark: [52, 54, 60] as Colour,
  pcb: [32, 92, 150] as Colour,
  motor: [214, 176, 52] as Colour,
};

/** Parts that have an assembly picture. */
export const HAS_ASSEMBLY = new Set(["chassis-plate", "balance-base", "balance-deck", "shield-plate", "shield-top", "shield-base", "board-case", "sonar-bracket", "line-mount"]);

export interface Piece {
  solid: Manifold;
  colour: Colour;
}

const cube = (k: Kernel, x: number, y: number, z: number, w: number, d: number, h: number) => k.Manifold.cube([w, d, h]).translate([x, y, z]);
/** A cylinder along Y: a wheel or a rod lying down. */
const yCyl = (k: Kernel, x: number, y: number, z: number, r: number, len: number) => k.Manifold.cylinder(len, r, r, 48).rotate([-90, 0, 0]).translate([x, y, z]);

/** Turn a plate printed features-up over, as it is used: features down, top face at z = top. */
const turnOver = (m: Manifold, top: number) => m.rotate([180, 0, 0]).translate([0, 0, top]);

function motorsAndWheels(k: Kernel, v: Values, length: number, width: number, axleX: number, top: number): Piece[] {
  const t = Number(v.thickness);
  const M = motorLayout(v, length, width, axleX);
  const out: Piece[] = [];
  for (const side of [-1, 1]) {
    const my = side * M.motorY;
    const motor = cube(k, M.rear, my - M.mW / 2, t, M.mL, M.mW, M.mH);
    const y0 = side > 0 ? my + M.mW / 2 + 2 : my - M.mW / 2 - 2 - 26;
    const wheel = yCyl(k, M.axleX, y0, t + M.mH / 2, M.R, 26);
    out.push({ solid: turnOver(motor, top), colour: COLOURS.motor }, { solid: turnOver(wheel, top), colour: COLOURS.dark });
  }
  return out;
}

export function assembly(k: Kernel, part: string, v: Values): Piece[] | undefined {
  const def = partDef(part);
  if (!def) return undefined;
  const made = () => def.make(k, v);

  if (part === "chassis-plate") {
    const t = Number(v.thickness);
    const length = Number(v.length), width = Number(v.width);
    const M = motorLayout(v, length, width, -length / 2 + 30);
    const top = t + M.deck; // the deck's top face above the floor
    return [{ solid: turnOver(made(), top), colour: COLOURS.part }, ...motorsAndWheels(k, v, length, width, M.axleX, top)];
  }

  if (part === "balance-base" || part === "balance-deck") {
    const bv = part === "balance-base" ? v : { ...defaults(partDef("balance-base")!), length: v.length, width: v.width };
    const t = Number(bv.thickness);
    const length = Number(bv.length), width = Number(bv.width);
    const M = motorLayout(bv, length, width, balanceAxleX(bv));
    const top = t + M.deck;
    const base = partDef("balance-base")!.make(k, bv);
    const deckV = part === "balance-deck" ? v : { ...defaults(partDef("balance-deck")!), length, width };
    const deck = partDef("balance-deck")!.make(k, deckV);
    const out: Piece[] = [{ solid: turnOver(base, top), colour: part === "balance-base" ? COLOURS.part : COLOURS.part2 }, ...motorsAndWheels(k, bv, length, width, M.axleX, top)];
    for (const level of [1, 2]) {
      const z = top + level * 60 + (level - 1) * Number(deckV.thickness);
      out.push({ solid: deck.translate([0, 0, z]), colour: part === "balance-deck" ? COLOURS.part : COLOURS.part2 });
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        out.push({ solid: k.Manifold.cylinder(60, 2.5, 2.5, 6).translate([sx * (length / 2 - 6), sy * (width / 2 - 6), z - 60]), colour: COLOURS.metal });
      }
    }
    return out;
  }

  if (part.startsWith("shield-")) {
    const S = shieldLayout(v);
    const piece = (id: string) => partDef(id)!.make(k, v);
    const step = S.t + S.gap;
    // The base lies as printed; turned 180 degrees so its rod holes line up with the turned-over rings.
    const out: Piece[] = [{ solid: piece("shield-base").rotate([0, 0, 180]), colour: part === "shield-base" ? COLOURS.part : COLOURS.part2 }];
    const baseTop = S.t + 2;
    out.push({ solid: cube(k, -7.5, -5.5, baseTop, 15, 11, 1.6), colour: COLOURS.pcb }); // the BME280
    const ring = turnOver(piece("shield-plate"), 0);
    for (let i = 1; i <= 5; i++) out.push({ solid: ring.translate([0, 0, baseTop + i * step]), colour: part === "shield-plate" ? COLOURS.part : COLOURS.part2 });
    const topZ = baseTop + 6 * step;
    out.push({ solid: turnOver(piece("shield-top"), topZ), colour: part === "shield-top" ? COLOURS.part : COLOURS.part2 });
    for (const [x, y] of S.posts) out.push({ solid: k.Manifold.cylinder(topZ + 12, 1.5, 1.5, 12).translate([x, -y, -4]), colour: COLOURS.metal });
    return out;
  }

  if (part === "board-case") {
    const L = caseLayout(v);
    const solid = made();
    const [base, lid] = solid.decompose().sort((a, b) => a.boundingBox().min[1] - b.boundingBox().min[1]);
    // Exploded: the lid turned over, lifted above the base.
    const lifted = lid.rotate([180, 0, 0]);
    const lb = lifted.boundingBox();
    const out: Piece[] = [
      { solid: base, colour: COLOURS.part },
      { solid: lifted.translate([0, -lb.min[1], L.height + 2 - lb.max[2] + 30]), colour: COLOURS.part2 },
      { solid: cube(k, L.boardX, L.boardY, L.boardZ, L.length, L.width, 1.6), colour: COLOURS.pcb },
    ];
    if (L.stick) {
      const z = L.height - L.stickDrop - 1.6 + 30;
      out.push({ solid: cube(k, L.stickX - 20, L.outerW / 2 - 13.5, z, 40, 27, 1.6), colour: COLOURS.pcb });
      out.push({ solid: k.Manifold.cylinder(26, 3, 3, 24).translate([L.stickX, L.outerW / 2, z + 1.6]), colour: COLOURS.dark });
    }
    if (L.oled) out.push({ solid: cube(k, L.oledX - 14, L.outerW / 2 - 14, L.height - 4 + 30, 28, 28, 1.6), colour: COLOURS.pcb });
    return out;
  }

  if (part === "sonar-bracket") {
    const S = sonarLayout(v);
    // Stand it up: the face vertical, the foot on the deck behind it.
    const up = (m: Manifold) => m.rotate([90, 0, 0]);
    const out: Piece[] = [{ solid: up(made()), colour: COLOURS.part }];
    out.push({ solid: up(cube(k, -22.5, S.t + S.centre - 10, S.t, 45, 20, 1.6)), colour: COLOURS.pcb });
    for (const s of [-1, 1]) out.push({ solid: up(k.Manifold.cylinder(12 + S.t, 8, 8, 48).translate([(s * S.spacing) / 2, S.t + S.centre, -12])), colour: COLOURS.metal });
    return out;
  }

  if (part === "line-mount") {
    const L = lineLayout(v);
    const out: Piece[] = [{ solid: turnOver(made(), 0), colour: COLOURS.part }];
    // A TCRT5000 module on the front of each tab, hanging down.
    for (const s of [-1, 1]) out.push({ solid: turnOver(cube(k, (s * L.spacing) / 2 - 7, -1.6, L.bar + 2, 14, 1.6, 32), 0), colour: COLOURS.pcb });
    return out;
  }

  return undefined;
}
