// Site search: the index format and a small scorer. Pure functions, shared by
// the build-time index endpoint, the header box, the /search/ page and the tests.

export const KINDS = ["Project", "Board", "Pin", "Error", "Tool", "Guide", "Flame", "Page"] as const;
export type Kind = (typeof KINDS)[number];

/** One searchable thing, as written by the index endpoint */
export interface Entry {
  title: string;
  url: string;
  kind: Kind;
  /** One line shown under the title */
  snippet: string;
  /** Extra words that should find this entry */
  text: string;
}

/** The JSON file: entries as compact tuples [title, url, kind index, snippet, text] */
export interface IndexFile {
  v: 1;
  kinds: readonly string[];
  e: [string, string, number, string, string][];
}

export function packIndex(entries: Entry[]): IndexFile {
  return { v: 1, kinds: KINDS, e: entries.map((x) => [x.title, x.url, KINDS.indexOf(x.kind), x.snippet, x.text]) };
}

export function unpackIndex(file: IndexFile): Entry[] {
  return file.e.map(([title, url, k, snippet, text]) => ({ title, url, kind: (file.kinds[k] ?? "Page") as Kind, snippet, text }));
}

/**
 * Lower case, accents and punctuation removed, and letters split from digits,
 * so "GPIO34", "gpio 34" and "GPIO-34" all become "gpio 34".
 */
export function normalize(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-z])/g, "$1 $2")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const compact = (normalized: string) => normalized.replace(/ /g, "");

export interface Prepared {
  entry: Entry;
  /** Normalized title and body, padded with spaces for whole-word tests */
  title: string;
  body: string;
  titleCompact: string;
}

export function prepare(entries: Entry[]): Prepared[] {
  return entries.map((entry) => {
    const title = normalize(entry.title);
    return {
      entry,
      title: ` ${title} `,
      body: ` ${normalize(`${entry.snippet} ${entry.text}`)} `,
      titleCompact: compact(title),
    };
  });
}

/** Small nudges so a board outranks its own pins, and so on, when scores tie */
const KIND_WEIGHT: Record<Kind, number> = { Board: 6, Guide: 5.5, Project: 5, Error: 5, Tool: 4, Page: 3, Flame: 2, Pin: 1 };

/**
 * A query is a list of phrases, one per typed word: "i2c" must appear as "i 2 c"
 * and "c6" as "c 6", in that order, so "c6" does not match "GPIO 6 on C3".
 */
export interface Query {
  /** The whole query, normalized */
  q: string;
  phrases: string[];
}

export function parseQuery(query: string): Query {
  const phrases = query
    .split(/[\s,;:/|]+/)
    .map(normalize)
    .filter(Boolean);
  return { q: normalize(query), phrases };
}

const startsWord = (padded: string, phrase: string) => padded.includes(` ${phrase}`);
const isWords = (padded: string, phrase: string) => padded.includes(` ${phrase} `);

export function score(p: Prepared, query: Query): number {
  const { q, phrases } = query;
  if (phrases.length === 0) return 0;
  const title = p.title.trim();
  const qc = compact(q);
  let s = 0;

  if (title === q || p.titleCompact === qc) s = 1000;
  else if (title.startsWith(q) || p.titleCompact.startsWith(qc)) s = 800;
  else {
    let exact = 0;
    let inTitle = 0;
    let inBody = 0;
    for (const ph of phrases) {
      if (isWords(p.title, ph)) {
        exact++;
        inTitle++;
      } else if (startsWord(p.title, ph)) inTitle++;
      else if (startsWord(p.body, ph)) inBody++;
    }
    const all = phrases.length;
    if (inTitle === all) s = 500 + 20 * exact + (all > 1 && p.title.includes(` ${q}`) ? 50 : 0);
    // "Load Prohibited" for LoadProhibited: only for queries of several words
    else if (all > 1 && qc.length >= 6 && p.titleCompact.includes(qc)) s = 450;
    else if (inTitle + inBody === all) s = 200 + 15 * inTitle + 5 * exact;
    else if (all > 1 && qc.length >= 6 && compact(p.body).includes(qc)) s = 150;
  }
  if (s === 0) return 0;
  return s + KIND_WEIGHT[p.entry.kind] - p.entry.title.length * 0.01;
}

export function search(index: Prepared[], query: string, limit = 50): Entry[] {
  const parsed = parseQuery(query);
  if (parsed.phrases.length === 0) return [];
  const hits: [number, Entry][] = [];
  for (const p of index) {
    const s = score(p, parsed);
    if (s > 0) hits.push([s, p.entry]);
  }
  hits.sort((a, b) => b[0] - a[0]);
  return hits.slice(0, limit).map(([, e]) => e);
}
