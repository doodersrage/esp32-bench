// Live serial plotter. Numbers that keep appearing in the same kind of line
// become a series; each series gets its own small chart with its own scale.

import { pageLocale, translator } from "../i18n/t";
import { BENCH } from "../i18n/strings/bench";

const t = translator(BENCH, pageLocale());

interface Series {
  key: string;
  label: string;
  values: number[];
  hidden: boolean;
  order: number;
}

const MAX_POINTS = 240;
const MAX_SERIES = 40;
const MAX_SHOWN = 6;
const MIN_POINTS = 3;

// A number that stands on its own: not part of a word, a hex value, a version
// or an IP address.
const NUMBER = /(?<![A-Za-z0-9_.])-?\d+(?:\.\d+)?(?![A-Za-z0-9_]|\.\d)/g;
const CLOCK = /\b\d{1,2}:\d{2}(?::\d{2})?\b/g;

const series = new Map<string, Series>();
// Every reading with its time, for "Download CSV". The charts keep only the
// last MAX_POINTS; this keeps a much longer run.
const MAX_ROWS = 50_000;
const rows: { t: number; values: Map<string, number> }[] = [];
let csvButton: HTMLButtonElement | null = null;
let host: HTMLElement | null = null;
let empty: HTMLElement | null = null;
let created = 0;
let frame = 0;

function labelFor(before: string, after: string, index: number): string {
  const jsonKey = /"(\w+)"\s*:\s*$/.exec(before)?.[1];
  if (jsonKey) return jsonKey;
  const assigned = /(\w+)\s*[=:]\s*$/.exec(before)?.[1];
  if (assigned) return assigned;
  const unit = /^\s?(°?[A-Za-z%]{1,5})\b/.exec(after)?.[1] ?? /^\s?(%[A-Za-z]{0,4})/.exec(after)?.[1];
  const word = /([A-Za-z]{2,12})\s*$/.exec(before)?.[1];
  return [word, unit].filter(Boolean).join(" ") || t("valueN", { n: index + 1 });
}

export function feedPlotter(raw: string) {
  if (!host || raw.length > 200) return;
  const line = raw.replace(CLOCK, " ");
  const matches = [...line.matchAll(NUMBER)];
  if (matches.length === 0 || matches.length > 8) return;
  const shape = line.replace(NUMBER, "#").trim().slice(0, 60);

  const row = { t: Date.now(), values: new Map<string, number>() };
  matches.forEach((m, i) => {
    const value = Number(m[0]);
    if (!Number.isFinite(value)) return;
    const key = `${shape}|${i}`;
    let s = series.get(key);
    if (!s) {
      if (series.size >= MAX_SERIES) {
        // Drop the series with the fewest points; one-off lines pile up otherwise.
        const weakest = [...series.values()].sort((a, b) => a.values.length - b.values.length)[0];
        series.delete(weakest.key);
      }
      const at = m.index ?? 0;
      s = { key, label: labelFor(line.slice(0, at), line.slice(at + m[0].length), i), values: [], hidden: false, order: created++ };
      series.set(key, s);
    }
    s.values.push(value);
    if (s.values.length > MAX_POINTS) s.values.shift();
    row.values.set(key, value);
  });
  if (row.values.size > 0) {
    rows.push(row);
    if (rows.length > MAX_ROWS) rows.shift();
  }

  if (!frame) frame = requestAnimationFrame(render);
}

export function resetPlotter() {
  series.clear();
  rows.length = 0;
  created = 0;
  render();
}

/** Series worth charting: enough points, and a value that changes. */
function signals(): Series[] {
  return [...series.values()]
    .filter((s) => !s.hidden && s.values.length >= MIN_POINTS)
    // A value that never changes is a status code or a count, not a signal.
    .filter((s) => s.values.some((v) => v !== s.values[0]))
    .sort((a, b) => a.order - b.order);
}

function visible(): Series[] {
  return signals().slice(0, MAX_SHOWN);
}

const csvCell = (text: string) => (/[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);

/** The readings of every charted series as CSV, one row per line that carried one, or "" when there are none. */
export function plotterCsv(): string {
  const cols = signals();
  if (cols.length === 0) return "";
  const lines = [["time", ...cols.map((s) => s.label)].map(csvCell).join(",")];
  for (const row of rows) {
    if (!cols.some((s) => row.values.has(s.key))) continue;
    lines.push([new Date(row.t).toISOString(), ...cols.map((s) => (row.values.has(s.key) ? String(row.values.get(s.key)) : ""))].join(","));
  }
  return lines.join("\n") + "\n";
}

const format = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(Math.abs(v) < 10 ? 2 : 1));

function draw(canvas: HTMLCanvasElement, values: number[]) {
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 240;
  const height = canvas.clientHeight || 80;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(ratio, ratio);

  const style = getComputedStyle(document.documentElement);
  const accent = style.getPropertyValue("--accent").trim() || "#d23a1e";
  const grid = style.getPropertyValue("--line").trim() || "#ccc";

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 6;
  const x = (i: number) => pad + (i / Math.max(values.length - 1, 1)) * (width - pad * 2);
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);

  ctx.strokeStyle = grid;
  ctx.lineWidth = 1;
  for (const f of [0, 0.5, 1]) {
    const gy = Math.round(pad + f * (height - pad * 2)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(pad, gy);
    ctx.lineTo(width - pad, gy);
    ctx.stroke();
  }

  ctx.beginPath();
  values.forEach((v, i) => (i === 0 ? ctx.moveTo(x(i), y(v)) : ctx.lineTo(x(i), y(v))));
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.stroke();

  ctx.lineTo(x(values.length - 1), height - pad);
  ctx.lineTo(x(0), height - pad);
  ctx.closePath();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.beginPath();
  ctx.arc(x(values.length - 1), y(values[values.length - 1]), 3.5, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();
}

function render() {
  frame = 0;
  if (!host) return;
  const shown = visible();
  if (empty) empty.hidden = shown.length > 0;
  if (csvButton) csvButton.hidden = shown.length === 0;

  // Reuse cards so the hide buttons stay clickable while data streams in.
  const cards = new Map([...host.querySelectorAll<HTMLElement>("[data-series]")].map((el) => [el.dataset.series ?? "", el]));
  for (const [key, el] of cards) if (!shown.some((s) => s.key === key)) el.remove();

  for (const s of shown) {
    let card = cards.get(s.key);
    if (!card) {
      card = document.createElement("div");
      card.className = "plot";
      card.dataset.series = s.key;
      card.innerHTML =
        '<div class="plothead"><span class="plotlabel"></span><span class="plotnow"></span>' +
        '<button class="btn sm" type="button" data-hide></button></div>' +
        '<canvas></canvas><div class="plotrange"></div>';
      card.querySelector(".plotlabel")!.textContent = s.label;
      card.querySelector<HTMLButtonElement>("[data-hide]")!.setAttribute("aria-label", t("hideAria", { label: s.label }));
      card.querySelector<HTMLButtonElement>("[data-hide]")!.textContent = t("hide");
      host.append(card);
    }
    const last = s.values[s.values.length - 1];
    card.querySelector(".plotnow")!.textContent = format(last);
    card.querySelector(".plotrange")!.textContent = t("plotRange", { min: format(Math.min(...s.values)), max: format(Math.max(...s.values)), n: s.values.length });
    draw(card.querySelector("canvas")!, s.values);
  }
}

export function initPlotter(container: HTMLElement, emptyNote: HTMLElement | null, download?: HTMLButtonElement | null) {
  host = container;
  empty = emptyNote;
  csvButton = download ?? null;
  csvButton?.addEventListener("click", () => {
    const csv = plotterCsv();
    if (!csv) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `esp32-bench-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  host.addEventListener("click", (e) => {
    const button = (e.target as HTMLElement).closest("[data-hide]");
    const key = button?.closest<HTMLElement>("[data-series]")?.dataset.series;
    const s = key ? series.get(key) : undefined;
    if (s) {
      s.hidden = true;
      render();
    }
  });
  window.addEventListener("resize", () => {
    if (!frame) frame = requestAnimationFrame(render);
  });
}
