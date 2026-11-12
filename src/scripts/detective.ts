// Detective page: lights up the pad being touched to ground, quizzes you on
// the silkscreen, and keeps a passport for each board you plug in.
import { boardById, type Board, type BoardId } from "../data/boards";
import { megabytes, parseLine, toPassport, type Passport } from "../lib/detective";
import { SerialSession, getSerial } from "../lib/serial";

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

const STORE = "bench.boards";

let boardId: BoardId = "esp32";
let firmware = "";
let watched = new Set<string>();
/** Pins already low when the firmware started: held by the board, not by a jumper. */
let heldLow = new Set<string>();
let touched = new Set<string>();
let passport: Passport | null = null;
let greeted = false;
let quizTarget: string | null = null;
let quizScore = { right: 0, asked: 0 };

const gpioName = (pad: string) => (/^\d+$/.test(pad) ? `GPIO ${pad}` : pad);

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** "5th pad down on the right", counting from the end away from the USB connector. */
function whereIs(board: Board, pin: string): string {
  const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : Math.min(n % 10, 4) % 4]}`;
  const left = board.left.indexOf(pin);
  if (left >= 0) return `${ordinal(left + 1)} pad down on the left`;
  const right = board.right.indexOf(pin);
  return right >= 0 ? `${ordinal(right + 1)} pad down on the right` : "not on this board's headers";
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
    const text = el("span", "", label);
    const hole = el("i");
    node.append(...(side === "l" ? [text, hole] : [hole, text]));
    return node;
  };
  b.left.forEach((label, i) => grid.append(pad(label, "l", i + 1), pad(b.right[i], "r", i + 1)));
  grid.setAttribute("role", "img");
  grid.setAttribute("aria-label", `${b.name}. ${touched.size > 0 ? `Touched: ${[...touched].map(gpioName).join(", ")}` : "No pad touched"}`);
  boardBox.replaceChildren(grid);
}

function renderPassport() {
  saveForm.hidden = passport === null;
  if (!passport) {
    passportBox.replaceChildren(el("p", "lede", "Connect a board running the pin detective to read its passport."));
    return;
  }
  const rows: [string, string][] = [
    ["Chip", `${passport.chip}, revision ${passport.revision}`],
    ["Cores", `${passport.cores} at ${passport.mhz} MHz`],
    ["Flash", megabytes(passport.flash)],
    ["PSRAM", megabytes(passport.psram)],
    ["MAC address", passport.mac],
    ["SDK", passport.sdk],
    ["Pinout shown", boardById(passport.board).name],
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
    collection.replaceChildren(el("p", "lede", "No boards saved yet. They are kept in this browser only."));
    return;
  }
  collection.replaceChildren(
    ...boards.map((b) => {
      const card = el("div", "passport");
      const head = el("div", "codehead");
      head.append(el("span", "name", b.name));
      const remove = el("button", "btn sm", "Remove");
      remove.type = "button";
      remove.setAttribute("aria-label", `Remove ${b.name}`);
      remove.addEventListener("click", () => {
        saveCollection(loadCollection().filter((x) => x.mac !== b.mac));
        renderCollection();
      });
      head.append(remove);
      card.append(
        head,
        el("span", "plotlabel", `${b.chip} rev ${b.revision} · ${megabytes(b.flash)} flash · PSRAM ${megabytes(b.psram)}`),
        el("span", "plotlabel", `${b.mac} · added ${new Date(b.savedAt).toLocaleDateString()}`),
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
    quizText.textContent = "Connect a board first.";
    return;
  }
  const pool = onBoard.filter((pin) => pin !== quizTarget);
  quizTarget = pool[Math.floor(Math.random() * pool.length)] ?? onBoard[0];
  quizText.textContent = `Touch the pad you think is ${gpioName(quizTarget)}. Score: ${quizScore.right} of ${quizScore.asked}.`;
}

function onTouch(pin: string) {
  const b = boardById(boardId);
  readout.textContent = `${gpioName(pin)} is low. It is the ${whereIs(b, pin)}, labelled ${pin} on this pinout.`;
  const item = el("li", "", `${new Date().toTimeString().slice(0, 8)}  ${gpioName(pin)}`);
  history.prepend(item);
  while (history.childElementCount > 8) history.lastElementChild?.remove();

  if (quizTarget !== null) {
    quizScore.asked += 1;
    const right = pin === quizTarget;
    if (right) quizScore.right += 1;
    const verdict = right ? `Yes, that is ${gpioName(pin)}.` : `That pad is ${gpioName(pin)}, not ${gpioName(quizTarget)}.`;
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
      boardId = event.board;
      firmware = event.firmware;
      touched = new Set();
      status.textContent = `Connected: ${boardById(boardId).name}, pin detective ${firmware}. Touch a jumper from GND to any pad.`;
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
    connectBtn.textContent = "Connect board";
    connectBtn.classList.add("go");
    touched = new Set();
    quizTarget = null;
    quizBtn.textContent = "Quiz me";
    status.textContent = lost ? "Board disconnected." : "Disconnected.";
    renderBoard();
  },
});

connectBtn.addEventListener("click", async () => {
  if (session.connected) {
    await session.close();
    return;
  }
  greeted = false;
  status.textContent = "Pick the board's port in the browser prompt.";
  const result = await session.open(115200);
  if (result === "cancelled") {
    status.textContent = "No port was picked.";
    return;
  }
  if (result !== "ok") {
    status.textContent = result;
    return;
  }
  connectBtn.textContent = "Disconnect";
  connectBtn.classList.remove("go");
  status.textContent = "Connected. Waiting for the pin detective to answer.";
  // The firmware prints its identity at boot. Ask again in case the board did
  // not reset when the port opened.
  for (const wait of [1500, 2500, 4000]) {
    await new Promise((r) => setTimeout(r, wait));
    if (greeted || !session.connected) break;
    await session.write("PD?\n");
  }
  await new Promise((r) => setTimeout(r, 1500));
  if (!greeted && session.connected) {
    status.textContent = "The board is connected but is not running the pin detective. Flash it with the button above, then connect again.";
  }
});

quizBtn.addEventListener("click", () => {
  if (quizTarget !== null) {
    quizTarget = null;
    quizBtn.textContent = "Quiz me";
    quizText.textContent = `Final score: ${quizScore.right} of ${quizScore.asked}.`;
    return;
  }
  quizScore = { right: 0, asked: 0 };
  nextQuestion();
  if (quizTarget !== null) quizBtn.textContent = "Stop the quiz";
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
  status.textContent = "This browser has no Web Serial. Use Chrome or Edge on a desktop to connect a board.";
}
renderBoard();
renderPassport();
renderCollection();
