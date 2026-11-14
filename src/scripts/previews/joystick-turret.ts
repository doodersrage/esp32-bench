// Joystick pan-tilt turret: a virtual stick with the sketch's 8 % dead zone moves
// the servos at up to 120 degrees a second, limited to 10..170. "Click the stick"
// switches to tilt mode (the MPU-6050 option): the stick then stands in for hand
// tilt, and the servos go to 90 + tilt x 1.5 directly.
import { button, createLoop, el, type Mount } from "../../lib/preview/runtime";
import { PREVIEWS } from "../../i18n/strings/previews";
import { pageLocale, translator } from "../../i18n/t";

const W = 420, H = 210, DEADZONE = 0.08, MAX_SPEED = 120, MIN_A = 10, MAX_A = 170, TILT_GAIN = 1.5;
const STICK = { x: 90, y: 105, r: 70 };
const t = translator(PREVIEWS, pageLocale());
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The sketch's axis(): dead zone, then rescaled to the full -1..1. */
function axis(v: number): number {
  if (Math.abs(v) < DEADZONE) return 0;
  return clamp(((Math.abs(v) - DEADZONE) / (1 - DEADZONE)) * Math.sign(v), -1, 1);
}

export const mount: Mount = ({ host, say }) => {
  const canvas = el("canvas", { class: "stage", tabindex: "0", role: "img", "aria-label": t("joyAria") });
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d")!;
  const readout = el("output", { class: "readout", text: "pan = 90, tilt = 90" });
  let sx = 0, sy = 0; // stick, -1..1 (y up is positive)
  let pan = 90, tilt = 90;
  let tiltMode = false;
  let held = false;
  const keys = new Set<string>();
  let lastPrint = 0;

  const css = (name: string, fallback: string) => getComputedStyle(host).getPropertyValue(name).trim() || fallback;
  const draw = () => {
    const ink = css("--ink", "#14231f"), muted = css("--muted", "#5a6b65"), line = css("--line", "#c8d1cb"), accent = css("--accent", "#c0341a");
    g.clearRect(0, 0, W, H);
    // Stick
    g.strokeStyle = line;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(STICK.x, STICK.y, STICK.r, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(STICK.x, STICK.y, STICK.r * DEADZONE, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = ink;
    g.beginPath();
    g.arc(STICK.x + sx * STICK.r, STICK.y - sy * STICK.r, 18, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = muted;
    g.font = "12px monospace";
    g.fillText(tiltMode ? t("joyTiltMode") : t("joyStickMode"), 30, 200);
    // Turret from above: pan
    const tx = 300, ty = 120, rad = ((180 - pan) * Math.PI) / 180;
    g.strokeStyle = line;
    g.beginPath();
    g.arc(tx, ty, 80, Math.PI, 0);
    g.stroke();
    g.strokeStyle = accent;
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(tx, ty);
    g.lineTo(tx + Math.cos(rad) * 75, ty - Math.sin(rad) * 75);
    g.stroke();
    g.lineWidth = 1;
    g.fillStyle = ink;
    g.fillRect(tx - 12, ty - 6, 24, 18);
    // Tilt gauge
    const gy = 190 - ((tilt - MIN_A) / (MAX_A - MIN_A)) * 150;
    g.fillStyle = line;
    g.fillRect(400, 40, 6, 150);
    g.fillStyle = accent;
    g.fillRect(396, gy - 3, 14, 6);
    g.fillStyle = muted;
    g.fillText("pan", tx - 10, ty + 34);
    g.fillText("tilt", 384, 30);
  };

  const loop = createLoop(host, (dt, now) => {
    if (!held) {
      // Keys, or the stick springs back to the centre.
      sx = keys.has("ArrowLeft") ? -1 : keys.has("ArrowRight") ? 1 : sx * 0.6;
      sy = keys.has("ArrowDown") ? -1 : keys.has("ArrowUp") ? 1 : sy * 0.6;
      if (Math.abs(sx) < 0.01) sx = 0;
      if (Math.abs(sy) < 0.01) sy = 0;
    }
    if (tiltMode) {
      pan = 90 + sx * 40 * TILT_GAIN; // the stick stands in for up to 40 degrees of hand tilt
      tilt = 90 + sy * 40 * TILT_GAIN;
    } else {
      pan += axis(sx) * MAX_SPEED * (dt / 1000);
      tilt += axis(sy) * MAX_SPEED * (dt / 1000);
    }
    pan = clamp(pan, MIN_A, MAX_A);
    tilt = clamp(tilt, MIN_A, MAX_A);
    draw();
    if (now - lastPrint >= 150) {
      lastPrint = now;
      readout.textContent = `pan = ${Math.round(pan)}, tilt = ${Math.round(tilt)}`;
    }
  }, 60);

  const fromPointer = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
    let dx = (x - STICK.x) / STICK.r, dy = -(y - STICK.y) / STICK.r;
    const len = Math.hypot(dx, dy);
    if (len > 1) [dx, dy] = [dx / len, dy / len];
    sx = dx;
    sy = dy;
  };
  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    held = true;
    fromPointer(e);
  });
  canvas.addEventListener("pointermove", (e) => held && fromPointer(e));
  const release = () => (held = false);
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("keydown", (e) => {
    if (e.key.startsWith("Arrow")) {
      keys.add(e.key);
      e.preventDefault();
    }
  });
  canvas.addEventListener("keyup", (e) => keys.delete(e.key));
  canvas.addEventListener("blur", () => keys.clear());

  const click = button(t("joyClick"), () => {
    tiltMode = !tiltMode;
    click.setAttribute("aria-pressed", String(tiltMode));
    say(tiltMode ? t("joyTiltSay") : t("joyStickSay"));
  });
  click.setAttribute("aria-pressed", "false");
  const centre = button(t("joyCentre"), () => {
    pan = tilt = 90;
    say(t("joyCentred"));
  });
  host.append(canvas, el("div", { class: "tryrow" }, readout, click, centre), el("p", { class: "readout", text: t("joyHelp") }));
  draw();
  loop.start();
  return () => loop.dispose();
};
