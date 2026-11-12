// Self-levelling platform, seen from the side twice: roll (servo X) and pitch
// (servo Y). You tilt the base; each servo goes to CENTER - tilt (GAIN 1), limited
// to 45..135 degrees as in the sketch, so the plate stays level until the base
// tilts more than 45 degrees. Servos turn at about an SG90's 600 degrees a second.
import { createLoop, el, type Mount } from "../../lib/preview/runtime";

const W = 420, H = 200, CENTER = 90, TRAVEL = 45, SERVO_DPS = 600, MAX_TILT = 60;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const mount: Mount = ({ host, say }) => {
  const canvas = el("canvas", { class: "stage", tabindex: "0", role: "img", "aria-label": "Side views of the platform" });
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d")!;
  const readout = el("output", { class: "readout", text: "pitch = 0.0, roll = 0.0, servo_x = 90, servo_y = 90" });
  let roll = 0, pitch = 0; // base tilt, degrees
  let sx = CENTER, sy = CENTER; // servo angles
  let lastPrint = 0;

  const css = (name: string, fallback: string) => getComputedStyle(host).getPropertyValue(name).trim() || fallback;

  const view = (cx: number, title: string, tilt: number, servo: number) => {
    const cy = 120, rad = (d: number) => (d * Math.PI) / 180;
    const plate = tilt + (servo - CENTER); // plate angle in the world
    const ink = css("--ink", "#14231f"), muted = css("--muted", "#5a6b65");
    g.save();
    g.translate(cx, cy);
    // Base
    g.save();
    g.rotate(rad(-tilt));
    g.fillStyle = muted;
    g.fillRect(-80, 30, 160, 10);
    g.fillRect(-5, 0, 10, 30);
    g.restore();
    // Plate on its pivot
    g.save();
    g.rotate(rad(-plate));
    const level = Math.abs(plate) < 1;
    g.fillStyle = level ? css("--ok", "#1d7a4c") : css("--accent", "#c0341a");
    g.fillRect(-70, -6, 140, 8);
    g.restore();
    g.fillStyle = ink;
    g.beginPath();
    g.arc(0, 0, 5, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.fillStyle = ink;
    g.font = "12px monospace";
    g.fillText(title, cx - 80, 22);
    g.fillStyle = muted;
    g.fillText(`base ${tilt.toFixed(0)}°  servo ${Math.round(servo)}°`, cx - 80, 40);
    g.fillStyle = Math.abs(plate) < 1 ? css("--ok", "#1d7a4c") : css("--accent", "#c0341a");
    g.fillText(Math.abs(plate) < 1 ? "plate level" : `plate off by ${Math.abs(plate).toFixed(0)}°`, cx - 80, 58);
  };

  const draw = () => {
    g.clearRect(0, 0, W, H);
    view(105, "Roll (servo X)", roll, sx);
    view(315, "Pitch (servo Y)", pitch, sy);
  };

  const loop = createLoop(host, (dt, now) => {
    const tx = clamp(Math.round(CENTER - roll), CENTER - TRAVEL, CENTER + TRAVEL);
    const ty = clamp(Math.round(CENTER - pitch), CENTER - TRAVEL, CENTER + TRAVEL);
    const maxStep = (SERVO_DPS * dt) / 1000;
    sx += clamp(tx - sx, -maxStep, maxStep);
    sy += clamp(ty - sy, -maxStep, maxStep);
    draw();
    if (now - lastPrint >= 100) {
      lastPrint = now;
      readout.textContent = `pitch = ${pitch.toFixed(1)}, roll = ${roll.toFixed(1)}, servo_x = ${Math.round(sx)}, servo_y = ${Math.round(sy)}`;
    }
  }, 60);

  const fromPointer = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    const fx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const fy = ((e.clientY - r.top) / r.height) * 2 - 1;
    roll = clamp(fx * MAX_TILT, -MAX_TILT, MAX_TILT);
    pitch = clamp(-fy * MAX_TILT, -MAX_TILT, MAX_TILT);
  };
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerType === "mouse" || e.buttons) fromPointer(e);
  });
  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    fromPointer(e);
  });
  canvas.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") roll = clamp(roll - 5, -MAX_TILT, MAX_TILT);
    else if (e.key === "ArrowRight") roll = clamp(roll + 5, -MAX_TILT, MAX_TILT);
    else if (e.key === "ArrowUp") pitch = clamp(pitch + 5, -MAX_TILT, MAX_TILT);
    else if (e.key === "ArrowDown") pitch = clamp(pitch - 5, -MAX_TILT, MAX_TILT);
    else if (e.key === "0") roll = pitch = 0;
    else return;
    e.preventDefault();
    const off = Math.max(Math.abs(roll), Math.abs(pitch)) > TRAVEL;
    say(`Base roll ${roll} degrees, pitch ${pitch} degrees.${off ? " Beyond 45 degrees the servos run out of travel." : " The plate stays level."}`);
  });

  host.append(canvas, el("div", { class: "tryrow" }, readout), el("p", { class: "readout", text: "Pointer or arrow keys tilt the base; 0 levels it." }));
  draw();
  loop.start();
  return () => loop.dispose();
};
