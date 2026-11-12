// What the hardware lab needs to know about each project: the serial speed, the
// boards it supports, what it should print, and which settings to send first.
// Read by lab/runner.py from https://esp32bench.dev/lab-manifest.json.
import type { APIRoute } from "astro";
import { PROJECTS, boardsOf, forBoard } from "../data/projects";
import { CHIP_FOR_BOARD, LAB_EXPECT } from "../data/lab-expect";

export const GET: APIRoute = () => {
  const projects: Record<string, unknown> = {};
  for (const p of PROJECTS) {
    if (p.code === undefined) continue;
    const expect = LAB_EXPECT[p.id];
    const boards = boardsOf(p);
    projects[p.id] = {
      name: p.name,
      baud: p.baud,
      boards,
      chips: Object.fromEntries(boards.map((b) => [b, CHIP_FOR_BOARD[b] ?? b])),
      expect: expect ?? null,
      settings: expect?.settings ?? [],
      sample: forBoard(p, boards[0]).sample,
    };
  }
  return new Response(JSON.stringify({ generated: new Date().toISOString(), projects }, null, 1), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
};
