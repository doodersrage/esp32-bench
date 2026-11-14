// Partition table builder: edit rows, keep offsets aligned, check, export.
import {
  FIRST_OFFSET,
  MB,
  PRESETS,
  SUBTYPES,
  autoOffsets,
  check,
  humanSize as englishSize,
  maxApp,
  parseCsv,
  parseSize,
  toCsv,
  toHex,
  type Partition,
  type PartType,
} from "../lib/partitions";
import { pageLocale, translator } from "../i18n/t";
import { HTML_LANG } from "../i18n/locales";
import { PARTITION_PATTERNS, TOOLS_UI, byPattern } from "../i18n/strings/tools";

const locale = pageLocale();
const t = translator(TOOLS_UI, locale);
/** humanSize with "bytes" in the page's language (KB and MB stay as they are). */
const humanSize = (n: number) => englishSize(n).replace(/^(\d+) bytes$/, (_, b: string) => t("bytes", { n: b }));
/** A problem from check() or parseCsv(), in the page's language. */
const problemText = (text: string) =>
  byPattern(text, PARTITION_PATTERNS, t).replace(/^Row (\d+)/, (_, n: string) => t("ptRow", { n }));

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const presetSel = $<HTMLSelectElement>("#pt-preset");
const flashSel = $<HTMLSelectElement>("#pt-flash");
const autoBox = $<HTMLInputElement>("#pt-auto");
const tbody = $<HTMLTableSectionElement>("#pt-rows");
const bar = $<HTMLDivElement>("#pt-bar");
const summary = $<HTMLParagraphElement>("#pt-summary");
const problemsList = $<HTMLUListElement>("#pt-problems");
const csvOut = $<HTMLPreElement>("#pt-csv");

let rows: Partition[] = [];
const flashBytes = () => Number(flashSel.value) * MB;

function loadPreset(id: string) {
  const preset = PRESETS.find((p) => p.id === id) ?? PRESETS[0];
  rows = preset.rows.map((r) => ({ ...r }));
  presetSel.value = preset.id;
  flashSel.value = String(preset.flashMB);
  autoBox.checked = true;
  render();
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}): HTMLElementTagNameMap[K] {
  return Object.assign(document.createElement(tag), props);
}

function rowEditor(r: Partition, i: number, bad: boolean): HTMLTableRowElement {
  const tr = el("tr");
  if (bad) tr.className = "bad";
  const name = el("input", { value: r.name, maxLength: 16, ariaLabel: t("ptNameOf", { n: i + 1 }) });
  name.addEventListener("change", () => {
    rows[i].name = name.value.trim();
    render();
  });

  const type = el("select", { ariaLabel: t("ptTypeOf", { name: r.name }) });
  for (const t of ["app", "data"] as PartType[]) type.append(el("option", { value: t, textContent: t, selected: t === r.type }));
  type.addEventListener("change", () => {
    rows[i].type = type.value as PartType;
    rows[i].subtype = SUBTYPES[rows[i].type][0];
    render();
  });

  const sub = el("select", { ariaLabel: t("ptSubtypeOf", { name: r.name }) });
  const options = SUBTYPES[r.type].includes(r.subtype) ? SUBTYPES[r.type] : [r.subtype, ...SUBTYPES[r.type]];
  for (const s of options) sub.append(el("option", { value: s, textContent: s, selected: s === r.subtype }));
  sub.addEventListener("change", () => {
    rows[i].subtype = sub.value;
    render();
  });

  const offset = el("input", {
    value: Number.isFinite(r.offset) ? toHex(r.offset) : "",
    disabled: autoBox.checked,
    ariaLabel: t("ptOffsetOf", { name: r.name }),
    inputMode: "text",
  });
  offset.addEventListener("change", () => {
    rows[i].offset = parseSize(offset.value);
    render();
  });

  const size = el("input", { value: Number.isFinite(r.size) ? toHex(r.size) : "", ariaLabel: t("ptSizeOf", { name: r.name }), title: Number.isFinite(r.size) ? humanSize(r.size) : "" });
  size.addEventListener("change", () => {
    rows[i].size = parseSize(size.value);
    render();
  });

  const acts = el("td", { className: "acts" });
  const btn = (label: string, aria: string, fn: () => void, disabled = false) => {
    const b = el("button", { type: "button", className: "btn sm", textContent: label, ariaLabel: aria, disabled });
    b.addEventListener("click", fn);
    acts.append(b, " ");
  };
  btn("↑", t("ptMoveUp", { name: r.name }), () => swap(i, i - 1), i === 0);
  btn("↓", t("ptMoveDown", { name: r.name }), () => swap(i, i + 1), i === rows.length - 1);
  btn("✕", t("remove", { name: r.name }), () => {
    rows.splice(i, 1);
    render();
  });

  for (const c of [name, type, sub, offset, size]) {
    const td = el("td");
    td.append(c);
    tr.append(td);
  }
  tr.append(acts);
  return tr;
}

function swap(a: number, b: number) {
  if (b < 0 || b >= rows.length) return;
  [rows[a], rows[b]] = [rows[b], rows[a]];
  render();
}

function drawBar(problemRows: Set<number>) {
  bar.replaceChildren();
  const total = flashBytes();
  const segs: { from: number; to: number; cls: string; label: string; title: string }[] = [
    { from: 0, to: FIRST_OFFSET, cls: "boot", label: "boot", title: t("ptBootTitle") },
  ];
  const sorted = rows
    .map((r, i) => ({ ...r, i }))
    .filter((r) => Number.isFinite(r.offset) && Number.isFinite(r.size) && r.size > 0)
    .sort((a, b) => a.offset - b.offset);
  let at = FIRST_OFFSET;
  for (const r of sorted) {
    if (r.offset > at) segs.push({ from: at, to: r.offset, cls: "free", label: "", title: t("ptFreeTitle", { size: humanSize(r.offset - at) }) });
    segs.push({
      from: r.offset,
      to: Math.min(r.offset + r.size, total),
      cls: `${r.type}${problemRows.has(r.i) ? " bad" : ""}`,
      label: r.name,
      title: t("ptSegTitle", { name: r.name, type: r.type, subtype: r.subtype, size: humanSize(r.size), offset: toHex(r.offset) }),
    });
    at = Math.max(at, r.offset + r.size);
  }
  if (at < total) segs.push({ from: at, to: total, cls: "free", label: t("ptFreeLabel"), title: t("ptFreeTitle", { size: humanSize(total - at) }) });
  for (const s of segs) {
    if (s.to <= s.from) continue;
    const d = el("div", { className: `seg ${s.cls}`, title: s.title, textContent: (s.to - s.from) / total > 0.06 ? s.label : "" });
    d.style.flexGrow = String(s.to - s.from);
    d.style.flexBasis = "0";
    bar.append(d);
  }
}

function render() {
  if (autoBox.checked) rows = autoOffsets(rows);
  const problems = check(rows, flashBytes());
  const badRows = new Set(problems.filter((p) => p.level === "error" && p.row !== undefined).map((p) => p.row!));
  tbody.replaceChildren(...rows.map((r, i) => rowEditor(r, i, badRows.has(i))));
  drawBar(badRows);

  const used = rows.reduce((end, r) => (Number.isFinite(r.offset + r.size) ? Math.max(end, r.offset + r.size) : end), FIRST_OFFSET);
  const free = flashBytes() - used;
  const app = maxApp(rows);
  summary.textContent =
    t("ptFits", { size: humanSize(app), bytes: app.toLocaleString(HTML_LANG[locale]) }) +
    " " +
    (free >= 0 ? t("ptUnused", { size: humanSize(free) }) : t("ptOver", { size: humanSize(-free) }));

  problemsList.replaceChildren();
  if (problems.length === 0) {
    const li = el("li", { className: "finding" });
    li.append(el("span", { className: "tag ok", textContent: t("tagOk") }), el("span", { textContent: t("ptNoProblems") }));
    problemsList.append(li);
  }
  for (const p of problems) {
    const li = el("li", { className: "finding" });
    li.append(el("span", { className: p.level === "error" ? "tag bad" : "tag warnt", textContent: p.level === "error" ? t("tagError") : t("tagCheck") }), el("span", { textContent: problemText(p.text) }));
    problemsList.append(li);
  }
  csvOut.textContent = toCsv(rows);
}

presetSel.addEventListener("change", () => loadPreset(presetSel.value));
flashSel.addEventListener("change", render);
autoBox.addEventListener("change", render);

$<HTMLButtonElement>("#pt-add").addEventListener("click", () => {
  let n = 1;
  while (rows.some((r) => r.name === `part${n}`)) n++;
  const last = rows.reduce((end, r) => (Number.isFinite(r.offset + r.size) ? Math.max(end, r.offset + r.size) : end), FIRST_OFFSET);
  rows.push({ name: `part${n}`, type: "data", subtype: "spiffs", offset: last, size: 0x10000, flags: "" });
  render();
});

$<HTMLButtonElement>("#pt-fill").addEventListener("click", () => {
  const last = rows[rows.length - 1];
  if (!last || !Number.isFinite(last.offset)) return;
  const room = flashBytes() - last.offset;
  const size = Math.floor(room / 0x1000) * 0x1000;
  if (size > 0) last.size = size;
  render();
});

$<HTMLButtonElement>("#pt-copy").addEventListener("click", async (e) => {
  const b = e.currentTarget as HTMLButtonElement;
  try {
    await navigator.clipboard.writeText(csvOut.textContent ?? "");
    b.textContent = t("copied");
  } catch {
    b.textContent = t("selectCopy");
  }
  setTimeout(() => (b.textContent = t("copy")), 1500);
});

$<HTMLButtonElement>("#pt-download").addEventListener("click", () => {
  const url = URL.createObjectURL(new Blob([csvOut.textContent ?? ""], { type: "text/csv" }));
  const a = el("a", { href: url, download: "partitions.csv" });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

$<HTMLButtonElement>("#pt-import-go").addEventListener("click", () => {
  const status = $<HTMLSpanElement>("#pt-import-status");
  try {
    const parsed = parseCsv($<HTMLTextAreaElement>("#pt-import").value);
    if (parsed.rows.length === 0) throw new Error(t("ptNoneFound"));
    rows = parsed.rows;
    autoBox.checked = parsed.blankOffsets;
    const end = rows.reduce((m, r) => Math.max(m, (r.offset || 0) + (r.size || 0)), 0);
    const fit = [2, 4, 8, 16, 32].find((n) => n * MB >= end) ?? 32;
    flashSel.value = String(fit);
    status.textContent = rows.length === 1 ? t("ptLoadedOne") : t("ptLoadedMany", { n: rows.length });
    render();
  } catch (err) {
    status.textContent = problemText((err as Error).message);
  }
});

loadPreset(new URLSearchParams(location.search).get("preset") ?? "default");
