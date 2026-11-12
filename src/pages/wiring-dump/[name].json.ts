// Every project's wiring per board, with that board's header, for the wiring
// diagram test (tests/wiring-diagram.test.ts). Only built when DUMP_WIRING=1,
// so it never ships with the site.
import type { APIRoute } from "astro";
import { PROJECTS, boardsOf, forBoard } from "../../data/projects";
import { boardById } from "../../data/boards";

export function getStaticPaths() {
  return process.env.DUMP_WIRING === "1" ? [{ params: { name: "all" } }] : [];
}

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      PROJECTS.flatMap((p) =>
        boardsOf(p).map((id) => {
          const b = boardById(id);
          return { id: p.id, board: id, left: b.left, right: b.right, gpioOf: b.gpioOf ?? {}, wiring: forBoard(p, id).wiring };
        }),
      ),
    ),
    { headers: { "Content-Type": "application/json" } },
  );
