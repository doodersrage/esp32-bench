// NeoPixel fire and lava lamp: 30 LEDs running the sketch's Fire2012 heat array
// (about 60 frames a second) or its lava lamp (about 33), switched like BOOT.
import { fireStep, heatColor, lavaColors } from "../../lib/preview/logic";
import { button, createLoop, el, ledStrip, playPause, type Mount } from "../../lib/preview/runtime";
import { PREVIEWS } from "../../i18n/strings/previews";
import { pageLocale, translator } from "../../i18n/t";

const COUNT = 30;

const t = translator(PREVIEWS, pageLocale());
// Adafruit's gamma32 uses a 2.6 gamma table.
const gamma = (v: number) => Math.round(255 * (v / 255) ** 2.6);

export const mount: Mount = ({ host, say, reduced }) => {
  const strip = ledStrip(COUNT, t("fireAria"));
  const heat = new Uint8Array(COUNT);
  let lava = false;
  let since = 0;

  const frame = (dt: number, now: number) => {
    since += dt;
    const every = lava ? 30 : 16; // the sketch's delay() per frame
    if (since < every) return;
    since = 0;
    if (lava) {
      strip.set(lavaColors(COUNT, now / 1000).map(([r, g, b]) => [gamma(r), gamma(g), gamma(b)] as [number, number, number]));
    } else {
      fireStep(heat, Math.random);
      strip.set(Array.from(heat, heatColor));
    }
  };
  const loop = createLoop(host, frame, 60);
  const mode = button(t("fireMode"), () => {
    lava = !lava;
    mode.setAttribute("aria-pressed", String(lava));
    say(lava ? "mode: lava lamp" : "mode: fire");
    if (!loop.running) frame(100, performance.now());
  });
  mode.setAttribute("aria-pressed", "false");
  const toggle = playPause(loop, [t("play"), t("pause")]);
  host.append(strip.canvas, el("div", { class: "tryrow" }, mode, toggle));

  // Warm the fire up so the first frame is not black.
  for (let i = 0; i < 60; i++) fireStep(heat, Math.random);
  strip.set(Array.from(heat, heatColor));
  if (!reduced) {
    loop.start();
    toggle.textContent = t("pause");
    toggle.setAttribute("aria-pressed", "true");
  } else {
    say(t("reducedMotion"));
  }
  return () => loop.dispose();
};
