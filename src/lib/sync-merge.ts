// Sync codes (see api/src/sync.ts): what travels, and how two copies combine.
// Pure, so it can be tested without a browser.

/** localStorage keys after "bench." that a sync code carries. Sort order, filters and theme stay per browser. */
export const SYNC_KEYS = ["built", "flashed", "seen", "shop", "drawer", "board"] as const;
export type SyncKey = (typeof SYNC_KEYS)[number];
/** Raw localStorage values, as stored. */
export type SyncData = Partial<Record<SyncKey, string>>;

/** A stable string for comparing two snapshots. */
export function fingerprint(d: SyncData): string {
  return JSON.stringify(SYNC_KEYS.map((k) => d[k] ?? null));
}

function parse<T>(raw: string | undefined, fallback: T, ok: (v: unknown) => boolean): T {
  if (raw === undefined) return fallback;
  try {
    const v: unknown = JSON.parse(raw);
    return ok(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}
const isList = (v: unknown) => Array.isArray(v);
const isRecord = (v: unknown) => Boolean(v) && typeof v === "object" && !Array.isArray(v);

function unionList(a: string | undefined, b: string | undefined): string | undefined {
  if (a === undefined && b === undefined) return undefined;
  const list = [...parse<unknown[]>(a, [], isList), ...parse<unknown[]>(b, [], isList)];
  return JSON.stringify([...new Set(list.filter((x) => typeof x === "string"))]);
}

/**
 * Combine two copies that both changed since they last agreed. Nothing is
 * lost: built projects, flashes, sightings, the shopping list and the drawer
 * are unions (a project built on both keeps its earlier date). Only the
 * chosen board, a single value, takes "mine".
 */
export function mergeSync(theirs: SyncData, mine: SyncData): SyncData {
  const out: SyncData = {};
  const a = parse<Record<string, { at?: string }>>(theirs.built, {}, isRecord);
  const b = parse<Record<string, { at?: string }>>(mine.built, {}, isRecord);
  if (theirs.built !== undefined || mine.built !== undefined) {
    const built = { ...a };
    for (const [id, mark] of Object.entries(b)) {
      const other = built[id];
      if (!other || (mark?.at && other.at && mark.at < other.at)) built[id] = mark;
    }
    out.built = JSON.stringify(built);
  }
  for (const k of ["flashed", "seen", "shop"] as const) {
    const v = unionList(theirs[k], mine[k]);
    if (v !== undefined) out[k] = v;
  }
  if (theirs.drawer !== undefined || mine.drawer !== undefined) {
    const parts = [...(theirs.drawer ?? "").split(","), ...(mine.drawer ?? "").split(",")].filter(Boolean);
    out.drawer = [...new Set(parts)].join(",");
  }
  const board = mine.board ?? theirs.board;
  if (board !== undefined) out.board = board;
  return out;
}

/** What to do on a check, given the cloud copy, this browser's copy and the copy both last agreed on. */
export function plan(cloud: SyncData, local: SyncData, agreed: string): "nothing" | "push" | "pull" | "merge" {
  const cloudChanged = fingerprint(cloud) !== agreed;
  const localChanged = fingerprint(local) !== agreed;
  if (fingerprint(cloud) === fingerprint(local)) return "nothing";
  if (cloudChanged && localChanged) return "merge";
  return cloudChanged ? "pull" : "push";
}

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
/** The canonical form of a typed code, or null; the same rules as the API's. */
export function normaliseCode(input: string): string | null {
  const raw = input.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  if (raw.length !== 16 || [...raw].some((c) => !ALPHABET.includes(c))) return null;
  return [0, 4, 8, 12].map((i) => raw.slice(i, i + 4)).join("-");
}
