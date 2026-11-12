// Every library sketch with each board's pins filled in, for the weekly compile
// check (scripts/check-sketches.mjs). Only built when DUMP_SKETCHES=1, so it never
// ships with the site.
import type { APIRoute } from "astro";
import { PROJECTS, boardsOf, forBoard } from "../../data/projects";

export function getStaticPaths() {
  return process.env.DUMP_SKETCHES === "1" ? [{ params: { name: "all" } }] : [];
}

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      PROJECTS.filter((p) => p.code !== undefined).flatMap((p) =>
        boardsOf(p).map((board) => ({ id: p.id, name: p.name, board, libs: p.libs, settings: p.settings, code: forBoard(p, board).code })),
      ),
    ),
    { headers: { "Content-Type": "application/json" } },
  );
