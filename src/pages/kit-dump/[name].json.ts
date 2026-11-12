// Every project's parts list, for tests/kit.test.ts. Only built when DUMP_KIT=1,
// so it never ships with the site.
import type { APIRoute } from "astro";
import { PROJECTS } from "../../data/projects";

export function getStaticPaths() {
  return process.env.DUMP_KIT === "1" ? [{ params: { name: "parts" } }] : [];
}

export const GET: APIRoute = () =>
  new Response(JSON.stringify(PROJECTS.map((p) => ({ id: p.id, parts: p.parts.map(([qty, text]) => [qty, text]) }))), {
    headers: { "Content-Type": "application/json" },
  });
