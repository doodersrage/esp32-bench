// Settings form: reset the board, wait for its settings block to answer, send
// the filled-in values, save, and let the board restart with them.
import type { Setting } from "../data/bench-settings";
import { SerialSession, getSerial } from "../lib/serial";
import {
  QUERY_LINE,
  SAVE_LINE,
  missingRequired,
  parseBoardLine,
  planSends,
  type BoardLine,
} from "../lib/settings-protocol";

const BAUD = 115200;
const BOOT_WAIT_MS = 10_000;
const REPLY_WAIT_MS = 4_000;

for (const root of document.querySelectorAll<HTMLElement>("[data-settings-form]")) {
  const form = root.querySelector<HTMLFormElement>("[data-form]");
  const status = root.querySelector<HTMLElement>("[data-status]");
  const log = root.querySelector<HTMLElement>("[data-log]");
  const button = root.querySelector<HTMLButtonElement>("[data-send]");
  const after = root.querySelector<HTMLElement>("[data-after]");
  if (!form || !status || !log || !button || !after) continue;
  const settings = JSON.parse(root.dataset.settings ?? "[]") as Setting[];

  if (!getSerial()) {
    button.disabled = true;
    status.textContent = window.isSecureContext
      ? "This browser has no Web Serial. Use Chrome or Edge on a desktop."
      : "Sending settings needs a secure page. Open this site over https or from http://localhost.";
    continue;
  }

  const say = (text: string) => {
    status.textContent = text;
  };
  const note = (text: string) => {
    log.hidden = false;
    log.textContent += `${text}\n`;
  };
  const markStored = (stored: Record<string, boolean>) => {
    for (const s of settings) {
      const hint = root.querySelector<HTMLElement>(`[data-hint="${s.key}"]`);
      if (!hint || !(s.key in stored)) continue;
      hint.classList.toggle("stored", stored[s.key]);
      hint.textContent = stored[s.key] ? `Stored on the board. ${s.hint ?? ""}`.trim() : s.hint ?? "";
    }
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values: Record<string, string> = {};
    for (const s of settings) values[s.key] = (form.elements.namedItem(s.key) as HTMLInputElement | null)?.value ?? "";
    const plan = planSends(settings, values);
    const bad = plan.find((p) => !p.ok);
    if (bad && !bad.ok) {
      say(bad.error);
      return;
    }

    button.disabled = true;
    after.hidden = true;
    log.hidden = true;
    log.textContent = "";

    // Lines from the board are handed to whoever is waiting for one.
    let waiter: ((line: BoardLine) => void) | null = null;
    let stored: Record<string, boolean> = {};
    const session = new SerialSession({
      onLine(raw) {
        const parsed = parseBoardLine(raw);
        if (!parsed) return;
        if (parsed.type === "settings") {
          stored = parsed.stored;
          markStored(stored);
        }
        waiter?.(parsed);
      },
      onClose(lost) {
        if (lost) say("The board went away. Check the cable and try again.");
      },
    });
    const waitFor = (wanted: (l: BoardLine) => boolean, ms: number) =>
      new Promise<BoardLine | null>((resolve) => {
        const timer = setTimeout(() => {
          waiter = null;
          resolve(null);
        }, ms);
        waiter = (line) => {
          if (!wanted(line)) return;
          clearTimeout(timer);
          waiter = null;
          resolve(line);
        };
      });

    try {
      say("Pick the board's port in the browser prompt.");
      const opened = await session.open(BAUD);
      if (opened === "cancelled") {
        say("No port was picked.");
        return;
      }
      if (opened !== "ok") {
        say(opened);
        return;
      }

      say("Restarting the board.");
      const resetProblem = await session.reset();
      if (resetProblem) note(`Reset: ${resetProblem}. Press the board's EN button now.`);
      const ready = await waitFor((l) => l.type === "waiting" || l.type === "settings", BOOT_WAIT_MS);
      if (!ready) {
        say("The board did not answer. Is it running this project's sketch, and is no other serial monitor using the port?");
        return;
      }

      // Ask which keys the sketch knows, so a typo in the data shows up here.
      // The waiter is armed before the write: a board can answer within a millisecond.
      const reportWait = waitFor((l) => l.type === "settings", REPLY_WAIT_MS);
      await session.write(QUERY_LINE);
      const report = await reportWait;
      if (report?.type === "settings") {
        const unknown = settings.filter((s) => !(s.key in report.stored)).map((s) => s.key);
        if (unknown.length) note(`The board does not know: ${unknown.join(", ")}. Flash the current sketch first.`);
      }
      const missing = missingRequired(settings, values, stored);
      if (missing.length) {
        say(`Still needed: ${missing.map((s) => s.label).join(", ")}.`);
        return;
      }

      let sent = 0;
      for (const item of plan) {
        if (!item.ok) continue;
        const key = item.line.split("\t")[1];
        say(`Sending ${settings.find((s) => s.key === key)?.label ?? key}.`);
        const replyWait = waitFor((l) => (l.type === "ok" && l.key === key) || l.type === "err", REPLY_WAIT_MS);
        await session.write(item.line);
        const reply = await replyWait;
        if (!reply) {
          say(`No answer when sending ${key}. Try again.`);
          return;
        }
        if (reply.type === "err") {
          say(`The board refused ${key}: ${reply.message}.`);
          return;
        }
        note(`${key}: saved on the board`);
        sent++;
      }

      const savedWait = waitFor((l) => l.type === "saved", REPLY_WAIT_MS);
      await session.write(SAVE_LINE);
      const saved = await savedWait;
      if (!saved) {
        say(sent ? "The settings were stored, but the board did not confirm the restart. Press EN to restart it." : "The board did not answer the save.");
        return;
      }
      say(sent ? `${sent} ${sent === 1 ? "setting" : "settings"} sent. The board is restarting with them.` : "Nothing to send: all fields were empty. The board restarted.");
      for (const s of settings) if (s.kind === "password") (form.elements.namedItem(s.key) as HTMLInputElement | null)?.form?.reset();
      after.hidden = false;
    } catch (error) {
      say(`Could not talk to the board: ${error instanceof Error ? error.message : String(error)}.`);
    } finally {
      await session.close();
      button.disabled = false;
    }
  });
}
