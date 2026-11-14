// "What it prints" on project pages: replays the serial output recorded when
// the project's library firmware ran in QEMU (scripts/emulate-firmware.mjs).
import { pageLocale, translator } from "../i18n/t";
import { PROJECT } from "../i18n/strings/project";

const t = translator(PROJECT, pageLocale());
interface BoardRun {
  /** Index of the first line printed by the app; lines before it are the ROM's boot messages */
  app: number;
  /** [ms since power-on, text] */
  lines: [number, string][];
}
interface Preview {
  builtAt: string | null;
  boards: Record<string, BoardRun>;
}

const box = document.getElementById("preview");
const term = document.getElementById("preview-term");
const pick = document.getElementById("preview-board") as HTMLSelectElement | null;
const replayBtn = document.getElementById("preview-replay");
const note = document.getElementById("preview-note");
/** Longest pause shown between two lines, and the longest whole replay */
const MAX_GAP = 2500;
const MAX_TOTAL = 15_000;

let timers: number[] = [];

function line(text: string, cls?: string) {
  const d = document.createElement("div");
  d.textContent = text || " ";
  if (cls) d.className = cls;
  term!.append(d);
  term!.scrollTop = term!.scrollHeight;
}

function play(run: BoardRun, animate: boolean) {
  timers.forEach(clearTimeout);
  timers = [];
  term!.replaceChildren();
  // The ROM boot messages appear at once, dimmed; the sketch's lines keep their pace.
  run.lines.slice(0, run.app).forEach(([, text]) => line(text, "sys"));
  const app = run.lines.slice(run.app);
  if (!animate) {
    app.forEach(([, text]) => line(text));
    return;
  }
  let clock = 0;
  let prev = app[0]?.[0] ?? 0;
  for (const [t, text] of app) {
    clock += Math.min(Math.max(t - prev, 0), MAX_GAP);
    prev = t;
    if (clock > MAX_TOTAL) break;
    timers.push(window.setTimeout(() => line(text), clock));
  }
  // Past the time limit: show the rest at the end rather than cut it.
  timers.push(window.setTimeout(() => {
    const shown = term!.querySelectorAll("div:not(.sys)").length;
    app.slice(shown).forEach(([, text]) => line(text));
  }, Math.min(clock, MAX_TOTAL) + 50));
}

async function start() {
  if (!box || !term || !pick || !note) return;
  let data: Preview;
  try {
    const res = await fetch(box.dataset.src ?? "", { cache: "no-cache" });
    if (!res.ok) return;
    data = (await res.json()) as Preview;
  } catch {
    return;
  }
  const names = JSON.parse(box.dataset.names ?? "{}") as Record<string, string>;
  const boards = Object.keys(data.boards).filter((b) => data.boards[b].lines.length > 0);
  if (boards.length === 0) return;
  for (const b of boards) pick.append(new Option(names[b] ?? b, b));
  pick.hidden = boards.length < 2;
  note.textContent = data.builtAt ? t("previewNoteBuilt", { date: data.builtAt.slice(0, 10) }) : t("previewNote");
  box.hidden = false;

  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const go = (animate = !still) => play(data.boards[pick.value], animate);
  // Until the replay starts, show the boot messages so the box is never blank.
  const run = data.boards[pick.value];
  run.lines.slice(0, run.app).forEach(([, text]) => line(text, "sys"));
  pick.addEventListener("change", () => go());
  replayBtn?.addEventListener("click", () => go());
  // Start when it scrolls into view, so the replay is not over before anyone looks.
  const seen = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      seen.disconnect();
      go();
    }
  });
  seen.observe(term);
}

void start();

export {};
