// Serial monitor for the bench page. Runs in the browser only.
import { PROJECTS, boardsOf, forBoard } from "../data/projects";
import { explainLine, explainLog } from "../lib/crash";
import { feedPlotter, initPlotter, resetPlotter } from "./plotter";
import { feedRadar, initRadar, resetRadar } from "./radar";
import { markSeen } from "./progress";
import { initSecondBoard } from "./second-board";

// Minimal Web Serial types: the API is not in TypeScript's DOM library yet.
interface SerialPortLike extends EventTarget {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  setSignals(signals: { dataTerminalReady?: boolean; requestToSend?: boolean }): Promise<void>;
}
interface SerialLike extends EventTarget {
  requestPort(): Promise<SerialPortLike>;
}

const serial = (navigator as Navigator & { serial?: SerialLike }).serial;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const term = $("term");
const baud = $<HTMLSelectElement>("baud");
const connectBtn = $<HTMLButtonElement>("connect");
const resetBtn = $<HTMLButtonElement>("reset");
const tx = $<HTMLInputElement>("tx");
const sendBtn = $<HTMLButtonElement>("sendbtn");
const eol = $<HTMLSelectElement>("eol");
const stamps = $<HTMLInputElement>("stamps");
const follow = $<HTMLInputElement>("follow");
const sampleBtn = $<HTMLButtonElement>("sample");
const samplePick = $<HTMLSelectElement>("samplepick");
const sound = $<HTMLInputElement>("sound");
const dot = document.querySelector<HTMLElement>("#status .dot");

const MAX_LINES = 1500;
const LINE_ENDINGS: Record<string, string> = { lf: "\n", crlf: "\r\n", cr: "\r", none: "" };
const TROUBLE = /(Guru Meditation|Brownout detector|abort\(\)|Backtrace:|assert failed|read failed|not found|wdt timeout|watchdog got triggered|CORRUPT HEAP|Stack smashing|TT sensor problem|TT no probe|fault\b)/i;

// Hints print once per connection. The explanations live in src/lib/crash.ts.
const hintsShown = new Set<string>();

type LineKind = "" | "sys" | "tx";

let port: SerialPortLike | null = null;
let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
let keepReading = false;
let loopDone: Promise<void> | null = null;
let sampleTimer: ReturnType<typeof setInterval> | null = null;

function remember(key: string, value: string) {
  try {
    localStorage.setItem(`bench.${key}`, value);
  } catch {
    // Storage is a convenience only.
  }
}
function recall(key: string): string | null {
  try {
    return localStorage.getItem(`bench.${key}`);
  } catch {
    return null;
  }
}
function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function addLine(text: string, kind: LineKind = "") {
  const line = document.createElement("div");
  if (kind) line.className = kind;
  else if (TROUBLE.test(text)) line.className = "bad";
  if (stamps.checked) {
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
  if (follow.checked) term.scrollTop = term.scrollHeight;
  if (kind) return;

  // Everything below reacts to output from the board (or a sample).
  feedPlotter(text);
  feedRadar(text);
  blip(line.className === "bad");
  beat();
  if (port) {
    // Only a real board earns these; samples and pasted logs do not count.
    if (/Brownout detector/i.test(text)) markSeen("brownout");
    if (/Guru Meditation/.test(text)) markSeen("guru");
  }
  const hint = explainLine(text);
  if (hint && !hintsShown.has(hint.key)) {
    hintsShown.add(hint.key);
    addLine(`Hint: ${hint.text}`, "sys");
  }
}

// A short tick per line and a lower tone for trouble, when Sound is on.
let audio: AudioContext | null = null;
let lastBlip = 0;
function blip(trouble: boolean) {
  if (!sound.checked) return;
  const now = performance.now();
  if (now - lastBlip < 45) return;
  lastBlip = now;
  try {
    audio ??= new AudioContext();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    const length = trouble ? 0.16 : 0.025;
    osc.type = trouble ? "square" : "sine";
    osc.frequency.value = trouble ? 196 : 1175;
    gain.gain.setValueAtTime(trouble ? 0.05 : 0.03, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + length);
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + length);
  } catch {
    // Audio is a nicety; a browser that refuses it changes nothing else.
  }
}

// Pulse the status dot on each line, so the header shows the board's rhythm.
function beat() {
  if (!dot) return;
  dot.classList.remove("beat");
  void dot.offsetWidth; // restart the animation
  dot.classList.add("beat");
}

function setConnected(on: boolean) {
  connectBtn.textContent = on ? "Disconnect" : "Connect board";
  connectBtn.classList.toggle("go", !on);
  resetBtn.disabled = !on;
  tx.disabled = !on;
  sendBtn.disabled = !on;
  baud.disabled = on;
  $("status").classList.toggle("live", on);
  $("status-text").textContent = on ? `Connected, ${baud.value} baud` : "No board";
}

async function readLoop() {
  const decoder = new TextDecoder();
  let buffer = "";
  let idle: ReturnType<typeof setTimeout> | undefined;
  // Show a partial line once the board has been quiet for a moment,
  // so progress dots and prompts without a newline still appear.
  const flush = () => {
    if (buffer) {
      addLine(buffer.replace(/\r$/, ""));
      buffer = "";
    }
  };

  while (keepReading && port?.readable) {
    reader = port.readable.getReader();
    let ended = false;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) {
          ended = true;
          break;
        }
        clearTimeout(idle);
        buffer += decoder.decode(value, { stream: true });
        let i: number;
        while ((i = buffer.indexOf("\n")) >= 0) {
          addLine(buffer.slice(0, i).replace(/\r$/, ""));
          buffer = buffer.slice(i + 1);
        }
        idle = setTimeout(flush, 300);
      }
    } catch (e) {
      addLine(`Read error: ${message(e)}. Wrong baud rate or a loose cable are the usual causes.`, "sys");
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // Already released.
      }
      reader = null;
    }
    if (ended) break;
  }
  clearTimeout(idle);
  flush();
}

async function connect() {
  if (!serial) return;
  stopSample();
  let picked: SerialPortLike;
  try {
    picked = await serial.requestPort();
  } catch (e) {
    const name = e instanceof DOMException ? e.name : "";
    if (name === "NotFoundError") return; // The picker was closed without a choice.
    addLine(
      name === "SecurityError"
        ? "This page is not allowed to use serial ports. Open it from https or http://localhost."
        : `Could not open the port picker: ${message(e)}`,
      "sys",
    );
    return;
  }
  const baudRate = Number(baud.value);
  try {
    await picked.open({ baudRate });
  } catch (e) {
    addLine(`Could not open the port: ${message(e)}. Close any other serial monitor that is using it.`, "sys");
    return;
  }
  port = picked;
  remember("baud", String(baudRate));
  keepReading = true;
  hintsShown.clear();
  resetPlotter();
  resetRadar();
  setConnected(true);
  addLine(`Connected at ${baudRate} baud.`, "sys");
  loopDone = readLoop().then(() => {
    if (keepReading) void disconnect(true);
  });
}

async function disconnect(lost: boolean) {
  if (!port) return;
  const closing = port;
  port = null;
  keepReading = false;
  try {
    await reader?.cancel();
  } catch {
    // The stream may already be closed.
  }
  if (!lost) {
    try {
      await loopDone;
    } catch {
      // Nothing to do.
    }
  }
  try {
    await closing.close();
  } catch {
    // An unplugged board cannot be closed cleanly.
  }
  setConnected(false);
  addLine(lost ? "Board disconnected." : "Disconnected.", "sys");
}

async function resetBoard() {
  if (!port) return;
  try {
    // On the usual auto-reset circuit, asserting RTS pulls EN low.
    await port.setSignals({ dataTerminalReady: false, requestToSend: true });
    await new Promise((r) => setTimeout(r, 120));
    await port.setSignals({ dataTerminalReady: false, requestToSend: false });
    addLine("Reset pulse sent on EN.", "sys");
  } catch (e) {
    addLine(`Reset failed: ${message(e)}. Press the EN button on the board instead.`, "sys");
  }
}

async function sendLine(text: string) {
  if (!port?.writable) return;
  const writer = port.writable.getWriter();
  try {
    await writer.write(new TextEncoder().encode(text + (LINE_ENDINGS[eol.value] ?? "\n")));
    addLine(`> ${text}`, "tx");
  } catch (e) {
    addLine(`Send failed: ${message(e)}`, "sys");
  } finally {
    writer.releaseLock();
  }
}

function stopSample() {
  if (sampleTimer) {
    clearInterval(sampleTimer);
    sampleTimer = null;
    sampleBtn.textContent = "Play sample output";
  }
}

function playSample() {
  if (sampleTimer) {
    stopSample();
    return;
  }
  if (port) {
    addLine("Disconnect the board before playing sample output.", "sys");
    return;
  }
  const project = PROJECTS.find((p) => p.id === samplePick.value) ?? PROJECTS[0];
  const lines = forBoard(project, boardsOf(project)[0]).sample;
  let i = 0;
  hintsShown.clear();
  resetPlotter();
  resetRadar();
  addLine(`Sample output for ${project.name}. This is recorded text, not a board.`, "sys");
  sampleBtn.textContent = "Stop sample";
  sampleTimer = setInterval(() => {
    if (i >= lines.length) {
      stopSample();
      addLine("End of sample.", "sys");
      return;
    }
    addLine(lines[i++]);
  }, 450);
}

function init() {
  // A project page can hand over its baud rate and sample: /bench/?baud=115200&sample=dht22
  const params = new URLSearchParams(location.search);
  const wantedBaud = params.get("baud") ?? recall("baud");
  if (wantedBaud && [...baud.options].some((o) => o.value === wantedBaud)) baud.value = wantedBaud;
  const wantedSample = params.get("sample");
  if (wantedSample && PROJECTS.some((p) => p.id === wantedSample)) samplePick.value = wantedSample;

  if (!serial) {
    $("support").hidden = false;
    connectBtn.disabled = true;
  } else {
    serial.addEventListener("disconnect", (e) => {
      if (port && e.target === port) void disconnect(true);
    });
  }

  connectBtn.addEventListener("click", () => void (port ? disconnect(false) : connect()));
  resetBtn.addEventListener("click", () => void resetBoard());
  $("clear").addEventListener("click", () => {
    term.replaceChildren();
    resetPlotter();
    resetRadar();
  });

  initPlotter($("plots"), $("plots-empty"));
  initSecondBoard();
  initRadar($("radar"));

  // Crash translator: explain a pasted log without a board attached.
  $("crashgo").addEventListener("click", () => {
    const found = explainLog($<HTMLTextAreaElement>("crashlog").value);
    const out = $("crashout");
    out.replaceChildren(
      ...(found.length > 0 ? found.map((e) => e.text) : ["Nothing recognised. Paste the lines around the reset or the Guru Meditation message."]).map((text) => {
        const li = document.createElement("li");
        li.textContent = text;
        return li;
      }),
    );
  });
  $("copylog").addEventListener("click", async () => {
    const btn = $<HTMLButtonElement>("copylog");
    const label = btn.textContent;
    const text = [...term.querySelectorAll(".body")].map((el) => el.textContent ?? "").join("\n");
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = "Copied";
    } catch {
      btn.textContent = "Copy blocked";
    }
    setTimeout(() => {
      btn.textContent = label;
    }, 1600);
  });
  sampleBtn.addEventListener("click", playSample);
  $<HTMLFormElement>("sendform").addEventListener("submit", (e) => {
    e.preventDefault();
    if (tx.value || eol.value !== "none") {
      void sendLine(tx.value);
      tx.value = "";
    }
  });

  addLine("Bench ready. Connect a board, or play sample output to see how a project should look.", "sys");
}

init();
