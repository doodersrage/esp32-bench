// The project library for the ESP32 Bench desktop app, as one versioned file.
// Its format is defined by schema/project-manifest/ in the esp32-desktop repository;
// bump MANIFEST_VERSION with any change (minor: new optional field; major: anything
// a reader could misread). Per-board pins, wiring and code are filled in here with
// forBoard(), so the app never re-implements the %VAR% substitution.
import type { APIRoute } from "astro";
import { BOARDS } from "../data/boards";
import { PROJECTS, boardsOf, forBoard } from "../data/projects";
import { LAB_EXPECT } from "../data/lab-expect";

export const MANIFEST_VERSION = "1.0.0";
const SITE = "https://esp32bench.dev";

const omitEmpty = <T,>(xs: T[] | undefined): T[] | undefined => (xs && xs.length > 0 ? xs : undefined);

export function desktopManifest(generated = new Date().toISOString()) {
  return {
    format: "esp32bench-project-manifest",
    version: MANIFEST_VERSION,
    generated,
    site: SITE,
    licence: { code: "MIT", content: "CC-BY-4.0" },
    boards: BOARDS.map((b) => ({
      id: b.id,
      name: b.name,
      short: b.short,
      chip: b.chip,
      arduinoBoard: b.arduinoBoard,
      variantOf: b.variantOf,
      buildAs: b.buildAs,
    })),
    projects: PROJECTS.map((p) => {
      const expect = LAB_EXPECT[p.id];
      return {
        id: p.id,
        name: p.name,
        url: `${SITE}/projects/${p.id}`,
        level: p.level,
        minutes: p.mins,
        tags: p.tags,
        added: p.added,
        summary: p.sum,
        firmware: p.code !== undefined ? "sketch" : "prebuilt",
        sourceUrl: p.sourceUrl,
        libraries: p.libs,
        baud: p.baud,
        needs: p.needs,
        parts: p.parts.map(([quantity, name, link]) => ({ quantity, name, link })),
        settings: omitEmpty(p.settings),
        notes: omitEmpty(p.notes),
        open: omitEmpty(p.open),
        verified: omitEmpty(p.verified),
        expect: expect
          ? { patterns: expect.patterns, seconds: expect.seconds, needs: expect.needs, notes: expect.notes }
          : undefined,
        extra: p.extraCode,
        builds: boardsOf(p).map((board) => {
          const b = forBoard(p, board);
          return {
            board,
            pins: b.pins,
            wiring: b.wiring.map(([from, to, note]) => ({ from, to, note })),
            code: b.code,
            sample: b.sample,
          };
        }),
      };
    }),
  };
}

export const GET: APIRoute = () =>
  new Response(JSON.stringify(desktopManifest()), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
