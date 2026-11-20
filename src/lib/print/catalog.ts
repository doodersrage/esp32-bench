// Build a catalog entry into its mesh once per build, for the downloads, the
// thumbnails and the page that lists them.
import { build, loadKernel, type MeshData } from "./kernel";
import { cleanValues, defaults, partDef, type Values } from "./parts";
import type { PrintItem } from "../../data/prints";

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
