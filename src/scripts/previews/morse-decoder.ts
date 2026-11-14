// Morse decoder, playable: hold the key (or the space bar) for dots and dashes.
// The decoder is the sketch's: it adapts to your speed, a 3-unit gap ends a letter
// and a 7-unit gap a word. The sidetone is the sketch's 650 Hz.
import { MorseDecoder } from "../../lib/preview/logic";
import { button, createLoop, el, type Mount } from "../../lib/preview/runtime";
import { PREVIEWS } from "../../i18n/strings/previews";
import { pageLocale, translator } from "../../i18n/t";

const t = translator(PREVIEWS, pageLocale());

export const mount: Mount = ({ host, say, sound }) => {
  let d = new MorseDecoder();
  const text = el("output", { class: "morsetext", "aria-label": t("morseAria") });
  const symbol = el("span", { class: "readout morsesym", text: " " });
  const speed = el("span", { class: "readout", text: t("morseSpeed", { n: 10 }) });
  const keyButton = el("button", { type: "button", class: "btn go morsekey", text: t("morseKey"), "aria-label": t("morseKeyAria") });

  const down = () => {
    sound.unlock();
    d.key(true, performance.now());
    sound.start(650, 0.04);
    keyButton.classList.add("down");
  };
  const up = () => {
    const mark = d.key(false, performance.now());
    sound.stop();
    keyButton.classList.remove("down");
    if (mark) symbol.textContent = d.symbol;
  };
  const show = () => {
    text.textContent = d.text || " ";
    speed.textContent = t("morseSpeed", { n: d.wpm });
  };

  keyButton.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    keyButton.setPointerCapture(e.pointerId);
    down();
  });
  keyButton.addEventListener("pointerup", up);
  keyButton.addEventListener("pointercancel", up);
  let spaceHeld = false;
  host.addEventListener("keydown", (e) => {
    if (e.key !== " " || e.repeat) {
      if (e.key === " ") e.preventDefault();
      return;
    }
    e.preventDefault();
    spaceHeld = true;
    down();
  });
  host.addEventListener("keyup", (e) => {
    if (e.key === " " && spaceHeld) {
      e.preventDefault();
      spaceHeld = false;
      up();
    }
  });

  const loop = createLoop(host, () => {
    const added = d.tick(performance.now());
    if (added) {
      symbol.textContent = " ";
      show();
      if (added === " ") say(t("morseSoFar", { text: d.text.trim() }));
    }
  }, 50);
  const clear = button(t("clear"), () => {
    d = new MorseDecoder();
    symbol.textContent = " ";
    show();
    say(t("cleared"));
  });
  host.append(text, el("div", { class: "tryrow" }, keyButton, symbol, speed, clear));
  show();
  loop.start();
  return () => {
    loop.dispose();
    sound.stop();
  };
};
