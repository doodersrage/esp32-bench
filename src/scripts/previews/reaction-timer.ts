// Reaction timer, playable: a random 1.5 to 5 s wait, the LED lights, press as fast
// as you can. False starts blink the LED, 3 s without a press is "too slow", and the
// best time is kept, all as in the sketch.
import { button, el, sleep, store, stored, type Mount } from "../../lib/preview/runtime";
import { PREVIEWS } from "../../i18n/strings/previews";
import { pageLocale, translator } from "../../i18n/t";

const t = translator(PREVIEWS, pageLocale());

export const mount: Mount = ({ host, say }) => {
  let best = stored("reactionBest");
  let phase: "stopped" | "waiting" | "lit" = "stopped";
  let litAt = 0;
  let run = 0; // invalidates old rounds when restarted
  let started = false; // the Start/Stop button's state

  const led = el("div", { class: "rled", role: "img", "aria-label": t("ledOff") });
  const setLed = (on: boolean) => {
    led.classList.toggle("on", on);
    led.setAttribute("aria-label", on ? t("ledOn") : t("ledOff"));
  };
  const result = el("span", { class: "readout", text: best ? t("reactBest", { ms: best }) : t("reactNoBest") });

  const round = async (id: number) => {
    while (id === run) {
      say("get ready...");
      phase = "waiting";
      await sleep(1500 + Math.random() * 3500);
      if (id !== run || phase !== "waiting") return;
      phase = "lit";
      setLed(true);
      litAt = performance.now();
      await sleep(3000);
      if (id !== run) return;
      if (phase === "lit") {
        setLed(false);
        say("too slow, try again");
        phase = "waiting";
        await sleep(1000);
      }
      if (id !== run) return;
      await sleep(0);
    }
  };

  let lastHit = 0;
  const hit = async () => {
    // One physical press can arrive as both a key and a click event; count it once.
    const now = performance.now();
    if (now - lastHit < 40) return;
    lastHit = now;
    if (phase === "stopped") return;
    if (phase === "waiting") {
      const id = ++run;
      phase = "stopped";
      say("false start! wait for the light");
      for (let i = 0; i < 6; i++) {
        setLed(i % 2 === 0);
        await sleep(80);
      }
      setLed(false);
      await sleep(1000);
      if (id === run) void round(id);
      return;
    }
    if (phase === "lit") {
      const ms = Math.round(performance.now() - litAt);
      phase = "waiting";
      setLed(false);
      let line = `reaction = ${ms} ms`;
      if (!best || ms < best) {
        best = ms;
        store("reactionBest", best);
        line += `, new best!`;
      }
      result.textContent = t("reactLast", { ms, best });
      say(line);
      const id = ++run;
      await sleep(1500);
      if (id === run) void round(id);
    }
  };

  // Presses count on pointerdown (fastest); the click handler below only serves the keyboard.
  const key = button("BOOT", () => {}, "btn go rbutton");
  key.setAttribute("aria-label", t("reactBootAria"));
  key.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    void hit();
  });
  // pointerdown already counted the press; ignore the click that follows it.
  key.onclick = (e) => {
    if ((e as PointerEvent).pointerType) return;
    void hit();
  };
  const startStop = button(t("start"), () => {
    if (phase === "stopped" && !started) {
      started = true;
      startStop.textContent = t("stop");
      void round(++run);
      key.focus();
    } else {
      run++;
      phase = "stopped";
      setLed(false);
      started = false;
      startStop.textContent = t("start");
      say(t("stopped"));
    }
  });
  host.addEventListener("keydown", (e) => {
    if (e.key === " " && e.target !== startStop) {
      e.preventDefault();
      void hit();
    }
  });
  host.append(el("div", { class: "rstage" }, led, key), el("div", { class: "tryrow" }, startStop, result));
  return () => {
    run++;
  };
};
