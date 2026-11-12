// Two-board mode for the bench: a second, simpler monitor next to the main one,
// for sender and receiver projects. It has its own port, baud rate and log.
import { explainLine } from "../lib/crash";
import { SerialSession, getSerial } from "../lib/serial";

const MAX_LINES = 1500;
const TROUBLE = /(Guru Meditation|Brownout detector|abort\(\)|Backtrace:|assert failed|wdt timeout|watchdog got triggered|CORRUPT HEAP|Stack smashing|fault\b)/i;

export function initSecondBoard() {
  const toggle = document.getElementById("second-toggle") as HTMLButtonElement | null;
  const pane = document.getElementById("second") as HTMLElement | null;
  const terms = document.getElementById("terms") as HTMLElement | null;
  if (!toggle || !pane || !terms) return;

  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const term = $("term2");
  const baud = $<HTMLSelectElement>("baud2");
  const connectBtn = $<HTMLButtonElement>("connect2");
  const resetBtn = $<HTMLButtonElement>("reset2");
  const tx = $<HTMLInputElement>("tx2");
  const sendBtn = $<HTMLButtonElement>("sendbtn2");
  const stamps = document.getElementById("stamps") as HTMLInputElement | null;
  const follow = document.getElementById("follow") as HTMLInputElement | null;
  const hinted = new Set<string>();

  function addLine(text: string, kind: "" | "sys" | "tx" = "") {
    const line = document.createElement("div");
    if (kind) line.className = kind;
    else if (TROUBLE.test(text)) line.className = "bad";
    if (stamps?.checked) {
      const ts = document.createElement("span");
      ts.className = "ts";
      ts.textContent = new Date().toTimeString().slice(0, 8);
      line.append(ts);
    }
    const body = document.createElement("span");
    body.className = "body";
    body.textContent = text === "" ? " " : text;
    line.append(body);
    term.append(line);
    while (term.childElementCount > MAX_LINES) term.firstElementChild?.remove();
    if (follow?.checked ?? true) term.scrollTop = term.scrollHeight;
    if (kind) return;
    const hint = explainLine(text);
    if (hint && !hinted.has(hint.key)) {
      hinted.add(hint.key);
      addLine(`Hint: ${hint.text}`, "sys");
    }
  }

  function setConnected(on: boolean) {
    connectBtn.textContent = on ? "Disconnect" : "Connect second board";
    connectBtn.classList.toggle("go", !on);
    resetBtn.disabled = !on;
    tx.disabled = !on;
    sendBtn.disabled = !on;
    baud.disabled = on;
  }

  const session = new SerialSession({
    onLine: (line) => addLine(line),
    onClose(lost) {
      setConnected(false);
      addLine(lost ? "Board disconnected." : "Disconnected.", "sys");
    },
  });

  toggle.addEventListener("click", async () => {
    const opening = pane.hidden === true;
    if (!opening && session.connected) await session.close();
    pane.hidden = !opening;
    terms.classList.toggle("two", opening);
    toggle.textContent = opening ? "Remove second board" : "Add a second board";
    toggle.setAttribute("aria-expanded", String(opening));
  });

  connectBtn.addEventListener("click", async () => {
    if (session.connected) {
      await session.close();
      return;
    }
    const result = await session.open(Number(baud.value));
    if (result === "cancelled") return;
    if (result !== "ok") {
      addLine(result, "sys");
      return;
    }
    hinted.clear();
    setConnected(true);
    addLine(`Connected at ${baud.value} baud. Pick a different port from the first board.`, "sys");
  });

  resetBtn.addEventListener("click", async () => {
    const error = await session.reset();
    addLine(error ? `Reset failed: ${error}. Press the EN button on the board instead.` : "Reset pulse sent on EN.", "sys");
  });

  $("clear2").addEventListener("click", () => term.replaceChildren());

  $<HTMLFormElement>("sendform2").addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = tx.value;
    tx.value = "";
    const error = await session.write(`${text}\n`);
    addLine(error ? `Send failed: ${error}` : `> ${text}`, error ? "sys" : "tx");
  });

  if (!getSerial()) connectBtn.disabled = true;
}
