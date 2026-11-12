// Library page: search and filters, built marks, the bench log with badges,
// and the "what can I build tonight" picker.
import { BADGES, currentStreak, loadBuilt, loadSeen, type ProjectMeta } from "./progress";

const q = document.getElementById("q") as HTMLInputElement;
const empty = document.getElementById("empty") as HTMLElement;
const chips = [...document.querySelectorAll<HTMLButtonElement>("#chips .chip")];
const cards = [...document.querySelectorAll<HTMLElement>("#grid .card")];

const recall = (key: string): string | null => {
  try {
    return localStorage.getItem(`bench.${key}`);
  } catch {
    return null;
  }
};
const remember = (key: string, value: string) => {
  try {
    localStorage.setItem(`bench.${key}`, value);
  } catch {
    // Remembering choices is a convenience only.
  }
};

/* ---------- Search and filters ---------- */
let activeTag = recall("tag") ?? "all";
if (!chips.some((c) => c.dataset.tag === activeTag)) activeTag = "all";

function applyFilters() {
  const words = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let shown = 0;
  for (const card of cards) {
    const tags = (card.dataset.tags ?? "").split(" ");
    const hay = card.dataset.hay ?? "";
    const ok = (activeTag === "all" || tags.includes(activeTag)) && words.every((w) => hay.includes(w));
    card.hidden = !ok;
    if (ok) shown++;
  }
  empty.hidden = shown > 0;
  for (const chip of chips) chip.setAttribute("aria-pressed", String(chip.dataset.tag === activeTag));
}
for (const chip of chips) {
  chip.addEventListener("click", () => {
    activeTag = chip.dataset.tag ?? "all";
    remember("tag", activeTag);
    applyFilters();
  });
}
q.addEventListener("input", applyFilters);
applyFilters();

/* ---------- Built marks, streak and badges ---------- */
const projects: ProjectMeta[] = cards.map((card) => ({
  id: card.dataset.id ?? "",
  tags: (card.dataset.tags ?? "").split(" "),
  flash: card.dataset.flash === "1",
}));
const built = loadBuilt();
const builtCount = projects.filter((p) => built[p.id]).length;

for (const card of cards) {
  const mark = card.querySelector<HTMLElement>("[data-built]");
  if (mark) mark.hidden = !built[card.dataset.id ?? ""];
}

const context = { built, seen: loadSeen(), projects };
let earned = 0;
for (const badge of BADGES) {
  const el = document.querySelector<HTMLElement>(`[data-badge="${badge.id}"]`);
  if (!el) continue;
  const has = badge.earned(context);
  if (has) earned++;
  el.classList.toggle("earned", has);
  const state = el.querySelector("[data-badge-state]");
  if (state) state.textContent = has ? "Earned" : "Locked";
}

const streak = currentStreak(built);
const summary = document.getElementById("log-summary");
if (summary) {
  summary.textContent =
    builtCount === 0
      ? "Nothing built yet. Open a project and mark it as built when it works."
      : `${builtCount} of ${projects.length} built. ${earned} of ${BADGES.length} badges. ` +
        (streak > 0 ? `Current streak: ${streak} ${streak === 1 ? "day" : "days"}.` : "No streak running. Build something today to start one.");
}

/* ---------- What can I build tonight ---------- */
const partChips = [...document.querySelectorAll<HTMLButtonElement>("#drawer [data-part]")];
const pickButton = document.getElementById("pick") as HTMLButtonElement | null;
const pickResult = document.getElementById("pick-result");
const drawer = new Set((recall("drawer") ?? "").split(",").filter(Boolean));
let lastPick = "";

function showDrawer() {
  for (const chip of partChips) chip.setAttribute("aria-pressed", String(drawer.has(chip.dataset.part ?? "")));
}
for (const chip of partChips) {
  chip.addEventListener("click", () => {
    const part = chip.dataset.part ?? "";
    if (drawer.has(part)) drawer.delete(part);
    else drawer.add(part);
    remember("drawer", [...drawer].join(","));
    showDrawer();
  });
}
showDrawer();

/** A project is buildable when every group of alternatives has one part in the drawer. */
function buildable(card: HTMLElement): boolean {
  const groups = (card.dataset.needs ?? "").split(" ").filter(Boolean);
  return groups.every((group) => group.split("|").some((part) => drawer.has(part)));
}

pickButton?.addEventListener("click", () => {
  if (!pickResult) return;
  for (const card of cards) card.classList.remove("picked");
  const candidates = cards.filter(buildable);
  // Prefer something not built yet, and avoid repeating the last pick.
  const fresh = candidates.filter((c) => !built[c.dataset.id ?? ""]);
  let pool = fresh.length > 0 ? fresh : candidates;
  if (pool.length > 1) pool = pool.filter((c) => c.dataset.id !== lastPick);
  const pick = pool[Math.floor(Math.random() * pool.length)];
  if (!pick) {
    pickResult.textContent = "Nothing matches. Every project needs at least a board.";
    return;
  }
  lastPick = pick.dataset.id ?? "";
  const name = pick.querySelector(".name")?.textContent ?? "this one";
  const link = document.createElement("a");
  link.href = (pick as HTMLAnchorElement).href;
  link.textContent = name;
  pickResult.replaceChildren(
    `Tonight: `,
    link,
    `. ${candidates.length} of ${cards.length} projects fit your drawer` + (fresh.length === 0 ? ", and you have built them all." : "."),
  );
  // Make sure the picked card is visible, then point at it.
  if (pick.hidden) {
    activeTag = "all";
    q.value = "";
    applyFilters();
  }
  pick.classList.add("picked");
});
