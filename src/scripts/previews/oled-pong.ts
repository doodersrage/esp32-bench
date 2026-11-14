// OLED Pong, playable: your pointer, finger or arrow keys are the left knob, and the
// right paddle is the sketch's computer player (TWO_PLAYERS = false). The physics
// are the sketch's, one step per frame at about 60 frames a second.
import { PONG, pongServe, pongStep, type PongState } from "../../lib/preview/logic";
import { el, createLoop, oledCanvas, playPause, type Mount } from "../../lib/preview/runtime";
import { Framebuffer } from "../../lib/preview/oled";
import { PREVIEWS } from "../../i18n/strings/previews";
import { pageLocale, translator } from "../../i18n/t";

const t = translator(PREVIEWS, pageLocale());

export const mount: Mount = ({ host, say }) => {
  const { W, H, PADDLE_H, PADDLE_W, WIN } = PONG;
  const screen = oledCanvas(t("pongAria"));
  const { fb, canvas } = screen;
  canvas.tabIndex = 0;
  const rand = Math.random;
  const s: PongState = { ballX: 0, ballY: 0, velX: 0, velY: 0, leftY: 25, rightY: 25, scoreLeft: 0, scoreRight: 0 };
  pongServe(s, 1, rand);
  let target = 25;
  let pauseUntil = 0;
  let banner = "";
  const keys = new Set<string>();

  const render = () => {
    fb.clear();
    if (banner) {
      fb.textSize = 2;
      fb.setCursor(Math.max(0, Math.floor((W - Framebuffer.textWidth(banner, 2)) / 2)), 24);
      fb.print(banner);
      screen.draw();
      return;
    }
    for (let y = 0; y < H; y += 6) fb.vline(W / 2, y, 3);
    fb.fillRect(1, Math.floor(s.leftY), PADDLE_W, PADDLE_H);
    fb.fillRect(W - 1 - PADDLE_W, Math.floor(s.rightY), PADDLE_W, PADDLE_H);
    fb.fillRect(Math.floor(s.ballX), Math.floor(s.ballY), 2, 2);
    fb.textSize = 1;
    fb.setCursor(W / 2 - 18, 0);
    fb.print(s.scoreLeft);
    fb.setCursor(W / 2 + 13, 0);
    fb.print(s.scoreRight);
    screen.draw();
  };

  const loop = createLoop(host, (_dt, now) => {
    if (keys.has("ArrowUp")) target -= 2;
    if (keys.has("ArrowDown")) target += 2;
    target = Math.max(0, Math.min(H - PADDLE_H, target));
    s.leftY += (target - s.leftY) * 0.5; // the sketch's knob smoothing
    if (now < pauseUntil) return render();
    banner = "";
    const point = pongStep(s, rand);
    if (point) {
      say(t(point === "left" ? "pongPointYou" : "pongPointComputer", { l: s.scoreLeft, r: s.scoreRight }));
      pauseUntil = now + 500;
      if (s.scoreLeft === WIN || s.scoreRight === WIN) {
        banner = s.scoreLeft > s.scoreRight ? "LEFT WINS" : "RIGHT WINS";
        say(t(s.scoreLeft > s.scoreRight ? "pongYouWin" : "pongComputerWins", { l: s.scoreLeft, r: s.scoreRight }));
        s.scoreLeft = s.scoreRight = 0;
        pauseUntil = now + 3000;
      }
    }
    render();
  }, 60);

  const aim = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    const y = ((e.clientY - r.top) / r.height) * H;
    target = y - PADDLE_H / 2;
  };
  canvas.addEventListener("pointermove", aim);
  canvas.addEventListener("pointerdown", (e) => {
    aim(e);
    if (!loop.running) toggle.click();
  });
  canvas.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      keys.add(e.key);
      e.preventDefault();
    } else if (e.key === " " || e.key === "Enter") {
      toggle.click();
      e.preventDefault();
    }
  });
  canvas.addEventListener("keyup", (e) => keys.delete(e.key));
  canvas.addEventListener("blur", () => keys.clear());

  const toggle = playPause(loop, [t("play"), t("pause")]);
  toggle.addEventListener("click", () => say(loop.running ? t("pongPlaying") : t("paused")));
  host.append(canvas, el("div", { class: "tryrow" }, toggle, el("span", { class: "readout", text: t("pongHelp") })));
  render();
  return () => loop.dispose();
};
