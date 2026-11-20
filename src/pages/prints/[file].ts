// The catalog downloads: /prints/<id>.3mf, /prints/<id>.stl and the
// thumbnail /prints/<id>.png, built from the part code on every build.
import type { APIRoute } from "astro";
import { PRINTS, type PrintItem } from "../../data/prints";
import { assemblyPng, printMesh } from "../../lib/print/catalog";
import { HAS_ASSEMBLY } from "../../lib/print/assembly";
import { to3mf, toStl } from "../../lib/print/formats";
import { renderPng } from "../../lib/print/render";

const TYPES = { stl: "model/stl", "3mf": "model/3mf", png: "image/png" } as const;
type Ext = keyof typeof TYPES;

export function getStaticPaths() {
  return PRINTS.flatMap((item) => [
    ...(Object.keys(TYPES) as Ext[]).map((ext) => ({ params: { file: `${item.id}.${ext}` }, props: { item, ext } })),
    ...(HAS_ASSEMBLY.has(item.part) ? [{ params: { file: `${item.id}-assembly.png` }, props: { item, ext: "assembly" } }] : []),
  ]);
}

export const GET: APIRoute = async ({ props }) => {
  const { item, ext } = props as { item: PrintItem; ext: Ext | "assembly" };
  if (ext === "assembly") return new Response((await assemblyPng(item)) as BodyInit, { headers: { "Content-Type": "image/png" } });
  const mesh = await printMesh(item);
  const body =
    ext === "stl"
      ? toStl(mesh, item.id)
      : ext === "3mf"
        ? to3mf(mesh, item.id, `${item.material}, ${item.layer} mm layers, ${item.infill}% infill, ${item.walls} walls, no supports. https://esp32bench.dev/prints/#${item.id}`)
        : renderPng(mesh, { width: 480, height: 320, azimuth: -35, elevation: 32 });
  return new Response(body as BodyInit, { headers: { "Content-Type": TYPES[ext] } });
};
