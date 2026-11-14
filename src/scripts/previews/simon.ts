// Simon, playable with the sketch's rules: a growing random sequence, the classic
// tones, steps of max(150, 450 - length * 15) ms, 4 s to press each button, and a
// best score kept (in this browser, as the board keeps it in flash).
import { SIMON_TONES, SimonGame, simonSpeed } from "../../lib/preview/logic";
import { el, sleep, store, stored, type Mount } from "../../lib/preview/runtime";
import { PREVIEWS } from "../../i18n/strings/previews";
import { pageLocale, translator } from "../../i18n/t";

const t = translator(PREVIEWS, pageLocale());

const COLORS = [
  { name: t("simonGreen"), on: "#3ddc6e", off: "#14532a" },
  { name: t("simonRed"), on: "#ff5a4a", off: "#5c1a14" },
  { name: t("simonYellow"), on: "#ffd84a", off: "#5c4a12" },
  { name: t("simonBlue"), on: "#4aa8ff", off: "#123a5c" },
];

export const mount: Mount = ({ host, say, sound }) => {
  const game = new SimonGame(Math.random, stored("simonBest"));
  let state: "idle" | "showing" | "input" = "idle";
  let timer = 0;

  const pads = COLORS.map((c, i) => {
    const b = el("button", { type: "button", class: "simonpad", "aria-label": t("simonPadAria", { colour: c.name, n: i + 1 }) });
    b.style.background = c.off;
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      void press(i);
    });
    b.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        void press(i);
      }
    });
    return b;
  });
  const board = el("div", { class: "simonboard", role: "group", "aria-label": t("simonGroup") }, ...pads);
  const scoreText = el("span", { class: "readout", text: t("simonBest", { best: game.best }) });

  const light = async (i: number, ms: number) => {
    pads[i].style.background = COLORS[i].on;
    pads[i].classList.add("lit");
    sound.start(SIMON_TONES[i]);
    await sleep(ms);
    sound.stop();
    pads[i].style.background = COLORS[i].off;
    pads[i].classList.remove("lit");
  };

  const gameOver = async (why: string) => {
    window.clearTimeout(timer);
    state = "showing";
    sound.beep(110, 800);
    for (let k = 0; k < 3; k++) {
      pads.forEach((p, i) => (p.style.background = COLORS[i].on));
      await sleep(150);
      pads.forEach((p, i) => (p.style.background = COLORS[i].off));
      await sleep(150);
    }
    const score = game.end();
    store("simonBest", game.best);
    scoreText.textContent = t("simonScore", { score, best: game.best });
    say(t("simonOver", { why, score, best: game.best }));
    state = "idle";
  };

  const armTimeout = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void gameOver(t("simonTooSlow")), 4000);
  };

  const round = async () => {
    state = "showing";
    const seq = game.nextRound();
    say(t("simonWatch", { n: seq.length }));
    const speed = simonSpeed(seq.length);
    for (const step of seq) {
      await light(step, speed);
      await sleep(speed / 2);
    }
    state = "input";
    say(t("simonYourTurn", { n: seq.length }));
    armTimeout();
  };

  const press = async (i: number) => {
    sound.unlock();
    if (state === "showing") return;
    if (state === "idle") {
      await light(i, 120);
      await sleep(600);
      return round();
    }
    window.clearTimeout(timer);
    const result = game.press(i);
    void light(i, 180);
    if (result === "wrong") return gameOver(t("simonWrong"));
    if (result === "round") {
      state = "showing";
      scoreText.textContent = t("simonScore", { score: game.sequence.length, best: game.best });
      await sleep(700);
      return round();
    }
    armTimeout();
  };

  host.addEventListener("keydown", (e) => {
    const n = Number(e.key);
    if (n >= 1 && n <= 4) {
      e.preventDefault();
      void press(n - 1);
    }
  });
  host.append(board, el("div", { class: "tryrow" }, scoreText));
  say(t("simonStart"));
  return () => window.clearTimeout(timer);
};
