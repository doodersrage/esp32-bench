// Link-preview images (1200x630) rendered at build time: satori lays out the
// card as SVG, resvg turns it into a PNG. No browser needed, so it runs the
// same locally and in GitHub Actions. Styled like public/og.png.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { kitSummary, type KitItem } from "./kit";
import { kitIconSvg } from "./kit-icons";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const C = {
  paper: "#f2f5f1",
  panel: "#ffffff",
  ink: "#14231f",
  muted: "#5a6b65",
  line: "#c8d1cb",
  accent: "#c0341a",
  pad: "#7f5a0c",
  padSoft: "#f4e7c4",
  ok: "#1d7a4c",
  warn: "#935600",
  termBg: "#13211e",
  termInk: "#d9e5df",
  gold: "#e2b755",
};

// satori needs woff or ttf, not woff2. Read once per build.
const fontFile = (pkg: string, file: string) =>
  readFileSync(join(process.cwd(), "node_modules", "@fontsource", pkg, "files", file));
let fonts: Parameters<typeof satori>[1]["fonts"] | undefined;
function loadFonts() {
  fonts ??= [
    { name: "Saira Condensed", data: fontFile("saira-condensed", "saira-condensed-latin-700-normal.woff"), weight: 700, style: "normal" },
    { name: "IBM Plex Sans", data: fontFile("ibm-plex-sans", "ibm-plex-sans-latin-400-normal.woff"), weight: 400, style: "normal" },
    { name: "IBM Plex Sans", data: fontFile("ibm-plex-sans", "ibm-plex-sans-latin-600-normal.woff"), weight: 600, style: "normal" },
    // Greek subset for Ω in resistor values on the kit cards.
    { name: "IBM Plex Sans Greek", data: fontFile("ibm-plex-sans", "ibm-plex-sans-greek-600-normal.woff"), weight: 600, style: "normal" },
    { name: "IBM Plex Mono", data: fontFile("ibm-plex-mono", "ibm-plex-mono-latin-500-normal.woff"), weight: 500, style: "normal" },
  ];
  return fonts;
}

// A tiny element builder, so the cards need no JSX.
type Style = Record<string, string | number>;
type Child = Node | string;
interface Node {
  type: string;
  props: { style?: Style; children?: Child | Child[]; src?: string; width?: number; height?: number };
}
const el = (type: string, style: Style, ...children: Child[]): Node => ({
  type,
  props: { style: { display: "flex", ...style }, children: children.length === 1 ? children[0] : children },
});

const CHIP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g stroke="${C.gold}" stroke-width="2" stroke-linecap="round"><path d="M11 3v4M16 3v4M21 3v4M11 25v4M16 25v4M21 25v4M3 11h4M3 16h4M3 21h4M25 11h4M25 16h4M25 21h4"/></g><rect x="7" y="7" width="18" height="18" rx="3" fill="${C.paper}"/><circle cx="16" cy="16" r="4" fill="${C.accent}"/></svg>`;
const CHIP_URI = `data:image/svg+xml;base64,${Buffer.from(CHIP_SVG).toString("base64")}`;

function header(kind: string): Node {
  return el(
    "div",
    { alignItems: "center", gap: 22, width: "100%" },
    el("div", { width: 76, height: 76, background: C.ink, borderRadius: 16, alignItems: "center", justifyContent: "center" }, {
      type: "img",
      props: { src: CHIP_URI, width: 58, height: 58, style: { display: "flex" } },
    }),
    el(
      "div",
      { fontFamily: "Saira Condensed", fontSize: 58, lineHeight: 1, letterSpacing: 1 },
      el("span", { color: C.ink }, "ESP32 "),
      el("span", { color: C.accent }, "BENCH"),
    ),
    el(
      "div",
      {
        marginLeft: "auto",
        fontFamily: "IBM Plex Mono",
        fontSize: 22,
        color: C.muted,
        border: `2px solid ${C.line}`,
        borderRadius: 4,
        padding: "8px 14px",
        textTransform: "uppercase",
        letterSpacing: 2,
      },
      kind,
    ),
  );
}

/** Pick a title size that fits two or three lines inside the card. */
export function titleSize(text: string, max = 92): number {
  const n = text.length;
  if (n <= 22) return max;
  if (n <= 34) return Math.min(max, 80);
  if (n <= 48) return Math.min(max, 66);
  if (n <= 66) return Math.min(max, 56);
  return Math.min(max, 46);
}

function title(text: string, max?: number, lines = 2): Node {
  const size = titleSize(text, max);
  return el(
    "div",
    {
      fontFamily: "Saira Condensed",
      fontSize: size,
      lineHeight: 1.02,
      color: C.ink,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      maxWidth: INNER_W,
      maxHeight: size * 1.02 * lines + 4,
      overflow: "hidden",
      lineClamp: lines,
    },
    text,
  );
}

function line(text: string): Node {
  return el(
    "div",
    { fontFamily: "IBM Plex Sans", fontSize: 30, lineHeight: 1.3, color: C.muted, maxWidth: INNER_W, maxHeight: 80, overflow: "hidden", lineClamp: 2 },
    text,
  );
}

export interface Tag {
  text: string;
  tone?: "plain" | "pad" | "ok" | "warn" | "accent" | "ink";
}

function tags(items: Tag[]): Node {
  const tone = {
    plain: { color: C.muted, border: C.line, background: "transparent" },
    pad: { color: C.pad, border: C.pad, background: C.padSoft },
    ok: { color: C.ok, border: C.ok, background: "transparent" },
    warn: { color: C.warn, border: C.warn, background: "transparent" },
    accent: { color: C.accent, border: C.accent, background: "transparent" },
    ink: { color: C.ink, border: C.ink, background: "transparent" },
  };
  return el(
    "div",
    { flexWrap: "wrap", gap: 10, maxWidth: INNER_W, maxHeight: 50, overflow: "hidden" },
    ...items.map((t) => {
      const s = tone[t.tone ?? "plain"];
      return el(
        "div",
        {
          fontFamily: "IBM Plex Mono",
          fontSize: 23,
          color: s.color,
          border: `2px solid ${s.border}`,
          background: s.background,
          borderRadius: 4,
          padding: "6px 12px",
        },
        t.text,
      );
    }),
  );
}

// Safe area: 72 px either side, below a 14 px red rule. Sizes are explicit
// because satori adds padding and borders to a box's size.
const RULE = 14;
const SIDE = 72;
const TOP = 44;
const BOTTOM = 48;
const INNER_W = OG_WIDTH - SIDE * 2;
const INNER_H = OG_HEIGHT - RULE - TOP - BOTTOM;

function card(kind: string, body: Node[], footer?: Node): Node {
  return el(
    "div",
    { width: OG_WIDTH, height: OG_HEIGHT, background: C.paper, flexDirection: "column" },
    el("div", { width: OG_WIDTH, height: RULE, background: C.accent }),
    el(
      "div",
      {
        width: INNER_W,
        height: INNER_H,
        marginTop: TOP,
        marginLeft: SIDE,
        flexDirection: "column",
        justifyContent: "space-between",
        overflow: "hidden",
      },
      header(kind),
      el("div", { flexDirection: "column", gap: 16, width: INNER_W }, ...body),
      footer ?? el("div", {}),
    ),
  );
}

async function png(node: Node): Promise<Response> {
  const svg = await satori(node as unknown as Parameters<typeof satori>[0], { width: OG_WIDTH, height: OG_HEIGHT, fonts: loadFonts() });
  const data = new Resvg(svg, { fitTo: { mode: "width", value: OG_WIDTH } }).render().asPng();
  return new Response(new Uint8Array(data), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
  });
}

/** Project: name, summary and the pins it uses as pad chips. */
export function projectCard(o: { name: string; sum: string; meta: Tag[]; pins: string[] }): Promise<Response> {
  const pins = o.pins.slice(0, 10).map((p): Tag => ({ text: /^\d+$/.test(p) ? `GPIO ${p}` : p, tone: "pad" }));
  return png(card("Project", [title(o.name), line(o.sum)], el("div", { flexDirection: "column", gap: 12 }, tags(o.meta), pins.length ? tags(pins) : el("div", {}))));
}

export type PadTone = "safe" | "care" | "avoid" | "power";

/** Board: name, chip line, and a strip of its header pads coloured by verdict. */
export function boardCard(o: { name: string; sum: string; meta: Tag[]; pads: PadTone[][] }): Promise<Response> {
  const colour: Record<PadTone, string> = { safe: C.ok, care: C.warn, avoid: C.accent, power: C.line };
  const strip =
    o.pads.length === 0
      ? el("div", {})
      : el(
          "div",
          { flexDirection: "column", gap: 8 },
          ...o.pads.map((row) =>
            el(
              "div",
              { gap: 6 },
              ...row.map((t) => el("div", { width: 22, height: 22, borderRadius: 11, background: colour[t], border: `2px solid ${C.ink}` })),
            ),
          ),
        );
  return png(card("Board", [title(o.name), line(o.sum)], el("div", { flexDirection: "column", gap: 16 }, strip, tags(o.meta))));
}

/** Error: the error text in a terminal block, with the plain-language title above. */
export function errorCard(o: { title: string; match: string; group: string }): Promise<Response> {
  const term = el(
    "div",
    {
      background: C.termBg,
      color: C.termInk,
      fontFamily: "IBM Plex Mono",
      fontSize: o.match.length > 70 ? 26 : 32,
      lineHeight: 1.4,
      padding: "22px 26px",
      borderRadius: 6,
      width: INNER_W - 52,
      maxHeight: 150,
      overflow: "hidden",
    },
    o.match,
  );
  return png(card("Error", [title(o.title, 70, 3), term], tags([{ text: o.group, tone: "ink" }, { text: "What it means and how to fix it", tone: "plain" }])));
}

/** Tool: name and one line. */
export function toolCard(o: { name: string; sum: string; meta: Tag[] }): Promise<Response> {
  return png(card("Tool", [title(o.name), line(o.sum)], tags(o.meta)));
}

/** Grid shape for n kit tiles: few large tiles, or up to six across. */
export function kitGrid(n: number): { cols: number; rows: number } {
  const cols = n <= 4 ? Math.max(n, 1) : n <= 6 ? 3 : n <= 8 ? 4 : n <= 10 ? 5 : 6;
  return { cols, rows: Math.ceil(n / cols) };
}

/** "What you'll need": every part as an icon tile with its quantity and a short name. */
export function kitCard(o: { name: string; items: KitItem[] }): Promise<Response> {
  const { required, optional } = kitSummary(o.items);
  const n = o.items.length;
  const { cols, rows } = kitGrid(n);
  const GAP = 14;
  const TITLE_H = 46;
  const COUNT_H = 28;
  const ROW_GAP = 12;
  const GRID_H = INNER_H - 76 - TITLE_H - COUNT_H - 3 * ROW_GAP; // below the header, title and count line
  // Fill the width, except a short single row, where tiles would get too wide.
  const fullW = Math.floor((INNER_W - GAP * (cols - 1)) / cols);
  const tileW = rows === 1 && n < 4 ? Math.min(300, fullW) : fullW;
  const tileH = Math.min(rows === 1 ? 300 : 999, Math.floor((GRID_H - GAP * (rows - 1)) / rows));
  const big = rows === 1;
  const iconSize = big ? 116 : rows === 2 ? 52 : 44;
  const labelSize = big ? 27 : cols >= 5 ? 19 : 21;
  const PAD = 10;
  const BORDER = 2;

  const badge = (text: string, color: string) =>
    el("div", { fontFamily: "IBM Plex Mono", fontSize: big ? 20 : 16, color, border: `2px solid ${color}`, borderRadius: 4, padding: "1px 6px", textTransform: "uppercase", letterSpacing: 1 }, text);

  const tile = (item: KitItem): Node =>
    el(
      "div",
      {
        width: tileW - 2 * (PAD + BORDER),
        height: tileH - 2 * (PAD + BORDER),
        padding: PAD,
        border: `${BORDER}px solid ${item.optional ? C.line : C.ink}`,
        borderRadius: 8,
        background: item.optional ? C.paper : C.panel,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: big ? "space-between" : "flex-start",
        gap: big ? 12 : 5,
        overflow: "hidden",
      },
      el(
        "div",
        { width: tileW - 2 * (PAD + BORDER), justifyContent: "space-between", alignItems: "center", height: big ? 30 : 24 },
        el("div", { fontFamily: "IBM Plex Mono", fontSize: big ? 26 : 21, color: C.accent }, item.alternative ? "" : `${item.qty}×`),
        item.alternative ? badge("or", C.muted) : item.optional ? badge("optional", C.warn) : el("div", {}),
      ),
      { type: "img", props: { src: `data:image/svg+xml;base64,${Buffer.from(kitIconSvg(item)).toString("base64")}`, width: iconSize, height: iconSize, style: { display: "flex" } } },
      el(
        "div",
        {
          fontFamily: "IBM Plex Sans",
          fontWeight: 600,
          fontSize: labelSize,
          lineHeight: 1.15,
          color: item.optional ? C.muted : C.ink,
          textAlign: "center",
          justifyContent: "center",
          width: tileW - 2 * (PAD + BORDER),
          maxHeight: labelSize * 1.15 * 2 + 2,
          overflow: "hidden",
          lineClamp: 2,
        },
        item.label,
      ),
    );

  const count = `What you'll need · ${required} ${required === 1 ? "part" : "parts"}${optional ? ` + ${optional} optional` : ""}`;
  const node = el(
    "div",
    { width: OG_WIDTH, height: OG_HEIGHT, background: C.paper, flexDirection: "column" },
    el("div", { width: OG_WIDTH, height: RULE, background: C.accent }),
    el(
      "div",
      { width: INNER_W, height: INNER_H, marginTop: TOP, marginLeft: SIDE, flexDirection: "column", gap: ROW_GAP, overflow: "hidden" },
      header("Kit"),
      el(
        "div",
        { fontFamily: "Saira Condensed", fontSize: Math.min(48, titleSize(o.name, 48)), lineHeight: 1, color: C.ink, textTransform: "uppercase", height: TITLE_H, maxWidth: INNER_W, overflow: "hidden", alignItems: "flex-end" },
        o.name,
      ),
      el("div", { fontFamily: "IBM Plex Mono", fontSize: 24, color: C.muted, height: COUNT_H, alignItems: "center" }, count),
      el("div", { flexWrap: "wrap", gap: GAP, width: INNER_W, height: GRID_H, alignContent: "flex-start" }, ...o.items.map(tile)),
    ),
  );
  return png(node);
}
