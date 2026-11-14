// Electronic dice: two 44 px dice drawn exactly as the sketch's drawDie(), the
// same tumble (faces slowing from 30 to 210 ms), and the running tally.
import { pips, tumble } from "../../lib/preview/logic";
import { button, el, oledCanvas, sleep, type Mount } from "../../lib/preview/runtime";
import { PREVIEWS } from "../../i18n/strings/previews";
import { pageLocale, translator } from "../../i18n/t";

const DICE = 2;

const t = translator(PREVIEWS, pageLocale());

export const mount: Mount = ({ host, say, reduced }) => {
  const screen = oledCanvas(t("diceAria"));
  const { fb, canvas } = screen;
  const counts = new Array(13).fill(0);
  let rolls = 0;
  let rolling = false;

  const drawDie = (x: number, y: number, value: number) => {
    fb.drawRoundRect(x, y, 44, 44, 6);
    for (const [px, py] of pips(value, x, y)) fb.fillCircle(px, py, 4);
  };
  const show = (one: number, two: number) => {
    fb.clear();
    drawDie(12, 10, one);
    drawDie(72, 10, two);
    screen.draw();
    canvas.dataset.faces = `${one},${two}`;
    canvas.setAttribute("aria-label", t("diceAriaFaces", { one, two }));
  };

  const roll = async () => {
    if (rolling) return;
    rolling = true;
    rollButton.disabled = true;
    const frames = tumble(Math.random, DICE);
    if (!reduced) {
      for (const f of frames) {
        show(f.faces[0], f.faces[1]);
        await sleep(f.wait);
      }
    }
    const [one, two] = frames.at(-1)!.faces;
    show(one, two);
    const total = one + two;
    counts[total]++;
    rolls++;
    let line = t("diceRolled", { one, two, total });
    if (rolls % 12 === 0) {
      const tally = [];
      for (let n = DICE; n <= DICE * 6; n++) tally.push(`${n}:${counts[n]}`);
      line += " " + t("diceAfter", { n: rolls, tally: tally.join(" ") });
    }
    say(line);
    tallyText.textContent = t(rolls === 1 ? "diceOneRoll" : "diceManyRolls", { n: rolls });
    rolling = false;
    rollButton.disabled = false;
    rollButton.focus();
  };

  const rollButton = button(t("diceRoll"), () => void roll(), "btn go");
  const tallyText = el("span", { class: "readout", text: t("diceManyRolls", { n: 0 }) });
  canvas.addEventListener("click", () => void roll());
  host.addEventListener("keydown", (e) => {
    if (e.key === " " && e.target !== rollButton) {
      e.preventDefault();
      void roll();
    }
  });
  host.append(canvas, el("div", { class: "tryrow" }, rollButton, tallyText));
  show(6, 6);
  return () => {};
};
