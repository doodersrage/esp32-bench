// Visitor counter: a 7-segment digit driven by the sketch's segment table. A wave
// is a PIR pulse; it counts only after 2 s of quiet (REARM_MS), chirps, then spells
// the whole count one digit at a time with the dot on the last, as the sketch does.
import { REARM_MS, SEGMENTS } from "../../lib/preview/logic";
import { button, el, sleep, store, stored, type Mount } from "../../lib/preview/runtime";

const NS = "http://www.w3.org/2000/svg";
// Segment shapes a..g and the dot, on a 60 x 100 digit.
const SHAPES = [
  "M12 6 L48 6 L42 12 L18 12 Z", // a
  "M50 8 L50 46 L44 42 L44 14 Z", // b
  "M50 54 L50 92 L44 86 L44 58 Z", // c
  "M12 94 L48 94 L42 88 L18 88 Z", // d
  "M10 54 L16 58 L16 86 L10 92 Z", // e
  "M10 8 L16 14 L16 42 L10 46 Z", // f
  "M12 50 L18 46 L42 46 L48 50 L42 54 L18 54 Z", // g
];
const PIR_HIGH_MS = 1200; // how long the simulated PIR output stays high after a wave

export const mount: Mount = ({ host, say, sound }) => {
  let count = stored("visitors");
  let lastLow = -Infinity;
  let high = false;
  let spelling = false;

  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 72 100");
  svg.setAttribute("class", "sevenseg");
  svg.setAttribute("role", "img");
  const segs = [...SHAPES, ""].map((d, i) => {
    const node = i < 7 ? document.createElementNS(NS, "path") : document.createElementNS(NS, "circle");
    if (i < 7) node.setAttribute("d", d);
    else {
      node.setAttribute("cx", "62");
      node.setAttribute("cy", "92");
      node.setAttribute("r", "5");
    }
    svg.append(node);
    return node;
  });
  const showSegments = (bits: number) => {
    segs.forEach((s, i) => s.classList.toggle("on", ((bits >> i) & 1) === 1));
  };
  const showDigit = (d: number, dot = false) => {
    showSegments(SEGMENTS[d] | (dot ? 0x80 : 0));
    svg.setAttribute("aria-label", `7-segment digit showing ${d}`);
    svg.dataset.digit = String(d);
  };

  const pir = el("span", { class: "readout", text: "PIR: quiet" });
  const total = el("span", { class: "readout", text: `count = ${count}` });

  const spell = async () => {
    spelling = true;
    const digits = String(count);
    for (let i = 0; i < digits.length; i++) {
      showSegments(0);
      await sleep(120);
      showDigit(Number(digits[i]), i === digits.length - 1);
      await sleep(450);
    }
    showDigit(count % 10);
    spelling = false;
  };

  const wave = async () => {
    sound.unlock();
    const now = performance.now();
    if (high) return; // the PIR output is still high: same visit
    high = true;
    pir.textContent = "PIR: motion";
    if (now - lastLow >= REARM_MS && !spelling) {
      count++;
      store("visitors", count);
      total.textContent = `count = ${count}`;
      say(`count = ${count}`);
      sound.beep(1800, 50);
      setTimeout(() => sound.beep(2400, 50), 70);
      void spell();
    } else {
      say("Ignored: less than 2 seconds since the last visit, so it is the same person.");
    }
    await sleep(PIR_HIGH_MS);
    high = false;
    lastLow = performance.now();
    pir.textContent = "PIR: quiet";
  };

  const waveButton = button("Wave at the sensor", () => void wave(), "btn go");
  const reset = button("Reset (hold BOOT 3 s)", () => {
    count = 0;
    store("visitors", 0);
    total.textContent = "count = 0";
    showDigit(0);
    say("Count reset.");
  });
  host.append(
    el("div", { class: "segstage" }, svg),
    el("div", { class: "tryrow" }, waveButton, pir, total, reset),
    el("p", { class: "readout", text: "The real PIR needs 30 s to warm up after power-on; the simulation skips that." }),
  );
  showDigit(count % 10);
  return () => {};
};
