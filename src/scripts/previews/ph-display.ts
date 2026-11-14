// ProbeHarbor readout: demo sensors drawn with the sketch's draw() layout. Pages
// change every 5 s (PAGE_SECONDS) or on the BOOT button; a temperature at or below
// FREEZE_F (35 °F) inverts the screen every other second, as the sketch does.
import { button, createLoop, el, oledCanvas, type Mount } from "../../lib/preview/runtime";
import { PREVIEWS } from "../../i18n/strings/previews";
import { pageLocale, translator } from "../../i18n/t";

interface Demo {
  device: string;
  label: string;
  kind: "temperature" | "door" | "flood";
  num?: number;
  flag?: boolean;
  unit: string;
  ago: number;
}

// The project's sample readings (the freezer probe is left out: at 4 °F the sketch
// would flag it as freezing too, which is right for the sketch but confusing here).
const READINGS: Demo[] = [
  { device: "Garage", label: "Garage air", kind: "temperature", num: 33.8, unit: "°F", ago: 1 },
  { device: "Garage", label: "Door", kind: "door", flag: false, unit: "", ago: 6 },
  { device: "Crawlspace", label: "Pipe probe", kind: "temperature", num: 41.5, unit: "°F", ago: 2 },
  { device: "Crawlspace", label: "Leak pads", kind: "flood", flag: false, unit: "", ago: 2 },
];
const FREEZE_F = 35;
const PAGE_MS = 5000;

const t = translator(PREVIEWS, pageLocale());

const word = (r: Demo) => (r.kind === "door" ? (r.flag ? "OPEN" : "CLOSED") : r.flag ? "WET" : "DRY");
const alarming = (r: Demo) => (r.kind === "temperature" ? (r.num ?? 99) <= FREEZE_F : r.kind === "flood" && !!r.flag);

export const mount: Mount = ({ host, say, reduced }) => {
  const screen = oledCanvas(t("phAria"));
  const { fb, canvas } = screen;
  let page = 0;
  let pageAt = performance.now();

  const draw = (now: number) => {
    if (now - pageAt >= PAGE_MS) {
      page = (page + 1) % READINGS.length;
      pageAt = now;
    }
    const r = READINGS[page];
    const alarm = alarming(r);
    fb.clear();
    fb.textSize = 1;
    fb.setCursor(0, 0);
    fb.println(r.device.slice(0, 21));
    fb.println(r.label.slice(0, 21));
    fb.textSize = r.num !== undefined ? 3 : 2;
    fb.setCursor(0, 24);
    if (r.num !== undefined) {
      fb.print(r.num.toFixed(Math.abs(r.num) < 100 ? 1 : 0));
      fb.textSize = 1;
      fb.print(` ${r.unit}`);
    } else {
      fb.print(word(r));
    }
    fb.textSize = 1;
    fb.setCursor(0, 56);
    fb.print(`${r.ago}m ago`);
    if (alarm) fb.print(r.kind === "temperature" ? "  FREEZE" : "  ALERT");
    fb.setCursor(104, 56);
    fb.print(`${page + 1}/${READINGS.length}`);
    if (alarm && !reduced && Math.floor(now / 1000) % 2 === 1) fb.invert();
    screen.draw();
    const value = r.num !== undefined ? `${r.num} ${r.unit}` : word(r);
    canvas.setAttribute("aria-label", t(alarm ? "phAriaFreeze" : "phAriaValue", { device: r.device, label: r.label, value }));
  };

  const loop = createLoop(host, (_dt, now) => draw(now), 4);
  const next = button(t("phNext"), () => {
    page = (page + 1) % READINGS.length;
    pageAt = performance.now();
    draw(pageAt);
    const r = READINGS[page];
    const value = r.num !== undefined ? `${r.num} ${r.unit}` : word(r);
    say(t(alarming(r) ? "phSayFreezing" : "phSay", { device: r.device, label: r.label, value }));
  });
  host.append(canvas, el("div", { class: "tryrow" }, next, el("span", { class: "readout", text: t("phDemo") })));
  draw(performance.now());
  loop.start();
  return () => loop.dispose();
};
