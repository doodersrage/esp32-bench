// Line-art icons for the kit cards and the parts table: one 64x64 SVG per part
// type, in the site's colours. Colours are set with style attributes, so the same
// markup works in resvg (fixed palette) and inline in HTML (theme-aware palette).
import type { IconId, KitItem } from "./kit";

export interface Palette {
  /** Outlines and dark bodies */
  ink: string;
  /** Light fills (paper, white plastic) */
  paper: string;
  accent: string;
  gold: string;
  ok: string;
  muted: string;
  /** Module PCB colours */
  pcb: string;
  blue: string;
  metal: string;
}

/** For the PNG kit cards. */
export const CARD_PALETTE: Palette = {
  ink: "#14231f",
  paper: "#ffffff",
  accent: "#c0341a",
  gold: "#e2b755",
  ok: "#1d7a4c",
  muted: "#5a6b65",
  pcb: "#2e7d5b",
  blue: "#2f6fb3",
  metal: "#b9c0c1",
};

/** For inline icons in the page: outlines follow the text colour, so dark mode works. */
export const PAGE_PALETTE: Palette = {
  ...CARD_PALETTE,
  ink: "currentColor",
  paper: "var(--panel, #ffffff)",
};

const BAND_HEX: Record<string, string> = {
  black: "#1b1b1b",
  brown: "#7a4a24",
  red: "#c93a2a",
  orange: "#e47b1f",
  yellow: "#e8c51d",
  green: "#2f9a4b",
  blue: "#2f6fb3",
  violet: "#7b4bb0",
  grey: "#8a8f90",
  white: "#f4f4f4",
  gold: "#c9a227",
  silver: "#c0c4c6",
};
const LED_HEX: Record<string, string> = {
  red: "#e0402c",
  green: "#3fae4f",
  yellow: "#f0c419",
  blue: "#3b7fd1",
  white: "#eef3f4",
  orange: "#f08a24",
};

const W = 3; // stroke width
const st = (fill: string, stroke: string, width = W) => `style="fill:${fill};stroke:${stroke};stroke-width:${width};stroke-linejoin:round;stroke-linecap:round"`;
const rect = (x: number, y: number, w: number, h: number, fill: string, stroke: string, rx = 2, width = W) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" ${st(fill, stroke, width)}/>`;
const circle = (cx: number, cy: number, r: number, fill: string, stroke: string, width = W) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" ${st(fill, stroke, width)}/>`;
const path = (d: string, fill: string, stroke: string, width = W) => `<path d="${d}" ${st(fill, stroke, width)}/>`;
const line = (x1: number, y1: number, x2: number, y2: number, stroke: string, width = W) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${st("none", stroke, width)}/>`;
const legs = (xs: number[], y1: number, y2: number, p: Palette) => xs.map((x) => line(x, y1, x, y2, p.muted, 2.5)).join("");
const pins = (x: number, y: number, n: number, gap: number, p: Palette) =>
  Array.from({ length: n }, (_, i) => rect(x + i * gap, y, 3, 6, p.gold, "none", 0.5, 0)).join("");

function body(icon: IconId, p: Palette, item?: KitItem): string {
  switch (icon) {
    case "esp32":
      return (
        rect(18, 5, 28, 54, p.ink, p.ink, 3) +
        rect(23, 9, 18, 15, p.metal, p.metal, 1, 1) +
        Array.from({ length: 7 }, (_, i) => circle(14, 12 + i * 6.5, 1.8, p.gold, "none", 0) + circle(50, 12 + i * 6.5, 1.8, p.gold, "none", 0)).join("") +
        rect(27, 52, 10, 7, p.metal, p.metal, 1, 1) +
        circle(32, 37, 3, p.accent, "none", 0)
      );
    case "esp32cam":
      return rect(12, 10, 40, 46, p.ink, p.ink, 3) + circle(32, 30, 11, p.muted, p.metal, 3) + circle(32, 30, 5, p.ink, p.blue, 2) + rect(17, 46, 30, 6, p.paper, "none", 1, 0);
    case "uno":
      return (
        rect(6, 12, 52, 40, p.blue, p.ink, 3) +
        rect(4, 18, 12, 10, p.metal, p.ink, 1, 2) +
        rect(4, 36, 10, 10, p.ink, p.ink, 1, 2) +
        pins(22, 14, 9, 3.8, p) +
        pins(26, 44, 7, 3.8, p) +
        rect(28, 26, 18, 10, p.ink, p.ink, 1, 1)
      );
    case "breadboard":
      return (
        rect(6, 12, 52, 40, p.paper, p.ink, 3) +
        line(10, 17, 54, 17, p.accent, 2) +
        line(10, 47, 54, 47, p.blue, 2) +
        line(8, 32, 56, 32, p.muted, 1.5) +
        Array.from({ length: 6 }, (_, i) => [0, 1, 2].map((r) => circle(13 + i * 7.6, 23 + r * 4, 0.9, p.ink, "none", 0)).join("") + [0, 1, 2].map((r) => circle(13 + i * 7.6, 36 + r * 4, 0.9, p.ink, "none", 0)).join("")).join("")
      );
    case "wires":
      return (
        path("M8 50 C 20 8, 34 60, 56 18", "none", p.accent, 3.5) +
        path("M8 40 C 24 2, 40 54, 56 28", "none", p.gold, 3.5) +
        path("M8 30 C 22 66, 42 6, 56 40", "none", p.ok, 3.5) +
        [50, 40, 30].map((y) => rect(4, y - 3, 6, 6, p.ink, p.ink, 1, 1)).join("") +
        [18, 28, 40].map((y) => rect(54, y - 3, 6, 6, p.ink, p.ink, 1, 1)).join("")
      );
    case "usb":
      return path("M14 52 C 14 30, 40 44, 40 24", "none", p.ink, 4) + rect(32, 6, 16, 18, p.ink, p.ink, 2) + rect(36, 2, 8, 6, p.metal, p.ink, 1, 2);
    case "usbserial":
      return rect(14, 16, 34, 40, p.accent, p.ink, 3) + rect(22, 6, 18, 12, p.metal, p.ink, 1, 2) + rect(22, 28, 14, 12, p.ink, p.ink, 1, 1) + pins(18, 48, 6, 4.6, p);
    case "battery":
      return rect(10, 18, 40, 28, p.ok, p.ink, 4) + rect(50, 26, 5, 12, p.ink, p.ink, 1, 1) + line(20, 32, 30, 32, p.paper, 3) + line(25, 27, 25, 37, p.paper, 3);
    case "power":
      return rect(14, 18, 30, 34, p.ink, p.ink, 4) + line(22, 6, 22, 18, p.metal, 4) + line(36, 6, 36, 18, p.metal, 4) + path("M31 24 L24 36 H31 L28 46 L36 32 H29 Z", p.gold, p.gold, 1.5) + path("M44 40 C 54 40, 54 54, 60 54", "none", p.ink, 3);
    case "service":
      return path("M18 46 H48 A10 10 0 0 0 46 26 A14 14 0 0 0 20 24 A11 11 0 0 0 18 46 Z", p.paper, p.ink) + line(26, 38, 40, 38, p.blue, 3) + line(26, 32, 36, 32, p.blue, 3);
    case "hardware":
      return path("M10 46 H54 V54 H10 Z", p.gold, p.ink) + path("M18 46 V20 H30 V46", p.metal, p.ink) + circle(24, 28, 2.5, p.paper, p.ink, 2) + circle(42, 40, 3, p.metal, p.ink, 2);
    case "resistor": {
      const bands = item?.bands ?? ["brown", "black", "orange", "gold"];
      return (
        line(2, 32, 62, 32, p.muted, 2.5) +
        path("M16 22 Q16 18 21 18 H43 Q48 18 48 22 V42 Q48 46 43 46 H21 Q16 46 16 42 Z", "#dcc290", p.ink, 2.5) +
        bands.map((b, i) => rect(21 + i * 6 + (i === 3 ? 4 : 0), 19, 4, 26, BAND_HEX[b] ?? b, "none", 0, 0)).join("")
      );
    }
    case "led": {
      const colours = (item?.colours?.length ? item.colours : ["red"]).slice(0, 4);
      if (colours.length === 1) {
        const c = LED_HEX[colours[0]] ?? p.accent;
        return path("M20 36 V20 A12 12 0 0 1 44 20 V36 Z", c, p.ink) + rect(17, 36, 30, 5, c, p.ink, 1, 2.5) + legs([26, 38], 41, 60, p);
      }
      const w = 52 / colours.length;
      return colours
        .map((col, i) => {
          const x = 6 + i * w + w / 2;
          const r = Math.min(7, w / 2 - 1);
          return path(`M${x - r} 34 V20 A${r} ${r} 0 0 1 ${x + r} 20 V34 Z`, LED_HEX[col] ?? col, p.ink, 2) + legs([x - r / 2, x + r / 2], 34, 56, p);
        })
        .join("");
    }
    case "rgbled":
      return (
        path("M18 36 V20 A14 14 0 0 1 46 20 V36 Z", p.paper, p.ink) +
        circle(27, 22, 3.5, LED_HEX.red, "none", 0) +
        circle(37, 22, 3.5, LED_HEX.green, "none", 0) +
        circle(32, 30, 3.5, LED_HEX.blue, "none", 0) +
        rect(15, 36, 34, 5, p.paper, p.ink, 1, 2.5) +
        legs([22, 29, 35, 42], 41, 60, p)
      );
    case "button":
      return rect(14, 22, 36, 30, p.ink, p.ink, 3) + circle(32, 30, 10, p.accent, p.ink, 2.5) + legs([18, 46], 52, 60, p) + legs([18, 46], 14, 22, p);
    case "pot":
      return rect(12, 18, 40, 30, p.blue, p.ink, 3) + circle(32, 33, 11, p.paper, p.ink, 2.5) + line(32, 33, 38, 25, p.ink, 3) + legs([20, 32, 44], 48, 60, p);
    case "encoder":
      return rect(14, 30, 36, 22, p.ink, p.ink, 3) + rect(26, 8, 12, 22, p.metal, p.ink, 2, 2.5) + line(32, 10, 32, 28, p.ink, 1.5) + legs([20, 26, 32, 38, 44], 52, 60, p);
    case "buzzer":
      return circle(32, 28, 20, p.ink, p.ink) + circle(32, 28, 4, p.muted, p.muted, 0) + legs([24, 40], 48, 60, p) + line(12, 10, 12, 18, p.accent, 2.5) + line(8, 14, 16, 14, p.accent, 2.5);
    case "speaker":
      return path("M10 24 H22 L38 10 V54 L22 40 H10 Z", p.ink, p.ink) + path("M46 22 Q54 32 46 42", "none", p.ink, 3) + path("M52 16 Q64 32 52 48", "none", p.ink, 3);
    case "oled":
      return rect(8, 10, 48, 44, p.blue, p.ink, 3) + rect(12, 20, 40, 26, p.ink, p.ink, 1, 1) + line(16, 28, 34, 28, "#8fd3ff", 2.5) + line(16, 35, 44, 35, "#8fd3ff", 2.5) + pins(20, 12, 4, 7, p);
    case "lcd":
      return (
        rect(4, 14, 56, 36, p.ok, p.ink, 3) +
        rect(9, 21, 46, 22, "#a8c63c", p.ink, 1, 2) +
        Array.from({ length: 8 }, (_, i) => rect(12 + i * 5.2, 25, 3.6, 5, p.ink, "none", 0.5, 0) + rect(12 + i * 5.2, 33, 3.6, 5, p.ink, "none", 0.5, 0)).join("")
      );
    case "sevenseg":
      return (
        rect(14, 6, 36, 52, p.ink, p.ink, 3) +
        [
          "M23 14 H39",
          "M41 16 V29",
          "M41 35 V48",
          "M23 50 H39",
          "M21 35 V48",
          "M21 16 V29",
          "M23 32 H39",
        ]
          .map((d) => path(d, "none", p.accent, 4))
          .join("") +
        circle(45, 50, 2, p.accent, "none", 0)
      );
    case "neopixel":
      return rect(4, 22, 56, 20, p.ink, p.ink, 2) + ["#e0402c", "#3fae4f", "#3b7fd1", "#f0c419"].map((c, i) => rect(8 + i * 13.5, 26, 10, 12, c, p.paper, 1, 1.5)).join("");
    case "epaper":
      return rect(6, 12, 52, 40, p.paper, p.ink, 3) + rect(11, 17, 42, 26, "#eceee9", p.muted, 1, 1.5) + line(15, 24, 40, 24, p.ink, 3) + line(15, 31, 48, 31, p.ink, 2) + line(15, 37, 32, 37, p.accent, 2) + pins(22, 46, 6, 4, p);
    case "servo":
      return rect(10, 22, 44, 28, p.blue, p.ink, 3) + rect(4, 30, 56, 6, p.blue, p.ink, 1, 2.5) + circle(24, 22, 7, p.paper, p.ink, 2.5) + path("M14 14 H34 Q38 14 38 18 Q38 22 34 22 H14 Z", p.paper, p.ink, 2.5) + path("M54 44 C 58 52, 62 52, 62 60", "none", p.gold, 2.5);
    case "motor":
      return rect(10, 16, 34, 32, p.metal, p.ink, 6) + line(44, 32, 58, 32, p.ink, 3.5) + rect(4, 22, 6, 6, p.gold, p.ink, 1, 1.5) + rect(4, 36, 6, 6, p.gold, p.ink, 1, 1.5) + circle(27, 32, 6, p.ink, p.ink, 0);
    case "relay":
      return rect(6, 18, 52, 34, p.pcb, p.ink, 3) + rect(12, 22, 24, 22, p.blue, p.ink, 2, 2) + [42, 48, 54].map((x) => rect(x - 3, 24, 6, 10, p.ok, p.ink, 1, 1.5)).join("") + circle(50, 44, 2.5, p.accent, "none", 0);
    case "transistor":
      return path("M18 12 H46 V38 A14 10 0 0 1 18 38 Z", p.ink, p.ink) + legs([24, 32, 40], 46, 60, p) + line(24, 24, 40, 24, p.muted, 2);
    case "diode":
      return line(2, 32, 62, 32, p.muted, 2.5) + rect(18, 24, 28, 16, p.ink, p.ink, 3) + rect(38, 24, 5, 16, p.metal, "none", 0, 0);
    case "capacitor":
      if (item?.ceramic) return circle(32, 26, 14, p.gold, p.ink, 2.5) + legs([27, 37], 38, 60, p);
      return rect(20, 8, 24, 36, p.blue, p.ink, 4) + rect(36, 8, 6, 36, p.metal, "none", 0, 0) + line(39, 14, 39, 18, p.ink, 2) + legs([26, 38], 44, 60, p);
    case "ds18b20":
      return rect(6, 26, 26, 12, p.metal, p.ink, 6) + path("M32 32 C 44 32, 44 48, 58 48", "none", p.ink, 4) + line(12, 29, 12, 35, p.ink, 1.5);
    case "dht22":
      return rect(14, 6, 36, 44, p.paper, p.ink, 3) + Array.from({ length: 4 }, (_, r) => [0, 1, 2, 3].map((c) => rect(19 + c * 7, 12 + r * 8, 4, 4, p.ink, "none", 0.5, 0)).join("")).join("") + legs([22, 28, 36, 42], 50, 60, p);
    case "i2c":
      return rect(10, 12, 44, 40, "#5b3a8c", p.ink, 3) + rect(24, 22, 14, 14, p.metal, p.ink, 1, 1.5) + pins(16, 44, 4, 9, p) + circle(16, 18, 2, p.gold, "none", 0) + circle(48, 18, 2, p.gold, "none", 0);
    case "hcsr04":
      return rect(4, 18, 56, 30, p.blue, p.ink, 3) + circle(18, 33, 10, p.metal, p.ink, 2.5) + circle(46, 33, 10, p.metal, p.ink, 2.5) + circle(18, 33, 4, p.ink, "none", 0) + circle(46, 33, 4, p.ink, "none", 0);
    case "sharpir":
      return path("M4 32 L14 20 H50 L60 32 L50 44 H14 Z", p.ink, p.ink) + circle(22, 32, 6, "#3a2a4a", p.metal, 2) + circle(42, 32, 6, "#3a2a4a", p.metal, 2);
    case "pir":
      return rect(10, 36, 44, 20, p.pcb, p.ink, 3) + path("M14 36 A18 18 0 0 1 50 36 Z", p.paper, p.ink) + path("M22 30 Q32 24 42 30", "none", p.metal, 2) + path("M20 34 Q32 28 44 34", "none", p.metal, 2);
    case "mpu6050":
      return rect(8, 10, 48, 44, p.blue, p.ink, 3) + rect(25, 23, 14, 14, p.ink, p.ink, 1, 1) + pins(12, 45, 8, 5.2, p) + path("M44 16 L50 16 L50 22", "none", p.paper, 2) + path("M44 16 L44 22", "none", p.paper, 2);
    case "joystick":
      return rect(8, 18, 48, 40, p.ink, p.ink, 3) + circle(32, 34, 13, p.muted, p.ink, 2.5) + circle(32, 28, 9, p.ink, p.metal, 2.5) + pins(20, 50, 5, 6, p);
    case "soil":
      return path("M18 6 H46 V30 L40 58 H36 L34 32 H30 L28 58 H24 L18 30 Z", p.ink, p.ink) + rect(24, 10, 16, 10, p.metal, "none", 1, 0) + line(32, 34, 32, 50, p.gold, 2);
    case "ldr":
      return circle(32, 24, 16, "#d6a24a", p.ink, 2.5) + path("M22 18 H38 V22 H26 V26 H38 V30 H24", "none", p.accent, 2.5) + legs([26, 38], 40, 60, p);
    case "reed":
      return rect(6, 22, 34, 14, "#dbe8ec", p.ink, 7) + line(2, 29, 20, 29, p.muted, 2.5) + line(26, 29, 44, 29, p.muted, 2.5) + rect(36, 40, 22, 12, p.accent, p.ink, 2, 2) + rect(47, 40, 11, 12, p.metal, "none", 0, 0);
    case "thermocouple":
      return rect(6, 10, 30, 26, p.accent, p.ink, 3) + rect(14, 16, 12, 12, p.ink, p.ink, 1, 1) + path("M36 30 C 50 30, 46 50, 58 52", "none", p.gold, 3) + path("M36 24 C 54 24, 50 46, 58 48", "none", p.accent, 3) + circle(58, 50, 3, p.metal, p.ink, 1.5);
    case "nrf24":
      return rect(6, 18, 52, 30, p.ink, p.ink, 3) + path("M10 24 H18 V30 H24 V24 H30 V30 H36", "none", p.gold, 2) + rect(40, 30, 10, 8, p.metal, "none", 1, 0) + pins(10, 40, 4, 6, p) + pins(10, 34, 4, 6, p);
    case "rfid":
      return rect(6, 8, 52, 44, p.blue, p.ink, 3) + rect(14, 14, 30, 24, "none", p.gold, 4, 2) + rect(19, 19, 20, 14, "none", p.gold, 3, 2) + rect(46, 16, 6, 6, p.ink, "none", 1, 0) + pins(12, 46, 8, 5.2, p);
    case "irrecv":
      return rect(18, 10, 28, 26, p.ink, p.ink, 3) + circle(32, 22, 8, "#3a2a4a", p.metal, 2.5) + legs([24, 32, 40], 36, 60, p);
    case "remote":
      return rect(18, 4, 28, 56, p.ink, p.ink, 6) + circle(32, 13, 4, p.accent, "none", 0) + [24, 32, 40].map((x) => [26, 34, 42, 50].map((y) => rect(x - 3, y - 2, 6, 4, p.metal, "none", 1, 0)).join("")).join("");
    case "stepper":
      return circle(30, 34, 22, p.metal, p.ink, 2.5) + circle(30, 34, 9, p.gold, p.ink, 2) + line(30, 34, 30, 22, p.ink, 3) + rect(6, 24, 6, 20, p.blue, p.ink, 1, 2) + path("M52 34 C 58 34, 58 50, 62 52", "none", p.accent, 2.5);
    case "stepperdrv":
      return rect(6, 10, 52, 44, p.pcb, p.ink, 3) + rect(12, 18, 20, 12, p.ink, p.ink, 1, 1) + [38, 44, 50, 56].map((x) => circle(x - 2, 20, 2.5, p.accent, "none", 0)).join("") + rect(36, 34, 18, 12, p.paper, p.ink, 1, 2) + pins(12, 44, 4, 6, p);
    case "keypad":
      return rect(12, 4, 40, 44, p.ink, p.ink, 3) + Array.from({ length: 4 }, (_, r) => [0, 1, 2, 3].map((c) => rect(16 + c * 9, 8 + r * 10, 6, 6, c === 3 ? p.accent : p.paper, "none", 1, 0)).join("")).join("") + rect(26, 48, 12, 12, p.muted, p.ink, 1, 1.5);
    case "ic":
      return rect(12, 16, 40, 32, p.ink, p.ink, 2) + pins(16, 10, 7, 5, p) + pins(16, 48, 7, 5, p) + circle(18, 32, 3, p.muted, "none", 0);
    case "module":
    default:
      return rect(8, 12, 48, 40, p.pcb, p.ink, 3) + rect(24, 22, 16, 16, p.ink, p.ink, 1, 1) + pins(14, 44, 6, 6.5, p) + circle(14, 18, 2, p.gold, "none", 0) + circle(50, 18, 2, p.gold, "none", 0);
  }
}

/** A complete <svg> for an icon. `title` adds an accessible name (inline use). */
export function kitIconSvg(item: KitItem | IconId, palette: Palette = CARD_PALETTE, size = 64, title?: string): string {
  const it = typeof item === "string" ? undefined : item;
  const id = typeof item === "string" ? item : item.icon;
  const label = title ? `<title>${title.replace(/[<&>]/g, "")}</title>` : "";
  const aria = title ? `role="img" aria-label="${title.replace(/["<&>]/g, "")}"` : `aria-hidden="true"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" ${aria}>${label}${body(id, palette, it)}</svg>`;
}

export const ALL_ICONS: IconId[] = [
  "esp32", "esp32cam", "uno", "breadboard", "wires", "usb", "usbserial", "battery", "power", "service", "hardware",
  "resistor", "led", "rgbled", "button", "pot", "encoder", "buzzer", "speaker", "oled", "lcd", "sevenseg", "neopixel",
  "epaper", "servo", "motor", "relay", "transistor", "diode", "capacitor", "ds18b20", "dht22", "i2c", "hcsr04",
  "sharpir", "pir", "mpu6050", "joystick", "soil", "ldr", "reed", "thermocouple", "nrf24", "rfid", "irrecv", "remote", "stepper", "stepperdrv", "keypad", "ic", "module",
];
