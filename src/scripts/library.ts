// Library page: search and filters, built marks, the bench log with badges,
// and the "what can I build tonight" picker.
import { BADGES, currentStreak, loadBuilt, loadFlashed, loadSeen, type ProjectMeta } from "./progress";

const q = document.getElementById("q") as HTMLInputElement;
const empty = document.getElementById("empty") as HTMLElement;
const chips = [...document.querySelectorAll<HTMLButtonElement>("#chips .chip")];
const levelChips = [...document.querySelectorAll<HTMLButtonElement>("#levels .chip")];
const boardSelect = document.getElementById("board-filter") as HTMLSelectElement | null;
const sortSelect = document.getElementById("sort") as HTMLSelectElement | null;
const grid = document.getElementById("grid") as HTMLElement;
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
let activeLevel = recall("level") ?? "all";
if (!levelChips.some((c) => c.dataset.level === activeLevel)) activeLevel = "all";

// The board is shared with project pages ("bench.board"), so choosing it here
// also opens every project on that board's pinout. ?board=<id> sets it from a link.
const boardIds = new Set([...(boardSelect?.options ?? [])].map((o) => o.value));
const fromLink = new URLSearchParams(location.search).get("board");
let activeBoard = fromLink && boardIds.has(fromLink) ? fromLink : (recall("board") ?? "all");
if (!boardIds.has(activeBoard)) activeBoard = "all";
if (fromLink && activeBoard === fromLink) remember("board", activeBoard);
if (boardSelect) boardSelect.value = activeBoard;
const onBoard = (card: HTMLElement) => activeBoard === "all" || (card.dataset.boards ?? "").split(" ").includes(activeBoard);

let activeSort = recall("sort") ?? "suggested";
if (sortSelect && ![...sortSelect.options].some((o) => o.value === activeSort)) activeSort = "suggested";
if (sortSelect) sortSelect.value = activeSort;

const num = (card: HTMLElement, key: string) => Number(card.dataset[key] ?? 0);
const ORDER: Record<string, (a: HTMLElement, b: HTMLElement) => number> = {
  suggested: (a, b) => num(a, "suggest") - num(b, "suggest"),
  newest: (a, b) => (b.dataset.added ?? "").localeCompare(a.dataset.added ?? "") || num(b, "order") - num(a, "order"),
  quickest: (a, b) => num(a, "mins") - num(b, "mins") || num(a, "suggest") - num(b, "suggest"),
};
function applySort() {
  const sorted = [...cards].sort(ORDER[activeSort] ?? ORDER.suggested);
  grid.append(...sorted);
}

function applyFilters() {
  const words = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let shown = 0;
  for (const card of cards) {
    const tags = (card.dataset.tags ?? "").split(" ");
    const hay = card.dataset.hay ?? "";
    const ok =
      (activeTag === "all" || tags.includes(activeTag)) &&
      (activeLevel === "all" || card.dataset.level === activeLevel) &&
      onBoard(card) &&
      words.every((w) => hay.includes(w));
    card.hidden = !ok;
    if (ok) shown++;
  }
  empty.hidden = shown > 0;
  // Number the cards in the order they are shown.
  let n = 0;
  for (const card of grid.querySelectorAll<HTMLElement>(".card")) {
    if (card.hidden) continue;
    const no = card.querySelector("[data-no]");
    if (no) no.textContent = `No. ${String(++n).padStart(2, "0")}`;
  }
  for (const chip of chips) chip.setAttribute("aria-pressed", String(chip.dataset.tag === activeTag));
  for (const chip of levelChips) chip.setAttribute("aria-pressed", String(chip.dataset.level === activeLevel));
}
for (const chip of chips) {
  chip.addEventListener("click", () => {
    activeTag = chip.dataset.tag ?? "all";
    remember("tag", activeTag);
    applyFilters();
  });
}
for (const chip of levelChips) {
  chip.addEventListener("click", () => {
    activeLevel = chip.dataset.level ?? "all";
    remember("level", activeLevel);
    applyFilters();
  });
}
boardSelect?.addEventListener("change", () => {
  activeBoard = boardSelect.value;
  remember("board", activeBoard === "all" ? "" : activeBoard);
  applyFilters();
});
sortSelect?.addEventListener("change", () => {
  activeSort = sortSelect.value;
  remember("sort", activeSort);
  applySort();
  applyFilters();
});
q.addEventListener("input", applyFilters);
applySort();
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

const context = { built, seen: loadSeen(), flashed: loadFlashed(), projects };
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
// Open the picker for anyone who has used it before, or who followed a link to it.
const drawerBox = document.getElementById("drawer") as HTMLDetailsElement | null;
if (drawerBox && (drawer.size > 0 || location.hash === "#drawer")) drawerBox.open = true;

/** A project is buildable when every group of alternatives has one part in the drawer. */
function buildable(card: HTMLElement): boolean {
  const groups = (card.dataset.needs ?? "").split(" ").filter(Boolean);
  return groups.every((group) => group.split("|").some((part) => drawer.has(part)));
}

pickButton?.addEventListener("click", () => {
  if (!pickResult) return;
  for (const card of cards) card.classList.remove("picked");
  // Only projects that run on the chosen board, if one is chosen.
  const candidates = cards.filter((c) => buildable(c) && onBoard(c));
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
    `. ${candidates.length} of ${cards.filter(onBoard).length} projects fit your drawer` + (fresh.length === 0 ? ", and you have built them all." : "."),
  );
  // Make sure the picked card is visible, then point at it.
  if (pick.hidden) {
    activeTag = "all";
    activeLevel = "all";
    q.value = "";
    applyFilters();
  }
  pick.classList.add("picked");
});
