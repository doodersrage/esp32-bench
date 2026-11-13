// Simon, playable with the sketch's rules: a growing random sequence, the classic
// tones, steps of max(150, 450 - length * 15) ms, 4 s to press each button, and a
// best score kept (in this browser, as the board keeps it in flash).
import { SIMON_TONES, SimonGame, simonSpeed } from "../../lib/preview/logic";
import { el, sleep, store, stored, type Mount } from "../../lib/preview/runtime";

const COLORS = [
  { name: "green", on: "#3ddc6e", off: "#14532a" },
  { name: "red", on: "#ff5a4a", off: "#5c1a14" },
  { name: "yellow", on: "#ffd84a", off: "#5c4a12" },
  { name: "blue", on: "#4aa8ff", off: "#123a5c" },
];

export const mount: Mount = ({ host, say, sound }) => {
  const game = new SimonGame(Math.random, stored("simonBest"));
  let state: "idle" | "showing" | "input" = "idle";
  let timer = 0;

  const pads = COLORS.map((c, i) => {
    const b = el("button", { type: "button", class: "simonpad", "aria-label": `${c.name} (key ${i + 1})` });
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
  const board = el("div", { class: "simonboard", role: "group", "aria-label": "Simon buttons" }, ...pads);
  const scoreText = el("span", { class: "readout", text: `Best: ${game.best}` });

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
    scoreText.textContent = `Score: ${score}. Best: ${game.best}`;
    say(`${why} Game over: score ${score}, best ${game.best}. Press any button to start again.`);
    state = "idle";
  };

  const armTimeout = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void gameOver("Too slow!"), 4000);
  };

  const round = async () => {
    state = "showing";
    const seq = game.nextRound();
    say(`Round ${seq.length}. Watch.`);
    const speed = simonSpeed(seq.length);
    for (const step of seq) {
      await light(step, speed);
      await sleep(speed / 2);
    }
    state = "input";
    say(`Round ${seq.length}. Your turn.`);
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
    if (result === "wrong") return gameOver("Wrong button!");
    if (result === "round") {
      state = "showing";
      scoreText.textContent = `Score: ${game.sequence.length}. Best: ${game.best}`;
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
  say("Press any coloured button to start.");
  return () => window.clearTimeout(timer);
};
