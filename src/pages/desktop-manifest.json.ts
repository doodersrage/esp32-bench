// The project library for the ESP32 Bench desktop app, as one versioned file.
// Its format is defined by schema/project-manifest/ in the esp32-desktop repository;
// bump MANIFEST_VERSION with any change (minor: new optional field; major: anything
// a reader could misread). Per-board pins, wiring and code are filled in here with
// forBoard(), so the app never re-implements the %VAR% substitution.
import type { APIRoute } from "astro";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { BOARDS } from "../data/boards";
import { PROJECTS, boardsOf, forBoard } from "../data/projects";
import { LAB_EXPECT } from "../data/lab-expect";
import COMPILE from "../data/compile-libs.json";

const REGISTRY: Record<string, string> = COMPILE.libs;

export const MANIFEST_VERSION = "1.1.0";
const SITE = "https://esp32bench.dev";

// The esp-web-tools chip family of each chip, as the browser flasher's manifests name them.
const FAMILY: Record<string, string> = {
  esp32: "ESP32",
  esp32s2: "ESP32-S2",
  esp32s3: "ESP32-S3",
  esp32c3: "ESP32-C3",
  esp32c6: "ESP32-C6",
};

// Prebuilt firmware for a board, from the browser flasher's manifest in public/: the
// app downloads it, checks its SHA-256 and size, then runs it in its simulator or
// flashes it. Only a single image written at offset 0 (a merged image) is offered.
function prebuiltImage(manifestPath: string | undefined, chip: string) {
  if (!manifestPath) return undefined;
  const file = join("public", manifestPath);
  const flasher = JSON.parse(readFileSync(file, "utf8"));
  const build = flasher.builds?.find((b: any) => b.chipFamily === FAMILY[chip]);
  if (!build || build.parts?.length !== 1 || build.parts[0].offset !== 0) return undefined;
  const bin = join(dirname(file), build.parts[0].path);
  const bytes = readFileSync(bin);
  return {
    url: `${SITE}${dirname(manifestPath)}/${build.parts[0].path}`,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    size: bytes.length,
  };
}

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
        // Libraries to download before building, with their registry ids. Built-in
        // libraries (part of the ESP32 core) are not listed.
        install: omitEmpty(
          p.libs.filter((l) => REGISTRY[l] !== undefined).map((l) => ({ library: l, registry: REGISTRY[l] })),
        ),
        // Arduino-ESP32 partition scheme, when the default app partition is too small.
        partitions: COMPILE.hugeApp.includes(p.id) ? "huge_app" : undefined,
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
            image:
              p.code === undefined
                ? prebuiltImage(p.flash?.manifest, BOARDS.find((x) => x.id === board)?.chip ?? "")
                : undefined,
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
