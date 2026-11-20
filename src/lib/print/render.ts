// A picture of a part as PNG: an orthographic three-quarter view, flat shaded,
// drawn with a depth buffer and 3x3 supersampling. Used for the catalog
// thumbnails, made at build time, so the catalog shows every part without
// loading WebGL or WASM.
import { zlibSync } from "fflate";
import type { MeshData } from "./kernel";

export interface RenderOptions {
  width: number;
  height: number;
  /** degrees around the vertical axis */
  azimuth?: number;
  /** degrees above the horizon */
  elevation?: number;
  colour?: [number, number, number];
  background?: [number, number, number];
  padding?: number;
  /** For an assembly: a palette index per triangle, and the palette */
  triangleColours?: Uint8Array;
  palette?: [number, number, number][];
}

const SS = 3; // supersampling factor

export function renderPng(mesh: MeshData, o: RenderOptions): Uint8Array {
  const W = o.width * SS, H = o.height * SS;
  const az = ((o.azimuth ?? -35) * Math.PI) / 180;
  const el = ((o.elevation ?? 30) * Math.PI) / 180;
  const base = o.colour ?? [46, 125, 91];
  const bg = o.background ?? [242, 245, 241];
  const pad = (o.padding ?? 12) * SS;
  const p = mesh.positions, t = mesh.triangles;
  const ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el), se = Math.sin(el);
  const n = p.length / 3;
  const sx = new Float64Array(n), sy = new Float64Array(n), sz = new Float64Array(n);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
    const rx = x * ca - y * sa, ry = x * sa + y * ca;
    sx[i] = rx;
    sy[i] = z * ce - ry * se; // up
    sz[i] = z * se + ry * ce; // toward the viewer
    if (sx[i] < minX) minX = sx[i];
    if (sx[i] > maxX) maxX = sx[i];
    if (sy[i] < minY) minY = sy[i];
    if (sy[i] > maxY) maxY = sy[i];
  }
  const scale = Math.min((W - 2 * pad) / (maxX - minX || 1), (H - 2 * pad) / (maxY - minY || 1));
  const offX = (W - (maxX - minX) * scale) / 2, offY = (H - (maxY - minY) * scale) / 2;
  for (let i = 0; i < n; i++) {
    sx[i] = offX + (sx[i] - minX) * scale;
    sy[i] = H - (offY + (sy[i] - minY) * scale);
  }
  const depth = new Float64Array(W * H).fill(-Infinity);
  const shade = new Float32Array(W * H).fill(-1);
  const colourAt = new Uint8Array(W * H);
  const palette = o.palette ?? [base];
  const L = [-0.45, 0.7, 0.55];
  const ll = Math.hypot(L[0], L[1], L[2]);
  for (let f = 0; f < t.length; f += 3) {
    const a = t[f], b = t[f + 1], c = t[f + 2];
    const ci = o.triangleColours ? o.triangleColours[f / 3] : 0;
    // Screen Y points down, which flips the winding: a face toward the viewer has positive area here.
    const area = (sx[b] - sx[a]) * (sy[c] - sy[a]) - (sx[c] - sx[a]) * (sy[b] - sy[a]);
    if (area <= 0) continue;
    // Normal in camera space, for the light.
    const ax = p[a * 3], ay = p[a * 3 + 1], az3 = p[a * 3 + 2];
    const ux = p[b * 3] - ax, uy = p[b * 3 + 1] - ay, uz = p[b * 3 + 2] - az3;
    const vx = p[c * 3] - ax, vy = p[c * 3 + 1] - ay, vz = p[c * 3 + 2] - az3;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const cx = nx * ca - ny * sa, cyy = nx * sa + ny * ca;
    const camX = cx, camY = nz * ce - cyy * se, camZ = nz * se + cyy * ce;
    const len = Math.hypot(camX, camY, camZ) || 1;
    const light = 0.35 + 0.65 * Math.max(0, (camX * L[0] + camY * L[1] + camZ * L[2]) / (len * ll));
    const x0 = Math.max(0, Math.floor(Math.min(sx[a], sx[b], sx[c])));
    const x1 = Math.min(W - 1, Math.ceil(Math.max(sx[a], sx[b], sx[c])));
    const y0 = Math.max(0, Math.floor(Math.min(sy[a], sy[b], sy[c])));
    const y1 = Math.min(H - 1, Math.ceil(Math.max(sy[a], sy[b], sy[c])));
    for (let y = y0; y <= y1; y++) {
      const py = y + 0.5;
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5;
        const w0 = ((sx[b] - px) * (sy[c] - py) - (sx[c] - px) * (sy[b] - py)) / area;
        const w1 = ((sx[c] - px) * (sy[a] - py) - (sx[a] - px) * (sy[c] - py)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < -1e-9 || w1 < -1e-9 || w2 < -1e-9) continue;
        const z = w0 * sz[a] + w1 * sz[b] + w2 * sz[c];
        const i = y * W + x;
        if (z > depth[i]) {
          depth[i] = z;
          shade[i] = light;
          colourAt[i] = ci;
        }
      }
    }
  }
  // Down-sample and add a thin dark outline where depth jumps, so edges read.
  const rgba = new Uint8Array(o.width * o.height * 4);
  for (let y = 0; y < o.height; y++) {
    for (let x = 0; x < o.width; x++) {
      let r = 0, g = 0, b = 0;
      for (let dy = 0; dy < SS; dy++) {
        for (let dx = 0; dx < SS; dx++) {
          const i = (y * SS + dy) * W + x * SS + dx;
          const s = shade[i];
          if (s < 0) {
            r += bg[0]; g += bg[1]; b += bg[2];
          } else {
            const col = palette[colourAt[i]] ?? base;
            r += col[0] * s + 20; g += col[1] * s + 20; b += col[2] * s + 20;
          }
        }
      }
      const o4 = (y * o.width + x) * 4;
      rgba[o4] = Math.min(255, r / (SS * SS));
      rgba[o4 + 1] = Math.min(255, g / (SS * SS));
      rgba[o4 + 2] = Math.min(255, b / (SS * SS));
      rgba[o4 + 3] = 255;
    }
  }
  return encodePng(rgba, o.width, o.height);
}

// --- PNG -------------------------------------------------------------------------

const CRC = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function encodePng(rgba: Uint8Array, w: number, h: number): Uint8Array {
  // RGB, filter type 0 on each row; the image is opaque.
  const raw = new Uint8Array(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0;
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4, d = y * (1 + w * 3) + 1 + x * 3;
      raw[d] = rgba[s]; raw[d + 1] = rgba[s + 1]; raw[d + 2] = rgba[s + 2];
    }
  }
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, w);
  v.setUint32(4, h);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlibSync(raw, { level: 9 })), chunk("IEND", new Uint8Array())];
  const out = new Uint8Array(parts.reduce((s, x) => s + x.length, 0));
  let o = 0;
  for (const x of parts) {
    out.set(x, o);
    o += x.length;
  }
  return out;
}
