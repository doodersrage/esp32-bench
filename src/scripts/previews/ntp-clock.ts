// NTP clock face: HH:MM at size 3, seconds at size 2 and the date at size 1, at the
// sketch's positions. It shows the visitor's own local time, as the board would
// once it has synced and has your time zone rule.
import { createLoop, el, oledCanvas, type Mount } from "../../lib/preview/runtime";
import { PREVIEWS } from "../../i18n/strings/previews";
import { pageLocale, translator } from "../../i18n/t";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const t = translator(PREVIEWS, pageLocale());
const two = (n: number) => String(n).padStart(2, "0");

export const mount: Mount = ({ host }) => {
  const screen = oledCanvas(t("ntpAria"));
  const { fb, canvas } = screen;
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const draw = () => {
    const now = new Date();
    const hhmm = `${two(now.getHours())}:${two(now.getMinutes())}`;
    const date = `${DAYS[now.getDay()]} ${two(now.getDate())} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
    fb.clear();
    fb.textSize = 3;
    fb.setCursor(4, 12);
    fb.print(hhmm);
    fb.textSize = 2;
    fb.setCursor(100, 19);
    fb.print(two(now.getSeconds()));
    fb.textSize = 1;
    fb.setCursor(4, 50);
    fb.print(date);
    screen.draw();
    canvas.setAttribute("aria-label", t("ntpAriaShowing", { time: hhmm, date }));
  };
  const loop = createLoop(host, draw, 5); // the sketch redraws every 200 ms
  host.append(canvas, el("p", { class: "readout", text: t("ntpZone", { zone }) }));
  draw();
  loop.start();
  return () => loop.dispose();
};
