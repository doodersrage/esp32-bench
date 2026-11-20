// The 3D-printable parts: every catalog entry builds into one clean solid that
// fits a 220 x 220 mm bed, every part builds across its parameter ranges, and
// the things each part is for (boards, lids, motors, wheels, transducers) fit
// it with nothing overlapping. Run with:
//   node --experimental-strip-types tests/prints.test.ts
import assert from "node:assert/strict";
import { build, loadKernel, type Kernel, type Manifold } from "../src/lib/print/kernel.ts";
import { CASE_BOARDS, PART_DEFS, balanceAxleX, caseLayout, cleanValues, defaults, lineLayout, motorLayout, partDef, sonarLayout, type Values } from "../src/lib/print/parts.ts";
import { BED, CASE_FOR_BOARD, PRINTS } from "../src/data/prints.ts";
import { parseStl, to3mf, toStl } from "../src/lib/print/formats.ts";
import { renderPng } from "../src/lib/print/render.ts";
import { unzipSync, strFromU8 } from "fflate";

const k = await loadKernel();
let failures = 0;
let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
  } catch (e) {
    failures++;
    console.error(`FAIL ${name}\n  ${(e as Error).message.split("\n").join("\n  ")}`);
  }
}

const cube = (k: Kernel, x: number, y: number, z: number, w: number, d: number, h: number) => k.Manifold.cube([w, d, h]).translate([x, y, z]);
/** Volume shared by two solids, in mm³. */
const overlap = (a: Manifold, b: Manifold) => a.intersect(b).volume();
const valuesOf = (id: string, extra: Values = {}) => ({ ...defaults(partDef(id)!), ...extra });

// --- The catalog ------------------------------------------------------------------

const ids = new Set<string>();
for (const item of PRINTS) {
  test(`${item.id}: catalog entry`, () => {
    assert.ok(!ids.has(item.id), "duplicate id");
    ids.add(item.id);
    assert.match(item.id, /^[a-z0-9-]+$/);
    const def = partDef(item.part);
    assert.ok(def, `no part "${item.part}"`);
    for (const key of Object.keys(item.values ?? {})) assert.ok(def.params.some((p) => p.key === key), `unknown parameter ${key}`);
    if (item.tested) assert.match(item.tested.date, /^\d{4}-\d{2}-\d{2}$/);
  });
  test(`${item.id}: builds, one solid per piece, fits the bed`, () => {
    const def = partDef(item.part)!;
    const { mesh } = build(k, (k) => def.make(k, cleanValues(def, { ...defaults(def), ...item.values })));
    assert.ok(mesh.volume > 1000, `volume ${mesh.volume}`);
    assert.ok(mesh.size[0] <= BED.x && mesh.size[1] <= BED.y && mesh.size[2] <= BED.z, `too big for the bed: ${mesh.size.join(" x ")}`);
    assert.equal(mesh.pieces, item.part === "board-case" ? 2 : 1, "pieces on the bed");
    // Formats round-trip.
    const stl = toStl(mesh, item.id);
    const back = parseStl(stl.buffer as ArrayBuffer);
    assert.equal(back.positions.length, mesh.triangles.length * 3);
    const files = unzipSync(to3mf(mesh, item.id));
    const model = strFromU8(files["3D/3dmodel.model"]);
    assert.match(model, /unit="millimeter"/);
    assert.equal((model.match(/<triangle /g) ?? []).length, mesh.triangles.length / 3);
    const png = renderPng(mesh, { width: 64, height: 40 });
    assert.deepEqual([...png.subarray(1, 4)], [80, 78, 71]);
  });
}

test("every board with a case suggestion has a case in the catalog", () => {
  for (const [board, id] of Object.entries(CASE_FOR_BOARD)) {
    assert.ok(PRINTS.some((p) => p.id === id), `${board}: no ${id}`);
    assert.ok(CASE_BOARDS[board], `${board}: no case board shape`);
  }
});

// --- Every part across its ranges ---------------------------------------------------

let seed = 7;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
for (const def of PART_DEFS) {
  test(`${def.id}: builds at the ends of every range and at random values`, () => {
    const sets: Values[] = [];
    const lo: Values = {}, hi: Values = {};
    for (const p of def.params) {
      if (p.kind === "number") (lo[p.key] = p.min), (hi[p.key] = p.max);
      if (p.kind === "bool") (lo[p.key] = false), (hi[p.key] = true);
    }
    sets.push(lo, hi);
    for (let i = 0; i < 12; i++) {
      const v: Values = {};
      for (const p of def.params) {
        if (p.kind === "number") v[p.key] = p.min + Math.round(((p.max - p.min) * rand()) / p.step) * p.step;
        else if (p.kind === "bool") v[p.key] = rand() > 0.5;
        else v[p.key] = p.options[Math.floor(rand() * p.options.length)];
      }
      sets.push(v);
    }
    for (const s of sets) {
      const v = cleanValues(def, s);
      try {
        build(k, (k) => def.make(k, v));
      } catch (e) {
        throw new Error(`${JSON.stringify(v)}: ${(e as Error).message}`);
      }
    }
  });
}

test("cleanValues clamps numbers and ignores unknown choices", () => {
  const def = partDef("board-case")!;
  const v = cleanValues(def, { length: "9999", board: "nope", oled: "1", wall: "abc" });
  assert.equal(v.length, 120);
  assert.equal(v.board, "esp32");
  assert.equal(v.oled, true);
  assert.equal(v.wall, 2);
});

// --- Fit: board cases ----------------------------------------------------------------

for (const board of Object.keys(CASE_BOARDS)) {
  for (const extra of [{}, { oled: true, button: 12, tabs: true }] as Values[]) {
    const shape = CASE_BOARDS[board];
    const v = valuesOf("board-case", { board, length: shape.length, width: shape.width, rows: shape.rows, ...extra });
    const L = caseLayout(v);
    test(`case for ${board}${extra.oled ? " with display and button" : ""}: board, plug and lid fit`, () => {
      build(k, (kk) => partDef("board-case")!.make(kk, v), (solid) => {
        const [base, lid] = solid.decompose().sort((a, b) => a.boundingBox().min[1] - b.boundingBox().min[1]);
        // The board, and the header pins and plugs under its edges, sit in free space.
        assert.ok(overlap(base, cube(k, L.boardX, L.boardY, L.boardZ, L.length, L.width, 1.6)) < 0.01, "the board hits the case");
        const rowY0 = L.boardY + (L.width - L.rows) / 2;
        for (const y of [rowY0, rowY0 + L.rows]) {
          assert.ok(overlap(base, cube(k, L.boardX, y - 1.6, L.boardZ - 11, L.length, 3.2, 11)) < 0.01, "a header row hits the rail");
        }
        // The rail holds it up.
        assert.ok(overlap(base, cube(k, L.boardX, L.boardY, L.boardZ - 0.2, L.length, L.width, 0.2)) > 1, "nothing under the board");
        // A USB plug goes straight in from outside to the board's end.
        assert.ok(overlap(base, cube(k, -5, L.outerW / 2 - 5, L.boardZ + 1.6 + 1.6 - 3, L.boardX + 5, 10, 6)) < 0.01, "the USB plug is blocked");
        // The lid, turned over onto the base, overlaps nothing.
        const flipped = lid.rotate([180, 0, 0]);
        const fb = flipped.boundingBox();
        const placed = flipped.translate([0, -fb.min[1], L.height + 2 - fb.max[2]]);
        assert.ok(overlap(base, placed) < 0.01, `the lid collides with the base: ${overlap(base, placed).toFixed(2)} mm³`);
        // And it is snug: the lip is no more than the fit clearance away from the walls.
        const grown = placed.translate([L.fit + 0.15, 0, 0]);
        assert.ok(overlap(base, grown) > 0.01, "the lid is loose");
        // Everything sits on the bed.
        assert.equal(solid.boundingBox().min[2], 0);
        return null;
      });
    });
  }
}

// --- Fit: robot plates ------------------------------------------------------------------

for (const [id, axle] of [
  ["chassis-plate", (v: Values) => -Number(v.length) / 2 + 30],
  ["balance-base", balanceAxleX],
] as const) {
  for (const extra of [{}, { wheel: 90, motorLength: 80, motorWidth: 28 }, { wheel: 40, motorWidth: 18 }] as Values[]) {
    const v = valuesOf(id, extra);
    test(`${id} ${JSON.stringify(extra)}: motors and wheels clear the plate`, () => {
      const t = Number(v.thickness);
      const M = motorLayout(v, Number(v.length), Number(v.width), axle(v));
      assert.ok(M.rear >= -Number(v.length) / 2 - 0.01 && M.front + 3.3 <= Number(v.length) / 2, "the motor hangs off the plate");
      build(k, (kk) => partDef(id)!.make(kk, v), (plate) => {
        for (const side of [-1, 1]) {
          const my = side * M.motorY;
          // The motor body, under the plate (up, as printed).
          const motor = cube(k, M.rear, my - M.mW / 2, t, M.mL, M.mW, M.mH);
          assert.ok(overlap(plate, motor) < 0.01, "a motor hits the plate or its rails");
          // The rails hold it: they touch a slightly wider motor.
          assert.ok(overlap(plate, cube(k, M.rear + 5, my - M.mW / 2 - 0.5, t, M.mL - 10, M.mW + 1, 2)) > 0.1, "no rails beside the motor");
          // The wheel, on the shaft beside the motor.
          const y0 = side > 0 ? my + M.mW / 2 + 2 : my - M.mW / 2 - 2 - 26;
          const wheel = k.Manifold.cylinder(26, M.R, M.R, 48).rotate([-90, 0, 0]).translate([M.axleX, y0, t + M.mH / 2]);
          assert.ok(overlap(plate, wheel) < 0.01, `a wheel rubs the plate: ${overlap(plate, wheel).toFixed(2)} mm³`);
        }
        if (id === "chassis-plate") {
          // The skid reaches the floor: its tip is as far from the plate as the floor is.
          const top = plate.boundingBox().max[2];
          assert.ok(Math.abs(top - (t + M.deck)) < 0.05, `skid ends at ${top}, floor at ${t + M.deck}`);
        }
        return null;
      });
    });
  }
}

test("sonar bracket: both transducers pass through, foot slots on the 10 mm grid", () => {
  const v = valuesOf("sonar-bracket");
  const S = sonarLayout(v);
  build(k, (kk) => partDef("sonar-bracket")!.make(kk, v), (part) => {
    for (const s of [-1, 1]) {
      const can = k.Manifold.cylinder(20, 8, 8, 64).translate([(s * S.spacing) / 2, S.t + S.centre, -5]);
      assert.ok(overlap(part, can) < 0.01, "a transducer hits the face");
      // The module's board (45 x 20) sits behind the face, above the foot.
      assert.ok(overlap(part, cube(k, -22.5, S.t + S.centre - 10, S.t, 45, 20, 1.6)) < 0.01, "the module's board hits the bracket");
      // An M3 bolt through each slot.
      const bolt = k.Manifold.cylinder(10, 1.5, 1.5, 24).rotate([-90, 0, 0]).translate([s * 15, -2, S.t + S.foot / 2 + 1]);
      assert.ok(overlap(part, bolt) < 0.01, "no slot for the bolt");
    }
    return null;
  });
});

test("line sensor mount: bolts on the grid, slots run down each tab", () => {
  const v = valuesOf("line-mount");
  const L = lineLayout(v);
  build(k, (kk) => partDef("line-mount")!.make(kk, v), (part) => {
    for (const s of [-1, 1]) {
      const down = k.Manifold.cylinder(10, 1.5, 1.5, 24).translate([s * 20, L.depth / 2 + 1.5, -2]);
      assert.ok(overlap(part, down) < 0.01, "no hole for the bolt into the plate");
      for (const z of [L.bar + 4.8, L.bar + L.drop - 4]) {
        const bolt = k.Manifold.cylinder(10, 1.5, 1.5, 24).rotate([-90, 0, 0]).translate([(s * L.spacing) / 2, -2, z]);
        assert.ok(overlap(part, bolt) < 0.01, `the slot does not reach ${z.toFixed(1)}`);
      }
    }
    return null;
  });
});

console.log(`${passed} passed, ${failures} failed`);
if (failures) process.exit(1);
