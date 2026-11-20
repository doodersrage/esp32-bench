// File formats for printable parts. 3MF keeps the solid exactly as built and
// carries its units, so slicers open it at the right size; STL is the format
// every slicer and printer tool reads. Both are written here without a library
// beyond fflate (already used by the site) for the 3MF zip.
import { zipSync, strToU8 } from "fflate";
import type { MeshData } from "./kernel";

/** Binary STL. */
export function toStl(mesh: MeshData, name: string): Uint8Array {
  const tris = mesh.triangles.length / 3;
  const out = new Uint8Array(84 + tris * 50);
  const view = new DataView(out.buffer);
  const header = strToU8(`ESP32 Bench ${name}`.slice(0, 79));
  out.set(header, 0);
  view.setUint32(80, tris, true);
  const p = mesh.positions;
  let o = 84;
  for (let t = 0; t < tris; t++) {
    const a = mesh.triangles[t * 3] * 3;
    const b = mesh.triangles[t * 3 + 1] * 3;
    const c = mesh.triangles[t * 3 + 2] * 3;
    const n = normal(p, a, b, c);
    for (const v of [n[0], n[1], n[2], p[a], p[a + 1], p[a + 2], p[b], p[b + 1], p[b + 2], p[c], p[c + 1], p[c + 2]]) {
      view.setFloat32(o, v, true);
      o += 4;
    }
    o += 2; // attribute byte count
  }
  return out;
}

/** 3MF: a zip holding one mesh object, in millimetres. */
export function to3mf(mesh: MeshData, name: string): Uint8Array {
  const p = mesh.positions;
  const verts: string[] = [];
  for (let i = 0; i < p.length; i += 3) verts.push(`<vertex x="${num(p[i])}" y="${num(p[i + 1])}" z="${num(p[i + 2])}"/>`);
  const tris: string[] = [];
  const t = mesh.triangles;
  for (let i = 0; i < t.length; i += 3) tris.push(`<triangle v1="${t[i]}" v2="${t[i + 1]}" v3="${t[i + 2]}"/>`);
  const model =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">\n` +
    `<metadata name="Title">${escapeXml(name)}</metadata>\n<metadata name="Designer">ESP32 Bench</metadata>\n` +
    `<resources><object id="1" type="model" name="${escapeXml(name)}"><mesh><vertices>${verts.join("")}</vertices>` +
    `<triangles>${tris.join("")}</triangles></mesh></object></resources>\n` +
    `<build><item objectid="1"/></build>\n</model>\n`;
  return zipSync(
    {
      "[Content_Types].xml": strToU8(
        `<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
          `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
          `<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>\n`,
      ),
      "_rels/.rels": strToU8(
        `<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>\n`,
      ),
      "3D/3dmodel.model": strToU8(model),
    },
    { level: 6, mtime: new Date("2026-01-01T00:00:00Z") },
  );
}

/** Read a binary STL back into triangles, for the 3D preview. */
export function parseStl(buf: ArrayBuffer): { positions: Float32Array; normals: Float32Array } {
  const view = new DataView(buf);
  const tris = view.getUint32(80, true);
  if (84 + tris * 50 > buf.byteLength) throw new Error("not a binary STL file");
  const positions = new Float32Array(tris * 9);
  const normals = new Float32Array(tris * 9);
  for (let t = 0; t < tris; t++) {
    const o = 84 + t * 50;
    for (let v = 0; v < 9; v++) positions[t * 9 + v] = view.getFloat32(o + 12 + v * 4, true);
    const n = normal(positions, t * 9, t * 9 + 3, t * 9 + 6);
    for (let v = 0; v < 3; v++) normals.set(n, t * 9 + v * 3);
  }
  return { positions, normals };
}

/** Flat-shaded triangles for the preview, straight from a built part. */
export function flatTriangles(mesh: MeshData): { positions: Float32Array; normals: Float32Array } {
  const n = mesh.triangles.length;
  const positions = new Float32Array(n * 3);
  const normals = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) positions.set(mesh.positions.subarray(mesh.triangles[i] * 3, mesh.triangles[i] * 3 + 3), i * 3);
  for (let t = 0; t < n; t += 3) {
    const nn = normal(positions, t * 3, t * 3 + 3, t * 3 + 6);
    for (let v = 0; v < 3; v++) normals.set(nn, (t + v) * 3);
  }
  return { positions, normals };
}

function normal(p: ArrayLike<number>, a: number, b: number, c: number): [number, number, number] {
  const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
  const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}

const num = (n: number) => String(Math.round(n * 1000) / 1000);
const escapeXml = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);

/**
 * A rough filament weight in grams: PLA at 1.24 g/cm³, counting the solid
 * shells as 40 % of the volume and the infill percentage of the rest. A slicer
 * gives the real figure.
 */
export const estimateGrams = (mm3: number, infill: number) => Math.max(1, Math.round((mm3 / 1000) * 1.24 * (0.4 + (0.6 * infill) / 100)));
