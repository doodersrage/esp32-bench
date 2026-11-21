// The geometry kernel behind every 3D-printable part: manifold-3d, a WASM
// solid modelling library. The same part code runs at build time (to write the
// STL and 3MF downloads) and in the browser (the part maker on /prints/make/).
//
// Every manifold-3d object lives in WASM memory and must be freed by hand.
// `build` does that: it records every object made while a part is built and
// frees them all once the part's triangles have been copied out.
import type { CrossSection, Manifold, ManifoldToplevel } from "manifold-3d";

export type Kernel = ManifoldToplevel;
export type { CrossSection, Manifold };

/** A finished part: plain triangles in millimetres, Z up, resting on Z = 0. */
export interface MeshData {
  /** x, y, z for each vertex */
  positions: Float32Array;
  /** three vertex indices per triangle, wound counter-clockwise seen from outside */
  triangles: Uint32Array;
  /** size of the bounding box, in mm */
  size: [number, number, number];
  /** cubic millimetres */
  volume: number;
  /** separate pieces on the bed (a case and its lid are two) */
  pieces: number;
}

let loading: Promise<Kernel> | undefined;

/**
 * Load manifold-3d once. In the browser pass the URL of manifold.wasm (from a
 * `?url` import); in Node it finds the file next to its own script.
 */
export function loadKernel(wasmUrl?: string): Promise<Kernel> {
  loading ??= (async () => {
    const { default: Module } = await import("manifold-3d");
    const wasm = await Module(wasmUrl ? { locateFile: () => wasmUrl } : undefined);
    wasm.setup();
    track(wasm);
    return wasm;
  })();
  return loading;
}

// --- Freeing WASM memory -----------------------------------------------------

const made: { delete(): void }[] = [];

const MANIFOLD_STATIC = ["cube", "cylinder", "sphere", "extrude", "revolve", "compose", "union", "difference", "intersection", "hull"];
const MANIFOLD_METHODS = ["add", "subtract", "intersect", "decompose", "translate", "rotate", "scale", "mirror", "hull", "transform"];
const SECTION_STATIC = ["square", "circle", "union", "difference", "intersection", "compose", "ofPolygons", "hull"];
const SECTION_METHODS = ["add", "subtract", "intersect", "decompose", "translate", "rotate", "scale", "mirror", "offset", "hull", "transform"];

function intercept(target: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    const original = target[name];
    if (typeof original !== "function") continue;
    target[name] = function (this: unknown, ...args: unknown[]) {
      const out = (original as (...a: unknown[]) => unknown).apply(this, args);
      for (const o of Array.isArray(out) ? out : [out]) if (o && typeof (o as { delete?: unknown }).delete === "function") made.push(o as { delete(): void });
      return out;
    };
  }
}

function track(wasm: Kernel) {
  intercept(wasm.Manifold as unknown as Record<string, unknown>, MANIFOLD_STATIC);
  intercept(wasm.Manifold.prototype as unknown as Record<string, unknown>, MANIFOLD_METHODS);
  intercept(wasm.CrossSection as unknown as Record<string, unknown>, SECTION_STATIC);
  intercept(wasm.CrossSection.prototype as unknown as Record<string, unknown>, SECTION_METHODS);
}

function freeAll() {
  for (const o of made.splice(0)) {
    try {
      o.delete();
    } catch {
      // already freed
    }
  }
}

/**
 * Run a part builder and copy its triangles out of WASM memory. Throws if the
 * result is not a clean solid. `inspect` runs before anything is freed, for
 * tests that measure the solid itself.
 */
export function build<T = void>(k: Kernel, make: (k: Kernel) => Manifold, inspect?: (m: Manifold) => T): { mesh: MeshData; checked: T } {
  try {
    const solid = make(k);
    const status = solid.status();
    if (status !== "NoError") throw new Error(`the part is not a clean solid (${status})`);
    if (solid.isEmpty()) throw new Error("the part came out empty");
    const box = solid.boundingBox();
    // Rest it on the bed.
    const placed = solid.translate([0, 0, -box.min[2]]);
    const mesh = placed.getMesh();
    const positions = new Float32Array(mesh.numVert * 3);
    for (let v = 0; v < mesh.numVert; v++) {
      for (let a = 0; a < 3; a++) positions[v * 3 + a] = mesh.vertProperties[v * mesh.numProp + a];
    }
    const checked = inspect ? inspect(placed) : (undefined as T);
    return {
      mesh: {
        positions,
        triangles: Uint32Array.from(mesh.triVerts),
        size: [0, 1, 2].map((a) => round(box.max[a] - box.min[a])) as [number, number, number],
        volume: placed.volume(),
        pieces: placed.decompose().length,
      },
      checked,
    };
  } finally {
    freeAll();
  }
}

/**
 * Build several solids that belong together (an assembly picture) into one
 * mesh, with the index of the solid each triangle came from. They keep their
 * relative positions; the whole lot is lifted to rest on Z = 0.
 */
export function buildAssembly(k: Kernel, make: (k: Kernel) => Manifold[]): { mesh: MeshData; triangleParts: Uint8Array } {
  try {
    const solids = make(k);
    const minZ = Math.min(...solids.map((s) => s.boundingBox().min[2]));
    const positions: number[] = [];
    const triangles: number[] = [];
    const parts: number[] = [];
    let volume = 0;
    solids.forEach((solid, idx) => {
      const mesh = solid.getMesh();
      const base = positions.length / 3;
      for (let v = 0; v < mesh.numVert; v++) {
        positions.push(mesh.vertProperties[v * mesh.numProp], mesh.vertProperties[v * mesh.numProp + 1], mesh.vertProperties[v * mesh.numProp + 2] - minZ);
      }
      for (const i of mesh.triVerts) triangles.push(base + i);
      for (let tri = 0; tri < mesh.triVerts.length / 3; tri++) parts.push(idx);
      volume += solid.volume();
    });
    const pos = Float32Array.from(positions);
    const size = [0, 1, 2].map((a) => {
      let lo = Infinity, hi = -Infinity;
      for (let i = a; i < pos.length; i += 3) (lo = Math.min(lo, pos[i])), (hi = Math.max(hi, pos[i]));
      return round(hi - lo);
    }) as [number, number, number];
    return { mesh: { positions: pos, triangles: Uint32Array.from(triangles), size, volume, pieces: solids.length }, triangleParts: Uint8Array.from(parts) };
  } finally {
    freeAll();
  }
}

const round = (n: number) => Math.round(n * 10) / 10;
