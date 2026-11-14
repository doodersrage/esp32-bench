// Detective page: lights up the pad being touched to ground, quizzes you on
// the silkscreen, and keeps a passport for each board you plug in.
import { boardById, type Board, type BoardId } from "../data/boards";
import type { ChipId } from "../data/chips";
import { megabytes, parseLine, toPassport, type Passport } from "../lib/detective";
import { SerialSession, getSerial } from "../lib/serial";
import { pageLocale, translator } from "../i18n/t";
import { HTML_LANG } from "../i18n/locales";
import { DETECTIVE, serialMessage } from "../i18n/strings/bench";

const locale = pageLocale();
const t = translator(DETECTIVE, locale);
/** megabytes() says "none" for no PSRAM. */
const size = (bytes: number) => (bytes <= 0 ? t("none") : megabytes(bytes));

interface SavedBoard extends Passport {
  name: string;
  savedAt: string;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const connectBtn = $<HTMLButtonElement>("d-connect");
const status = $("d-status");
const boardBox = $("d-board");
const readout = $("d-readout");
const history = $("d-history");
const quizBtn = $<HTMLButtonElement>("d-quiz");
const quizText = $("d-quiztext");
const passportBox = $("d-passport");
const saveForm = $<HTMLFormElement>("d-save");
const collection = $("d-collection");
const layoutSelect = $<HTMLSelectElement>("d-layout");

const STORE = "bench.boards";
const LAYOUT_STORE = "bench.detective.layout";

let boardId: BoardId = savedLayout() ?? "esp32";
let chip: ChipId | null = null;
let firmware = "";
let watched = new Set<string>();
/** Pins already low when the firmware started: held by the board, not by a jumper. */
let heldLow = new Set<string>();
let touched = new Set<string>();
let passport: Passport | null = null;
let greeted = false;
let quizTarget: string | null = null;
let quizScore = { right: 0, asked: 0 };

function savedLayout(): BoardId | null {
  try {
    const id = localStorage.getItem(LAYOUT_STORE);
    return id && [...layoutSelect.options].some((o) => o.value === id) ? (id as BoardId) : null;
  } catch {
    return null;
  }
}

/** Offer only the pinouts that fit the connected chip, and keep the choice if it still fits. */
function fitLayouts(connected: ChipId | null) {
  for (const option of layoutSelect.options) option.hidden = connected !== null && option.dataset.chip !== connected;
  const fits = (id: string) => connected === null || layoutSelect.querySelector<HTMLOptionElement>(`option[value="${id}"]`)?.dataset.chip === connected;
  if (!fits(boardId)) {
    const preferred = savedLayout();
    const first = [...layoutSelect.options].find((o) => !o.hidden);
    boardId = (preferred && fits(preferred) ? preferred : (first?.value ?? "esp32")) as BoardId;
  }
  layoutSelect.value = boardId;
}

const gpioName = (pad: string) => (/^\d+$/.test(pad) ? `GPIO ${pad}` : pad);

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** "5th pad down on the right", counting from the end away from the USB connector. */
function whereIs(board: Board, pin: string): string {
  // English counts "5th"; the other languages put the number in their own phrase.
  const ordinal = (n: number) => (locale === "en" ? `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : Math.min(n % 10, 4) % 4]}` : String(n));
  const left = board.left.indexOf(pin);
  if (left >= 0) return t("whereLeft", { n: ordinal(left + 1) });
  const right = board.right.indexOf(pin);
  return right >= 0 ? t("whereRight", { n: ordinal(right + 1) }) : t("whereNone");
}

function renderBoard() {
  const b = boardById(boardId);
  const grid = el("div", "board");
  const pcb = el("div", "pcb");
  pcb.style.gridRow = `1 / span ${b.left.length}`;
  pcb.append(el("div", "can"), el("div", "silk", b.short), el("div", "usb"));
  grid.append(pcb);
  const pad = (label: string, side: "l" | "r", row: number) => {
    const node = el("div", `pinrow ${side}`);
    node.style.gridColumn = side === "l" ? "1" : "3";
    node.style.gridRow = String(row);
    if (touched.has(label)) node.classList.add("on");
    else if (heldLow.has(label)) node.classList.add("held");
    else if (watched.size > 0 && !watched.has(label)) node.classList.add("blind");
    const silk = b.silk?.[label];
    const text = el("span", "", silk ? (side === "l" ? `${silk} · ${label}` : `${label} · ${silk}`) : label);
    const hole = el("i");
    node.append(...(side === "l" ? [text, hole] : [hole, text]));
    return node;
  };
  b.left.forEach((label, i) => grid.append(pad(label, "l", i + 1), pad(b.right[i], "r", i + 1)));
  grid.setAttribute("role", "img");
  grid.setAttribute("aria-label", touched.size > 0 ? t("ariaTouched", { board: b.name, list: [...touched].map(gpioName).join(", ") }) : t("ariaNone", { board: b.name }));
  boardBox.replaceChildren(grid);
}

function renderPassport() {
  saveForm.hidden = passport === null;
  if (!passport) {
    passportBox.replaceChildren(el("p", "lede", t("passportEmpty")));
    return;
  }
  const rows: [string, string][] = [
    [t("rowChip"), t("chipRev", { chip: passport.chip, rev: passport.revision })],
    [t("rowCores"), t("coresAt", { cores: passport.cores, mhz: passport.mhz })],
    [t("rowFlash"), size(passport.flash)],
    [t("rowPsram"), size(passport.psram)],
    [t("rowMac"), passport.mac],
    [t("rowSdk"), passport.sdk],
    [t("rowPinout"), boardById(passport.board).name],
  ];
  const table = el("table");
  const body = el("tbody");
  for (const [k, v] of rows) {
    const tr = el("tr");
    tr.append(el("td", "", k), el("td", "m", v));
    body.append(tr);
  }
  table.append(body);
  passportBox.replaceChildren(table);
}

function loadCollection(): SavedBoard[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORE) ?? "[]");
    return Array.isArray(parsed) ? (parsed as SavedBoard[]) : [];
  } catch {
    return [];
  }
}
function saveCollection(boards: SavedBoard[]) {
  try {
    localStorage.setItem(STORE, JSON.stringify(boards));
  } catch {
    // Without storage the collection lasts for this page view only.
  }
}
function renderCollection() {
  const boards = loadCollection();
  if (boards.length === 0) {
    collection.replaceChildren(el("p", "lede", t("noBoards")));
    return;
  }
  collection.replaceChildren(
    ...boards.map((b) => {
      const card = el("div", "passport");
      const head = el("div", "codehead");
      head.append(el("span", "name", b.name));
      const remove = el("button", "btn sm", t("remove"));
      remove.type = "button";
      remove.setAttribute("aria-label", t("removeAria", { name: b.name }));
      remove.addEventListener("click", () => {
        saveCollection(loadCollection().filter((x) => x.mac !== b.mac));
        renderCollection();
      });
      head.append(remove);
      card.append(
        head,
        el("span", "plotlabel", t("savedSpecs", { chip: b.chip, rev: b.revision, flash: size(b.flash), psram: size(b.psram) })),
        el("span", "plotlabel", t("savedWhen", { mac: b.mac, date: new Date(b.savedAt).toLocaleDateString(HTML_LANG[locale]) })),
      );
      return card;
    }),
  );
}

function nextQuestion() {
  const b = boardById(boardId);
  const onBoard = [...watched].filter((pin) => (b.left.includes(pin) || b.right.includes(pin)) && !heldLow.has(pin));
  if (onBoard.length === 0) {
    quizTarget = null;
    quizText.textContent = t("connectFirst");
    return;
  }
  const pool = onBoard.filter((pin) => pin !== quizTarget);
  quizTarget = pool[Math.floor(Math.random() * pool.length)] ?? onBoard[0];
  quizText.textContent = t("quizAsk", { gpio: gpioName(quizTarget), right: quizScore.right, asked: quizScore.asked });
}

function onTouch(pin: string) {
  const b = boardById(boardId);
  const silk = b.silk?.[pin];
  readout.textContent = t("readout", { gpio: gpioName(pin), where: whereIs(b, pin), label: silk ? t("labelSilk", { silk }) : t("labelPinout", { pin }) });
  const item = el("li", "", `${new Date().toTimeString().slice(0, 8)}  ${gpioName(pin)}`);
  history.prepend(item);
  while (history.childElementCount > 8) history.lastElementChild?.remove();

  if (quizTarget !== null) {
    quizScore.asked += 1;
    const right = pin === quizTarget;
    if (right) quizScore.right += 1;
    const verdict = right ? t("quizRight", { gpio: gpioName(pin) }) : t("quizWrong", { gpio: gpioName(pin), target: gpioName(quizTarget) });
    nextQuestion();
    quizText.textContent = `${verdict} ${quizText.textContent}`;
  }
}

const session = new SerialSession({
  onLine(line) {
    const event = parseLine(line);
    if (!event) return;
    if (event.type === "hello") {
      greeted = true;
      chip = event.chip;
      fitLayouts(chip);
      firmware = event.firmware;
      touched = new Set();
      if (passport) passport = { ...passport, board: boardId };
      status.textContent = t("hello", { board: boardById(boardId).name, firmware });
    } else if (event.type === "id") {
      passport = toPassport(boardId, firmware, event.fields);
      renderPassport();
    } else if (event.type === "pins") {
      watched = new Set(event.pins);
    } else if (event.type === "low") {
      heldLow = new Set(event.pins);
    } else if (event.type === "change") {
      if (event.low) {
        touched.add(event.pin);
        heldLow.delete(event.pin);
        onTouch(event.pin);
      } else {
        touched.delete(event.pin);
      }
    }
    renderBoard();
  },
  onClose(lost) {
    chip = null;
    fitLayouts(null);
    connectBtn.textContent = t("connect");
    connectBtn.classList.add("go");
    touched = new Set();
    quizTarget = null;
    quizBtn.textContent = t("quizMe");
    status.textContent = lost ? t("boardDisconnected") : t("disconnected");
    renderBoard();
  },
});

connectBtn.addEventListener("click", async () => {
  if (session.connected) {
    await session.close();
    return;
  }
  greeted = false;
  status.textContent = t("pickPort");
  const result = await session.open(115200);
  if (result === "cancelled") {
    status.textContent = t("noPort");
    return;
  }
  if (result !== "ok") {
    status.textContent = serialMessage(result, locale);
    return;
  }
  connectBtn.textContent = t("disconnect");
  connectBtn.classList.remove("go");
  status.textContent = t("waiting");
  // The firmware prints its identity at boot. Ask again in case the board did
  // not reset when the port opened.
  for (const wait of [1500, 2500, 4000]) {
    await new Promise((r) => setTimeout(r, wait));
    if (greeted || !session.connected) break;
    await session.write("PD?\n");
  }
  await new Promise((r) => setTimeout(r, 1500));
  if (!greeted && session.connected) {
    status.textContent = t("notRunning");
  }
});

layoutSelect.addEventListener("change", () => {
  boardId = layoutSelect.value as BoardId;
  try {
    localStorage.setItem(LAYOUT_STORE, boardId);
  } catch {
    // The choice lasts for this page view only.
  }
  touched = new Set();
  if (passport) {
    passport = { ...passport, board: boardId };
    renderPassport();
  }
  if (quizTarget !== null) nextQuestion();
  renderBoard();
});

quizBtn.addEventListener("click", () => {
  if (quizTarget !== null) {
    quizTarget = null;
    quizBtn.textContent = t("quizMe");
    quizText.textContent = t("finalScore", { right: quizScore.right, asked: quizScore.asked });
    return;
  }
  quizScore = { right: 0, asked: 0 };
  nextQuestion();
  if (quizTarget !== null) quizBtn.textContent = t("stopQuiz");
});

saveForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!passport) return;
  const input = $<HTMLInputElement>("d-name");
  const name = input.value.trim() || `${passport.chip} ${passport.mac.slice(-5)}`;
  // One entry per board: the MAC address identifies it.
  const others = loadCollection().filter((b) => b.mac !== passport!.mac);
  saveCollection([...others, { ...passport, name, savedAt: new Date().toISOString() }]);
  input.value = "";
  renderCollection();
});

if (!getSerial()) {
  connectBtn.disabled = true;
  status.textContent = t("noSerial");
}
fitLayouts(null);
renderBoard();
renderPassport();
renderCollection();
