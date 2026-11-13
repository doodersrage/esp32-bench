// Step-by-step build mode for a wiring diagram. Loaded on demand by the
// "Build it step by step" button (see src/components/WiringDiagram.astro).
//
// Steps come from the diagram's data-steps: power and ground first, so the part
// is never half powered while you wire signals, then the signals in table order,
// then anything that is already on the board or on the other board.

interface Step {
  row: number;
  text: string;
  note: string;
  drawn: boolean;
  pads: string[];
}

const started = new WeakSet<HTMLElement>();

function storageKey(fig: HTMLElement): string {
  return `bench.build.${fig.dataset.project}.${fig.dataset.board}`;
}

function loadDone(fig: HTMLElement): Set<number> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(storageKey(fig)) ?? "[]");
    return new Set(Array.isArray(raw) ? raw.filter((n): n is number => typeof n === "number") : []);
  } catch {
    return new Set();
  }
}

function saveDone(fig: HTMLElement, done: Set<number>): void {
  try {
    localStorage.setItem(storageKey(fig), JSON.stringify([...done]));
  } catch {
    // Storage can be blocked; ticks then last for this visit only.
  }
}

/** The pad row on the project's Pinout figure with this header label, if any. */
function pinoutRows(fig: HTMLElement, pads: string[]): HTMLElement[] {
  const panel = fig.closest<HTMLElement>("[data-panel]");
  if (!panel) return [];
  const rows = [...panel.querySelectorAll<HTMLElement>(".pinrow")];
  return pads
    .map((pad) =>
      rows.find((r) => {
        const span = r.querySelector("span");
        const last = span?.lastChild?.textContent?.trim() ?? span?.textContent?.trim();
        const first = span?.firstChild?.textContent?.trim();
        return last === pad || first === pad;
      }),
    )
    .filter((r): r is HTMLElement => !!r);
}

export function startBuild(fig: HTMLElement): void {
  const box = fig.querySelector<HTMLElement>("[data-wd-build]");
  const button = fig.querySelector<HTMLButtonElement>("[data-wd-start]");
  if (!box) return;
  if (started.has(fig)) {
    box.hidden = false;
    fig.classList.add("building");
    box.querySelector<HTMLElement>("[data-next]")?.focus();
    return;
  }
  started.add(fig);

  const steps: Step[] = JSON.parse(fig.dataset.steps ?? "[]");
  const done = loadDone(fig);
  let at = Math.max(0, steps.findIndex((s) => !done.has(s.row)));
  if (done.size >= steps.length) at = 0;

  box.innerHTML = `
    <div class="wdb-head">
      <strong class="wdb-count" aria-live="polite"></strong>
      <div class="wdb-bar" aria-hidden="true"><span></span></div>
    </div>
    <p class="wdb-text"></p>
    <p class="wdb-note cap left"></p>
    <label class="wdb-tick"><input type="checkbox" /> Done</label>
    <div class="row">
      <button class="btn sm" type="button" data-back>Back</button>
      <button class="btn sm go" type="button" data-next>Next</button>
      <button class="btn sm" type="button" data-close>Close</button>
      <span class="cap left">Arrow keys move between steps.</span>
    </div>
    <p class="wdb-done" hidden></p>`;
  box.tabIndex = -1;

  const count = box.querySelector<HTMLElement>(".wdb-count")!;
  const bar = box.querySelector<HTMLElement>(".wdb-bar span")!;
  const text = box.querySelector<HTMLElement>(".wdb-text")!;
  const note = box.querySelector<HTMLElement>(".wdb-note")!;
  const tick = box.querySelector<HTMLInputElement>(".wdb-tick input")!;
  const back = box.querySelector<HTMLButtonElement>("[data-back]")!;
  const next = box.querySelector<HTMLButtonElement>("[data-next]")!;
  const finished = box.querySelector<HTMLElement>(".wdb-done")!;
  const wires = [...fig.querySelectorAll<SVGGElement>(".wire")];
  const pads = [...fig.querySelectorAll<SVGGElement>(".pad")];
  let held: HTMLElement[] = [];

  function render(): void {
    const s = steps[at];
    count.textContent = `Step ${at + 1} of ${steps.length}`;
    bar.style.width = `${(done.size / steps.length) * 100}%`;
    text.textContent = s.drawn ? s.text : `${s.text} Not drawn: nothing to wire on this board for this step.`;
    note.textContent = s.note;
    note.hidden = !s.note;
    tick.checked = done.has(s.row);
    back.disabled = at === 0;
    next.textContent = at === steps.length - 1 ? "Finish" : "Next";
    for (const w of wires) {
      // A rail belongs to every row on it (data-rows); other wires to one row (data-row).
      const rows = (w.dataset.rows ?? w.dataset.row ?? "").split(",").filter(Boolean).map(Number);
      const now = rows.includes(s.row);
      w.classList.toggle("now", now);
      w.classList.toggle("done", !now && rows.length > 0 && rows.every((r) => done.has(r)));
    }
    for (const p of pads) p.classList.toggle("now", s.pads.includes(p.dataset.pad ?? ""));
    for (const r of held) r.classList.remove("held");
    held = pinoutRows(fig, s.pads);
    for (const r of held) r.classList.add("held");

    const all = done.size >= steps.length;
    finished.hidden = !all;
    if (all) {
      finished.replaceChildren(
        "Everything is wired. Check the power and ground wires once more, then ",
        Object.assign(document.createElement("a"), { href: fig.dataset.bench ?? "/bench/", textContent: `open the bench at ${fig.dataset.baud} baud` }),
        " and flash the sketch.",
      );
    }
  }

  function go(to: number): void {
    at = Math.min(steps.length - 1, Math.max(0, to));
    render();
  }

  tick.addEventListener("change", () => {
    if (tick.checked) done.add(steps[at].row);
    else done.delete(steps[at].row);
    saveDone(fig, done);
    render();
  });
  back.addEventListener("click", () => go(at - 1));
  next.addEventListener("click", () => {
    // Moving on counts as done, so ticking every box is optional.
    done.add(steps[at].row);
    saveDone(fig, done);
    if (at < steps.length - 1) go(at + 1);
    else render();
  });
  box.querySelector("[data-close]")!.addEventListener("click", () => {
    box.hidden = true;
    fig.classList.remove("building");
    for (const r of held) r.classList.remove("held");
    held = [];
    button?.focus();
  });
  box.addEventListener("keydown", (e) => {
    if ((e.target as HTMLElement).tagName === "INPUT" && e.key === " ") return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(at + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(at - 1);
    } else if (e.key === "Escape") {
      box.querySelector<HTMLButtonElement>("[data-close]")!.click();
    }
  });

  fig.classList.add("building");
  box.hidden = false;
  render();
  next.focus();
}
