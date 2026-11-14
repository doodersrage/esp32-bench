// SSD1306 status screen: "ESP32" at size 2 and the uptime, redrawn every second.
import { button, createLoop, el, oledCanvas, type Mount } from "../../lib/preview/runtime";
import { PREVIEWS } from "../../i18n/strings/previews";
import { pageLocale, translator } from "../../i18n/t";

const t = translator(PREVIEWS, pageLocale());

export const mount: Mount = ({ host, say }) => {
  const screen = oledCanvas(t("oledAria"));
  let bootAt = performance.now();
  const { fb } = screen;

  const draw = () => {
    fb.clear();
    fb.textSize = 2;
    fb.setCursor(0, 0);
    fb.println("ESP32");
    fb.textSize = 1;
    fb.print(`up ${Math.floor((performance.now() - bootAt) / 1000)} s`);
    screen.draw();
  };
  const loop = createLoop(host, draw, 1);
  const reset = button(t("oledReset"), () => {
    bootAt = performance.now();
    draw();
    say(t("oledRestarted"));
  });
  host.append(screen.canvas, el("div", { class: "tryrow" }, reset));
  draw();
  loop.start();
  return () => loop.dispose();
};
