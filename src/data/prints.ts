// The 3D-printable parts catalog (/prints/). Each entry is one download: a part
// from src/lib/print/parts.ts with its parameter values, the projects it
// belongs to, and how to print it. Names, summaries and notes are UI strings in
// src/i18n/strings/prints.ts, keyed by `id`.
//
// Test-printed or draft: an entry without `tested` is a draft, built from
// nominal dimensions and checked only in code (tests/prints.test.ts). After
// printing one and fitting the real parts, add `tested` with the date, the
// printer and anything that needed changing. Change the defaults first if
// something did not fit, so the download is the version that worked.
import type { Values } from "../lib/print/parts";

export interface PrintTest {
  /** YYYY-MM-DD */
  date: string;
  printer: string;
  material: string;
  /** what was fitted to it, in English */
  fitted: string;
}

export interface PrintItem {
  id: string;
  /** a part in PART_DEFS */
  part: string;
  /** parameter values that differ from the part's defaults */
  values?: Values;
  /** projects this part is made for */
  projects?: string[];
  /** also show it on any project whose parts list matches */
  forParts?: RegExp;
  /** a parts line this can stand in for, wholly or partly; the project page offers it there (text: replace.<id>) */
  replaces?: RegExp;
  /** catalog section */
  group?: "start" | "robots" | "weather" | "cases";
  /** how many to print for one build */
  copies?: number;
  material: string;
  /** layer height in mm */
  layer: number;
  /** infill in percent */
  infill: number;
  /** perimeters */
  walls: number;
  tested?: PrintTest;
}

export const BED = { x: 220, y: 220, z: 250 };

const CARS = ["wifi-car", "remote-car", "obstacle-car", "line-follower"];
const WEATHER = ["outdoor-weather", "bme280-web"];

export const PRINTS: PrintItem[] = [
  { id: "fit-test", part: "fit-test", group: "start", material: "PLA", layer: 0.2, infill: 20, walls: 3 },
  { id: "chassis-plate", part: "chassis-plate", projects: CARS, replaces: /robot car chassis/i, material: "PLA or PETG", layer: 0.2, infill: 25, walls: 3 },
  { id: "sonar-bracket", part: "sonar-bracket", projects: ["obstacle-car", "hcsr04"], material: "PLA", layer: 0.2, infill: 30, walls: 3 },
  { id: "line-mount", part: "line-mount", projects: ["line-follower"], material: "PLA", layer: 0.2, infill: 30, walls: 3 },
  { id: "balance-base", part: "balance-base", projects: ["balance-bot"], material: "PLA or PETG", layer: 0.2, infill: 30, walls: 3 },
  { id: "balance-deck", part: "balance-deck", projects: ["balance-bot"], copies: 2, material: "PLA", layer: 0.2, infill: 20, walls: 3 },
  {
    id: "remote-case",
    part: "board-case",
    values: { board: "esp32", joystick: true, wireSlot: false, vents: false },
    projects: ["remote-car"],
    group: "robots",
    material: "PLA",
    layer: 0.2,
    infill: 15,
    walls: 3,
  },
  { id: "shield-plate", part: "shield-plate", projects: WEATHER, group: "weather", copies: 5, material: "PETG or ASA, white", layer: 0.2, infill: 20, walls: 3 },
  { id: "shield-top", part: "shield-top", projects: WEATHER, group: "weather", material: "PETG or ASA, white", layer: 0.2, infill: 20, walls: 3 },
  { id: "shield-base", part: "shield-base", projects: WEATHER, group: "weather", replaces: /radiation shield/i, material: "PETG or ASA, white", layer: 0.2, infill: 30, walls: 3 },
  { id: "case-esp32", part: "board-case", values: { board: "esp32" }, material: "PLA", layer: 0.2, infill: 15, walls: 3 },
  { id: "case-esp32-doit", part: "board-case", values: { board: "esp32-doit", length: 51.5, width: 28.5, rows: 22.86 }, material: "PLA", layer: 0.2, infill: 15, walls: 3 },
  { id: "case-esp32s3", part: "board-case", values: { board: "esp32s3", length: 62.7, width: 28, rows: 25.4 }, material: "PLA", layer: 0.2, infill: 15, walls: 3 },
  {
    id: "case-esp32c3-supermini",
    part: "board-case",
    values: { board: "esp32c3-supermini", length: 22.5, width: 18, rows: 15.24, tabs: true },
    material: "PLA",
    layer: 0.2,
    infill: 15,
    walls: 3,
  },
  {
    id: "case-esp32-oled",
    part: "board-case",
    values: { board: "esp32", oled: true },
    forParts: /SSD1306 OLED/,
    material: "PLA",
    layer: 0.2,
    infill: 15,
    walls: 3,
  },
];

export const printById = (id: string) => PRINTS.find((p) => p.id === id);

/** The catalog section an entry is listed under. */
export const printGroup = (item: PrintItem): NonNullable<PrintItem["group"]> => item.group ?? (item.part === "board-case" ? "cases" : "robots");

/** The board case to suggest for a board on the site, if there is one. */
export const CASE_FOR_BOARD: Record<string, string> = {
  esp32: "case-esp32",
  "esp32-doit": "case-esp32-doit",
  esp32s3: "case-esp32s3",
  "esp32c3-supermini": "case-esp32c3-supermini",
};
