// Every phrase of project prose that translations cover (src/i18n/content.ts),
// for scripts/i18n-content.mjs. Only built when DUMP_I18N=1, so it never ships.
import type { APIRoute } from "astro";
import { PROJECTS } from "../../data/projects";
import { projectPhrases } from "../../i18n/content";

export function getStaticPaths() {
  return process.env.DUMP_I18N === "1" ? [{ params: { name: "source" } }] : [];
}

export const GET: APIRoute = () =>
  new Response(JSON.stringify(Object.fromEntries(PROJECTS.map((p) => [p.id, projectPhrases(p)])), null, 1), {
    headers: { "Content-Type": "application/json" },
  });
