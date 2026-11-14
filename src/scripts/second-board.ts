// Two-board mode for the bench: a second, simpler monitor next to the main one,
// for sender and receiver projects. It has its own port, baud rate and log.
import { explainLine } from "../lib/crash";
import { SerialSession, getSerial } from "../lib/serial";
import { pageLocale, translator } from "../i18n/t";
import { BENCH, crashHint, serialMessage } from "../i18n/strings/bench";

const t = translator(BENCH, pageLocale());

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
      addLine(t("hint", { text: crashHint(hint, pageLocale()) }), "sys");
    }
  }

  function setConnected(on: boolean) {
    connectBtn.textContent = on ? t("disconnect") : t("connectSecond");
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
      addLine(lost ? t("boardDisconnected") : t("disconnected"), "sys");
    },
  });

  toggle.addEventListener("click", async () => {
    const opening = pane.hidden === true;
    if (!opening && session.connected) await session.close();
    pane.hidden = !opening;
    terms.classList.toggle("two", opening);
    toggle.textContent = opening ? t("removeSecond") : t("addSecond");
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
      addLine(serialMessage(result, pageLocale()), "sys");
      return;
    }
    hinted.clear();
    setConnected(true);
    addLine(t("connectedAt2", { baud: baud.value }), "sys");
  });

  resetBtn.addEventListener("click", async () => {
    const error = await session.reset();
    addLine(error ? t("resetFailed", { error: serialMessage(error, pageLocale()) }) : t("resetSent"), "sys");
  });

  $("clear2").addEventListener("click", () => term.replaceChildren());

  $<HTMLFormElement>("sendform2").addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = tx.value;
    tx.value = "";
    const error = await session.write(`${text}\n`);
    addLine(error ? t("sendFailed", { error: serialMessage(error, pageLocale()) }) : `> ${text}`, error ? "sys" : "tx");
  });

  if (!getSerial()) connectBtn.disabled = true;
}
