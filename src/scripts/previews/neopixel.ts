// NeoPixel effects on 8 LEDs, on the sketch's timeline: colour wipes in red, green
// and blue (60 ms per LED), 5 s of rainbow, then 4 s of orange theater chase.
import { colorHSV } from "../../lib/preview/logic";
import { createLoop, el, ledStrip, playPause, type Mount } from "../../lib/preview/runtime";

const COUNT = 8;
type RGB = [number, number, number];
const gamma = (v: number) => Math.round(255 * (v / 255) ** 2.6);
const WIPES: RGB[] = [[255, 0, 0], [0, 255, 0], [0, 0, 255]];
const WIPE_MS = COUNT * 60 * WIPES.length;
const RAINBOW_MS = 5000;
const CHASE_MS = 4000;
const CYCLE = WIPE_MS + RAINBOW_MS + CHASE_MS;

/** The strip at time t (ms) into the loop, and the effect's name. */
function at(t: number, held: RGB[]): { colors: RGB[]; effect: string } {
  t %= CYCLE;
  if (t < WIPE_MS) {
    const step = Math.floor(t / 60);
    const colour = WIPES[Math.floor(step / COUNT)];
    held[step % COUNT] = colour;
    return { colors: held.slice(), effect: "color wipe" };
  }
  if (t < WIPE_MS + RAINBOW_MS) {
    const hue = Math.floor((t - WIPE_MS) / 20) * 256;
    return {
      colors: Array.from({ length: COUNT }, (_, i) => colorHSV(hue + Math.floor((i * 65536) / COUNT)).map(gamma) as RGB),
      effect: "rainbow",
    };
  }
  const step = Math.floor((t - WIPE_MS - RAINBOW_MS) / 120);
  return {
    colors: Array.from({ length: COUNT }, (_, i) => ((i - (step % 3)) % 3 === 0 && i >= step % 3 ? [255, 160, 0] : [0, 0, 0]) as RGB),
    effect: "theater chase",
  };
}

export const mount: Mount = ({ host, say, reduced }) => {
  const strip = ledStrip(COUNT, "A stick of 8 LEDs");
  const held: RGB[] = Array.from({ length: COUNT }, () => [0, 0, 0] as RGB);
  let t = 0;
  let effect = "";
  const loop = createLoop(host, (dt) => {
    t += dt;
    const frame = at(t, held);
    strip.set(frame.colors);
    if (frame.effect !== effect) {
      effect = frame.effect;
      say(`effect: ${effect}`);
    }
  }, 60);
  const toggle = playPause(loop);
  host.append(strip.canvas, el("div", { class: "tryrow" }, toggle));
  strip.set(at(WIPE_MS + 1000, held).colors); // a rainbow frame as the still picture
  if (!reduced) {
    loop.start();
    toggle.textContent = "Pause";
    toggle.setAttribute("aria-pressed", "true");
  } else {
    say("Animation paused because your system asks for reduced motion. Press Play to run it.");
  }
  return () => loop.dispose();
};
