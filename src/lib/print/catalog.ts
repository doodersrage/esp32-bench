// Build a catalog entry into its mesh once per build, for the downloads, the
// thumbnails and the page that lists them.
import { build, loadKernel, type MeshData } from "./kernel.ts";
import { cleanValues, defaults, partDef, type Values } from "./parts.ts";
import type { PrintItem } from "../../data/prints";
import { assembly, type Colour } from "./assembly.ts";
import { buildAssembly } from "./kernel.ts";
import { renderPng } from "./render.ts";

const cache = new Map<string, Promise<MeshData>>();

export const printValues = (item: PrintItem): Values => {
  const def = partDef(item.part);
  if (!def) throw new Error(`prints: ${item.id} uses an unknown part "${item.part}"`);
  return cleanValues(def, { ...defaults(def), ...item.values });
};

export function printMesh(item: PrintItem): Promise<MeshData> {
  let m = cache.get(item.id);
  if (!m) {
    m = loadKernel().then((k) => build(k, (k) => partDef(item.part)!.make(k, printValues(item))).mesh);
    cache.set(item.id, m);
  }
  return m;
}

/** The "how it goes together" picture, as PNG. */
export async function assemblyPng(item: PrintItem, width = 480, height = 320): Promise<Uint8Array> {
  const k = await loadKernel();
  let colours: Colour[] = [];
  const v = printValues(item);
  const { mesh, triangleParts } = buildAssembly(k, (k) => {
    const pieces = assembly(k, item.part, v);
    if (!pieces) throw new Error(`prints: no assembly for ${item.part}`);
    colours = pieces.map((p) => p.colour);
    return pieces.map((p) => p.solid);
  });
  return renderPng(mesh, { width, height, azimuth: -35, elevation: 22, triangleColours: triangleParts, palette: colours });
}
