// Wiring pad: pick a board and parts, tap a part pin and then a board pad.
// The rules in src/lib/wiring.ts check every wire as it is made.
import { BOARDS, boardById, type Board, type BoardId } from "../data/boards";
import { partById, type Part } from "../data/parts";
import { autoWire, checkWiring, pinConstants, type Connection } from "../lib/wiring";
import { pageLocale, translator } from "../i18n/t";
import { PAD_WHY, PART_NAMES, PIN_NOTES, WIRE, byEnglish } from "../i18n/strings/bench";

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

const locale = pageLocale();
const t = translator(WIRE, locale);

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

/** A part's name in the page's language: generic names are translated, product names stay. */
const partName = (part: Part): string => (part.id in PART_NAMES.en ? translator(PART_NAMES, locale)(part.id as keyof typeof PART_NAMES.en) : part.name);
const whyText = (why: string) => byEnglish(PAD_WHY, why, locale);
const noteText = (note: string) => byEnglish(PIN_NOTES, note, locale);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A finding from src/lib/wiring.ts, rebuilt in the page's language. The lib
 * writes English sentences, so they are matched here against its templates;
 * anything that does not match is shown as it is.
 */
function findingText(text: string, list: Part[]): string {
  if (locale === "en") return text;
  // "Part PIN" as the lib writes it, and as this page shows it.
  const who = new Map<string, string>();
  for (const part of list) for (const pin of part.pins) who.set(`${part.name} ${pin.name}`, `${partName(part)} ${pin.name}`);
  const names = [...who.keys()].sort((a, b) => b.length - a.length).map(escape).join("|");
  if (!names) return text;
  const W = `(${names})`;
  const P = "(GPIO \\d+|[^\\s:]+)";
  let m: RegExpExecArray | null;

  if ((m = new RegExp(`^${W} on ${P}: (.*)$`).exec(text))) {
    const where = t("where", { who: who.get(m[1]) ?? m[1], pad: m[2] });
    const pad = m[2];
    const rest = m[3];
    const pin = m[1].slice(m[1].lastIndexOf(" ") + 1);
    if (rest === "this part runs on 3.3 V. 5 V can damage it and will put 5 V on its signal pins. Use 3V3.") return t("f3v3", { where });
    let r: RegExpExecArray | null;
    if ((r = /^(.+) belongs on (3V3|5V|GND)\.$/.exec(rest))) return t("fBelongs", { where, pin: r[1], label: r[2] });
    if ((r = /^that pad is (.*) Pick a numbered GPIO\.$/.exec(rest))) return t("fNotGpio", { where, why: whyText(r[1]) });
    const pullup = " This part relies on the internal pull-up, so add an external 10 kΩ to 3V3 or pick another pin.";
    if (rest.endsWith(pullup)) return t("fPullup", { where, why: whyText(rest.slice(0, -pullup.length)) });
    const drive = " needs a pin the board can drive.";
    if (rest.endsWith(drive)) {
      const head = rest.slice(0, -drive.length);
      const why = Object.values(PAD_WHY.en).find((w) => head.startsWith(`${w} `));
      if (why) return t("fInputOnly", { where, why: whyText(why), pin: head.slice(why.length + 1) || pin });
    }
    if ((r = new RegExp(`^${P} is (.*) Using it breaks flashing and the bench over that port\\.$`).exec(rest)))
      return t("fUsb", { where, gpio: r[1], why: whyText(r[2]) });
    if ((r = new RegExp(`^${P} is (.*)$`).exec(rest))) return t("fIs", { where, gpio: r[1], why: whyText(r[2]) });
    const raw = pad.replace(/^GPIO /, "");
    if (rest.startsWith(`${raw} `)) return t("fUart", { where, pad, why: whyText(rest.slice(raw.length + 1)) });
    return text;
  }
  if ((m = new RegExp(`^${W} outputs 5 V and ESP32 pins take 3\\.3 V\\. (.*)$`).exec(text)))
    return t("f5v", { who: who.get(m[1]) ?? m[1], note: noteText(m[2]) });
  if ((m = new RegExp(`^${W} is not connected yet\\.$`).exec(text))) return t("fOpen", { who: who.get(m[1]) ?? m[1] });
  if ((m = new RegExp(`^${W}: (.*)$`).exec(text))) return t("fNote", { who: who.get(m[1]) ?? m[1], note: noteText(m[2]) });
  if ((m = new RegExp(`^${P} is used twice: (.*)\\. Give each its own pin\\.$`).exec(text))) {
    const users = m[2].split(" and ").map((u) => who.get(u) ?? u);
    return t("fTwice", { gpio: m[1], users: users.join(t("joinAnd")) });
  }
  if (text === "I2C parts share SDA and SCL. Each needs its own address, or one will hide the other.") return t("fI2c");
  return text;
}

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
    status.textContent = t("pickFirst");
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
      group.append(el("span", "wpartname", partName(part)));
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
  if (parts().length === 0) pinsBox.append(el("p", "lede", t("addPart")));
}

function renderBoard() {
  const b = board();
  const used = new Map<string, string[]>();
  for (const c of state.connections) {
    if (!state.parts.includes(c.part)) continue;
    const part = partById(c.part);
    used.set(c.pad, [...(used.get(c.pad) ?? []), `${part ? partName(part) : c.part} ${c.pin}`]);
  }
  const grid = el("div", "board");
  const pcb = el("div", "pcb");
  pcb.style.gridRow = `1 / span ${b.left.length}`;
  const can = el("div", "can");
  // Short boards such as the XIAO get a smaller shield so the rows keep their spacing.
  if (b.left.length < 12) can.style.cssText = "height:44px;width:52px";
  pcb.append(can, el("div", "silk", b.short), el("div", "usb"));
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
    const silk = b.silk?.[label];
    const text = el("span", "", silk ? (side === "l" ? `${silk} · ${label}` : `${label} · ${silk}`) : label);
    const hole = el("i");
    button.append(...(side === "l" ? [text, hole] : [hole, text]));
    button.setAttribute(
      "aria-label",
      `${rule ? t("padTitle", { gpio: gpioName(label), why: whyText(rule.why) }) : gpioName(label)}${users ? ` ${t("padConnected", { users: users.join(t("joinAnd")) })}` : ""}`,
    );
    button.title = rule ? t("padTitle", { gpio: gpioName(label), why: whyText(rule.why) }) : gpioName(label);
    button.addEventListener("click", () => connect(label));
    return button;
  };
  b.left.forEach((label, i) => grid.append(pad(label, "l", i + 1), pad(b.right[i], "r", i + 1)));
  boardBox.replaceChildren(grid);
}

function renderResults() {
  const list = parts();
  const found = checkWiring(board(), list, state.connections.filter((c) => state.parts.includes(c.part)));
  const labels = { error: t("levelError"), warn: t("levelWarn"), note: t("levelNote") };
  findings.replaceChildren(
    ...found.map((f) => {
      const li = el("li", `finding ${f.level}`);
      li.append(el("span", `tag ${f.level === "error" ? "bad" : f.level === "warn" ? "warnt" : ""}`, labels[f.level]), el("span", "", findingText(f.text, list)));
      return li;
    }),
  );
  if (found.length === 0 && list.length > 0) findings.append(el("li", "finding", t("allGood")));

  tableBody.replaceChildren(
    ...list.flatMap((part) =>
      part.pins.map((pin) => {
        const tr = el("tr");
        const pad = padOf(part.id, pin.name);
        tr.append(el("td", "", `${partName(part)} ${pin.name}`), el("td", "m", pad ? gpioName(pad) : t("notConnected")));
        return tr;
      }),
    ),
  );
  code.textContent = pinConstants(list, state.connections) || t("codeEmpty");

  const errors = found.filter((f) => f.level === "error").length;
  if (selected) {
    const [partId, pin] = selected.split("/");
    const part = partById(partId);
    status.textContent = t("nowTap", { who: `${part ? partName(part) : partId} ${pin}` });
  } else if (list.length === 0) {
    status.textContent = "";
  } else {
    status.textContent = errors === 1 ? t("oneNeedsFix") : errors > 1 ? t("manyNeedFix", { n: errors }) : nextOpenPin() ? t("tapContinue") : t("allWired");
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
    button.textContent = t("copied");
  } catch {
    button.textContent = t("copyBlocked");
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
    note.textContent = t("remixNothing");
    return;
  }
  state.parts = [...chosen].filter((id) => partById(id));
  wireAll();
  const names = state.parts.map((id) => partById(id)).filter((p): p is Part => Boolean(p)).map(partName).join(", ");
  note.textContent = t("remixLoaded", { names });
});

if (!load()) state.connections = autoWire(board(), parts());
selected = nextOpenPin();
render();
