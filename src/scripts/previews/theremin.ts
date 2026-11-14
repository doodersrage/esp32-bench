// Ultrasonic theremin: your pointer's distance from the sensor sets the pitch with
// the sketch's formula (5 cm = A6, 60 cm = A3, silence outside), updated every 60 ms
// like the sketch's readings, optionally snapped to semitones.
import { THEREMIN, thereminHz } from "../../lib/preview/logic";
import { el, type Mount } from "../../lib/preview/runtime";
import { PREVIEWS } from "../../i18n/strings/previews";
import { pageLocale, translator } from "../../i18n/t";

const t = translator(PREVIEWS, pageLocale());
const W = 420, H = 180, SENSOR_X = 40, CM_PX = (W - SENSOR_X - 20) / 70; // 70 cm across

export const mount: Mount = ({ host, say, sound }) => {
  const canvas = el("canvas", { class: "stage", tabindex: "0", role: "slider", "aria-label": t("thereminAria"), "aria-valuemin": "0", "aria-valuemax": "70" });
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d")!;
  const readout = el("output", { class: "readout", text: "distance_cm=0.0, freq=0" });
  const snapBox = el("input", { type: "checkbox", checked: "" });
  const snapLabel = el("label", {}, snapBox, t("thereminSnap"));
  let cm = 30;
  let playing = false;
  let lastUpdate = 0;
  let hz = 0;

  const css = (name: string) => getComputedStyle(host).getPropertyValue(name).trim();
  const draw = () => {
    g.clearRect(0, 0, W, H);
    // The beam: green where the theremin plays (5 to 60 cm).
    const y = H / 2;
    g.fillStyle = css("--pad-soft") || "#f4e7c4";
    g.fillRect(SENSOR_X + THEREMIN.NEAR_CM * CM_PX, y - 26, (THEREMIN.FAR_CM - THEREMIN.NEAR_CM) * CM_PX, 52);
    g.fillStyle = css("--muted") || "#5a6b65";
    g.font = "11px monospace";
    for (const mark of [5, 20, 40, 60]) {
      const x = SENSOR_X + mark * CM_PX;
      g.fillRect(x, y + 28, 1, 6);
      g.fillText(`${mark} cm`, x - 12, y + 46);
    }
    // The HC-SR04: two transducers.
    g.fillStyle = css("--ink") || "#14231f";
    g.fillRect(8, y - 30, 24, 60);
    g.fillStyle = "#c9cfd0";
    g.beginPath();
    g.arc(20, y - 14, 9, 0, Math.PI * 2);
    g.arc(20, y + 14, 9, 0, Math.PI * 2);
    g.fill();
    // The hand.
    const hx = SENSOR_X + cm * CM_PX;
    g.fillStyle = hz ? css("--accent") || "#c0341a" : css("--muted") || "#5a6b65";
    g.beginPath();
    g.ellipse(hx, y, 10, 22, 0, 0, Math.PI * 2);
    g.fill();
  };

  const update = (force = false) => {
    const now = performance.now();
    if (!force && now - lastUpdate < 60) return;
    lastUpdate = now;
    hz = thereminHz(cm, snapBox.checked);
    readout.textContent = `distance_cm=${cm.toFixed(1)}, freq=${hz}`;
    canvas.setAttribute("aria-valuenow", cm.toFixed(0));
    canvas.setAttribute("aria-valuetext", hz ? t("thereminHz", { cm: cm.toFixed(0), hz }) : t("thereminSilent", { cm: cm.toFixed(0) }));
    if (playing && hz) sound.start(hz, 0.04);
    else sound.stop();
    draw();
  };

  const fromPointer = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    cm = Math.max(0, Math.min(70, (x - SENSOR_X) / CM_PX));
  };
  canvas.addEventListener("pointerdown", (e) => {
    sound.unlock();
    canvas.setPointerCapture(e.pointerId);
    playing = true;
    fromPointer(e);
    update(true);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerType === "mouse" || playing) {
      fromPointer(e);
      if (e.pointerType === "mouse" && !playing) {
        playing = true;
      }
      update();
    }
  });
  const stop = () => {
    playing = false;
    sound.stop();
    draw();
  };
  canvas.addEventListener("pointerup", (e) => {
    if (e.pointerType !== "mouse") stop();
  });
  canvas.addEventListener("pointerleave", stop);
  canvas.addEventListener("pointercancel", stop);
  canvas.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 5 : 1;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") cm = Math.max(0, cm - step);
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") cm = Math.min(70, cm + step);
    else return;
    e.preventDefault();
    sound.unlock();
    playing = true;
    update(true);
    say(readout.textContent ?? "");
  });
  canvas.addEventListener("blur", stop);
  snapBox.addEventListener("change", () => update(true));

  host.append(canvas, el("div", { class: "tryrow" }, readout, snapLabel));
  update(true);
  return () => sound.stop();
};
