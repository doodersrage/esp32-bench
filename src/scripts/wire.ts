// Wiring pad: pick a board and parts, tap a part pin and then a board pad.
// The rules in src/lib/wiring.ts check every wire as it is made.
import { BOARDS, boardById, type Board, type BoardId } from "../data/boards";
import { partById, type Part } from "../data/parts";
import { autoWire, checkWiring, pinConstants, type Connection } from "../lib/wiring";

interface State {
  board: BoardId;
  parts: string[];
  connections: Connection[];
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const boardChips = [...document.querySelectorAll<HTMLButtonElement>("#w-boards [data-board]")];
const partChips = [...document.querySelectorAll<HTMLButtonElement>("#w-parts [data-part]")];
const pinsBox = $("w-pins");
const boardBox = $("w-board");
const status = $("w-status");
const findings = $("w-findings");
const tableBody = $("w-table");
const code = $("w-code");

const STORE = "bench.wire";
let state: State = { board: "esp32", parts: ["dht22"], connections: [] };
/** The part pin waiting for a pad, as "part/pin" */
let selected: string | null = null;

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? "null") as Partial<State> | null;
    if (saved && BOARDS.some((b) => b.id === saved.board) && Array.isArray(saved.parts) && Array.isArray(saved.connections)) {
      state = { board: saved.board as BoardId, parts: saved.parts.filter((id) => partById(id)), connections: saved.connections };
      return true;
    }
  } catch {
    // Fall through to the starting example.
  }
  return false;
}
function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify(state));
  } catch {
    // The pad still works for this visit.
  }
}

const board = (): Board => boardById(state.board);
const parts = (): Part[] => state.parts.map(partById).filter((p): p is Part => Boolean(p));
const padOf = (part: string, pin: string) => state.connections.find((c) => c.part === part && c.pin === pin)?.pad;
const gpioName = (pad: string) => (/^\d+$/.test(pad) ? `GPIO ${pad}` : pad);

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function nextOpenPin(): string | null {
  for (const part of parts()) for (const pin of part.pins) if (!padOf(part.id, pin.name)) return `${part.id}/${pin.name}`;
  return null;
}

function connect(pad: string) {
  if (!selected) {
    status.textContent = "Pick a part pin first, then a pad.";
    return;
  }
  const [part, pin] = selected.split("/");
  state.connections = state.connections.filter((c) => !(c.part === part && c.pin === pin));
  state.connections.push({ part, pin, pad });
  selected = nextOpenPin();
  save();
  render();
}

function renderPins() {
  pinsBox.replaceChildren(
    ...parts().map((part) => {
      const group = el("div", "wpart");
      group.append(el("span", "wpartname", part.name));
      const row = el("div", "row");
      for (const pin of part.pins) {
        const id = `${part.id}/${pin.name}`;
        const pad = padOf(part.id, pin.name);
        const button = el("button", "chip wpin", pad ? `${pin.name} → ${gpioName(pad)}` : pin.name);
        button.type = "button";
        button.setAttribute("aria-pressed", String(selected === id));
        if (pad) button.classList.add("wired");
        button.addEventListener("click", () => {
          selected = selected === id ? null : id;
          render();
        });
        row.append(button);
      }
      group.append(row);
      return group;
    }),
  );
  if (parts().length === 0) pinsBox.append(el("p", "lede", "Add a part to start wiring."));
}

function renderBoard() {
  const b = board();
  const used = new Map<string, string[]>();
  for (const c of state.connections) {
    if (!state.parts.includes(c.part)) continue;
    used.set(c.pad, [...(used.get(c.pad) ?? []), `${partById(c.part)?.name ?? c.part} ${c.pin}`]);
  }
  const grid = el("div", "board");
  const pcb = el("div", "pcb");
  pcb.style.gridRow = `1 / span ${b.left.length}`;
  pcb.append(el("div", "can"), el("div", "silk", b.short), el("div", "usb"));
  grid.append(pcb);

  const lit = new Set<string>();
  const pad = (label: string, side: "l" | "r", row: number) => {
    const button = el("button", `pinrow ${side}`);
    button.type = "button";
    button.style.gridColumn = side === "l" ? "1" : "3";
    button.style.gridRow = String(row);
    const rule = b.special[label];
    const users = used.get(label);
    // Supply and ground pads repeat; light the first one so one wire shows as one pad.
    if (users && !lit.has(label)) {
      lit.add(label);
      button.classList.add("on");
    }
    if (rule && ["strap", "usb", "uart", "caution", "flash", "input-only"].includes(rule.kind)) button.classList.add("care");
    const text = el("span", "", label);
    const hole = el("i");
    button.append(...(side === "l" ? [text, hole] : [hole, text]));
    button.setAttribute(
      "aria-label",
      `${gpioName(label)}${rule ? `, ${rule.why}` : ""}${users ? ` Connected to ${users.join(" and ")}.` : ""}`,
    );
    button.title = rule ? `${gpioName(label)}: ${rule.why}` : gpioName(label);
    button.addEventListener("click", () => connect(label));
    return button;
  };
  b.left.forEach((label, i) => grid.append(pad(label, "l", i + 1), pad(b.right[i], "r", i + 1)));
  boardBox.replaceChildren(grid);
}

function renderResults() {
  const list = parts();
  const found = checkWiring(board(), list, state.connections.filter((c) => state.parts.includes(c.part)));
  const labels = { error: "Fix", warn: "Careful", note: "Note" };
  findings.replaceChildren(
    ...found.map((f) => {
      const li = el("li", `finding ${f.level}`);
      li.append(el("span", `tag ${f.level === "error" ? "bad" : f.level === "warn" ? "warnt" : ""}`, labels[f.level]), el("span", "", f.text));
      return li;
    }),
  );
  if (found.length === 0 && list.length > 0) findings.append(el("li", "finding", "Every pin is connected and nothing looks risky."));

  tableBody.replaceChildren(
    ...list.flatMap((part) =>
      part.pins.map((pin) => {
        const tr = el("tr");
        const pad = padOf(part.id, pin.name);
        tr.append(el("td", "", `${part.name} ${pin.name}`), el("td", "m", pad ? gpioName(pad) : "not connected"));
        return tr;
      }),
    ),
  );
  code.textContent = pinConstants(list, state.connections) || "// Signal pins appear here once they are wired.";

  const errors = found.filter((f) => f.level === "error").length;
  if (selected) {
    const [partId, pin] = selected.split("/");
    status.textContent = `Now tap a pad for ${partById(partId)?.name ?? partId} ${pin}.`;
  } else if (list.length === 0) {
    status.textContent = "";
  } else {
    status.textContent = errors > 0 ? `${errors} ${errors === 1 ? "wire needs" : "wires need"} fixing.` : nextOpenPin() ? "Tap a part pin to continue." : "All wired.";
  }
}

function render() {
  for (const chip of boardChips) chip.setAttribute("aria-pressed", String(chip.dataset.board === state.board));
  for (const chip of partChips) chip.setAttribute("aria-pressed", String(state.parts.includes(chip.dataset.part ?? "")));
  renderPins();
  renderBoard();
  renderResults();
}

function wireAll() {
  state.connections = autoWire(board(), parts());
  selected = null;
  save();
  render();
}

for (const chip of boardChips) {
  chip.addEventListener("click", () => {
    const next = chip.dataset.board as BoardId;
    if (next === state.board) return;
    state.board = next;
    // Pad labels differ between boards, so start the wiring again on the new one.
    wireAll();
  });
}
for (const chip of partChips) {
  chip.addEventListener("click", () => {
    const id = chip.dataset.part ?? "";
    if (state.parts.includes(id)) {
      state.parts = state.parts.filter((p) => p !== id);
      state.connections = state.connections.filter((c) => c.part !== id);
      if (selected?.startsWith(`${id}/`)) selected = null;
    } else {
      state.parts.push(id);
      selected = `${id}/${partById(id)?.pins[0].name ?? ""}`;
    }
    save();
    render();
  });
}
$("w-auto").addEventListener("click", wireAll);
$("w-clear").addEventListener("click", () => {
  state.connections = [];
  selected = nextOpenPin();
  save();
  render();
});
$("w-copy").addEventListener("click", async () => {
  const button = $<HTMLButtonElement>("w-copy");
  const label = button.textContent;
  const rows = [...tableBody.querySelectorAll("tr")].map((tr) => [...tr.children].map((td) => td.textContent).join(" -> "));
  try {
    await navigator.clipboard.writeText(`${board().name}\n${rows.join("\n")}\n\n${code.textContent}`);
    button.textContent = "Copied";
  } catch {
    button.textContent = "Copy blocked";
  }
  setTimeout(() => {
    button.textContent = label;
  }, 1600);
});

// Remix: load the parts two projects need and wire them together without clashes.
$("remix-go").addEventListener("click", () => {
  const chosen = new Set<string>();
  for (const id of ["remix-a", "remix-b"]) {
    const option = $<HTMLSelectElement>(id).selectedOptions[0];
    for (const group of (option?.dataset.needs ?? "").split(" ").filter(Boolean)) {
      const alternatives = group.split("|");
      // Reuse a part that is already on the pad when it satisfies this need.
      if (!alternatives.some((a) => chosen.has(a))) chosen.add(alternatives[0]);
    }
  }
  const note = $("remix-note");
  if (chosen.size === 0) {
    note.textContent = "Neither project needs parts beyond the board, so there is nothing to wire.";
    return;
  }
  state.parts = [...chosen].filter((id) => partById(id));
  wireAll();
  const names = state.parts.map((id) => partById(id)?.name).join(", ");
  note.textContent = `Loaded ${names}. This merges the wiring and pin numbers. The two sketches still have to be combined by hand.`;
});

if (!load()) state.connections = autoWire(board(), parts());
selected = nextOpenPin();
render();
