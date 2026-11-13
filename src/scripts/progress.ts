// Build log, streaks and badges. Everything lives in this browser's storage,
// so it is a personal log for one device, not an account.

export interface BuildMark {
  /** ISO timestamp of when the project was marked as built */
  at: string;
  board?: string;
}
export type Built = Record<string, BuildMark>;
export type Seen = "brownout" | "guru";

export interface ProjectMeta {
  id: string;
  tags: string[];
  flash: boolean;
}

const BUILT_KEY = "bench.built";
const SEEN_KEY = "bench.seen";
const FLASHED_KEY = "bench.flashed";
const SHOP_KEY = "bench.shop";

export function loadBuilt(): Built {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(BUILT_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Built) : {};
  } catch {
    return {};
  }
}

export function saveBuilt(built: Built) {
  try {
    localStorage.setItem(BUILT_KEY, JSON.stringify(built));
  } catch {
    // Without storage the log lasts for this page view only.
  }
}

export function loadSeen(): Seen[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as Seen[]) : [];
  } catch {
    return [];
  }
}

export function markSeen(what: Seen) {
  const seen = loadSeen();
  if (seen.includes(what)) return;
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, what]));
  } catch {
    // Ignore.
  }
}

/** Projects flashed successfully from their page in this browser. */
export function loadFlashed(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(FLASHED_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function markFlashed(projectId: string) {
  const flashed = loadFlashed();
  if (flashed.includes(projectId)) return;
  try {
    localStorage.setItem(FLASHED_KEY, JSON.stringify([...flashed, projectId]));
  } catch {
    // Ignore.
  }
}

/** Project ids on the shopping list, in the order they were added. */
export function loadShop(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SHOP_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function saveShop(ids: string[]) {
  try {
    localStorage.setItem(SHOP_KEY, JSON.stringify([...new Set(ids)]));
  } catch {
    // Without storage the list lasts for this page view only.
  }
}

const dayNumber = (iso: string) => {
  const d = new Date(iso);
  return Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86_400_000);
};

/** Longest run of consecutive days with at least one build. */
export function longestStreak(built: Built): number {
  const days = [...new Set(Object.values(built).map((m) => dayNumber(m.at)))].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  days.forEach((day, i) => {
    run = i > 0 && day === days[i - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

/** Consecutive days with a build, counting back from today or yesterday. */
export function currentStreak(built: Built, now = new Date()): number {
  const days = new Set(Object.values(built).map((m) => dayNumber(m.at)));
  let day = dayNumber(now.toISOString());
  if (!days.has(day)) day -= 1;
  let run = 0;
  while (days.has(day)) {
    run += 1;
    day -= 1;
  }
  return run;
}

interface Context {
  built: Built;
  seen: Seen[];
  /** Project ids flashed from the browser (see markFlashed) */
  flashed: string[];
  projects: ProjectMeta[];
}

export interface Badge {
  id: string;
  name: string;
  /** How to earn it */
  how: string;
  earned(ctx: Context): boolean;
}

const builtWith = (ctx: Context, test: (p: ProjectMeta) => boolean) =>
  ctx.projects.filter((p) => ctx.built[p.id] && test(p)).length;

export const BADGES: Badge[] = [
  { id: "first", name: "First light", how: "Mark any project as built.", earned: (c) => Object.keys(c.built).length >= 1 },
  { id: "blink", name: "Hello, blink", how: "Build Blink and heartbeat.", earned: (c) => Boolean(c.built["blink"]) },
  {
    id: "flash", name: "No IDE required", how: "Flash a project from its page, then mark it as built.",
    // Projects with their own flasher can only be built that way, so they count without a recorded flash.
    earned: (c) => builtWith(c, (p) => p.flash || c.flashed.includes(p.id)) >= 1,
  },
  { id: "air", name: "On the air", how: "Build a Wi-Fi or radio project.", earned: (c) => builtWith(c, (p) => p.tags.includes("wireless")) >= 1 },
  { id: "sensors", name: "Sensor wrangler", how: "Build three sensor projects.", earned: (c) => builtWith(c, (p) => p.tags.includes("sensors")) >= 3 },
  {
    id: "boards", name: "Three boards", how: "Build on an ESP32, an S3 and a C3.",
    earned: (c) => new Set(Object.values(c.built).map((m) => m.board).filter(Boolean)).size >= 3,
  },
  { id: "streak", name: "Three-day streak", how: "Build something three days in a row.", earned: (c) => longestStreak(c.built) >= 3 },
  {
    id: "owl", name: "Night shift", how: "Finish a build between midnight and 5 am.",
    earned: (c) => Object.values(c.built).some((m) => new Date(m.at).getHours() < 5),
  },
  { id: "brownout", name: "Survived a brownout", how: "Catch a brownout reset on the bench.", earned: (c) => c.seen.includes("brownout") },
  { id: "guru", name: "Met the Guru", how: "Catch a Guru Meditation crash on the bench.", earned: (c) => c.seen.includes("guru") },
  { id: "half", name: "Half the library", how: "Build half of the projects.", earned: (c) => builtWith(c, () => true) >= Math.ceil(c.projects.length / 2) },
  { id: "full", name: "Full bench", how: "Build every project.", earned: (c) => c.projects.length > 0 && builtWith(c, () => true) === c.projects.length },
];
