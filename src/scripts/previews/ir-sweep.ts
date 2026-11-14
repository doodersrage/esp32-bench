// IR sonar sweep: the servo steps 10 degrees at a time (about 76 ms per step, like
// SETTLE_MS plus 8 samples), sweeping back and forth. Each reading is the distance
// to the nearest obstacle along the beam, within the sensor's 10 to 80 cm, with a
// little noise. Drag the obstacles (or use the arrow keys) to change the scene.
import { IR } from "../../lib/preview/logic";
import { createLoop, el, playPause, type Mount } from "../../lib/preview/runtime";
import { PREVIEWS } from "../../i18n/strings/previews";
import { pageLocale, translator } from "../../i18n/t";

const W = 420, H = 240, OX = W / 2, OY = H - 18, PX = (H - 36) / IR.MAX_CM; // px per cm
const STEP_MS = 76;

const t = translator(PREVIEWS, pageLocale());

interface Obstacle {
  x: number; // cm, right of the sensor
  y: number; // cm, in front of the sensor
  r: number;
}

/** Distance in cm along a beam at `deg` to the nearest obstacle, or Infinity. */
function cast(deg: number, obstacles: Obstacle[]): number {
  const a = (deg * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a);
  let best = Infinity;
  for (const o of obstacles) {
    const along = o.x * dx + o.y * dy;
    const off2 = o.x * o.x + o.y * o.y - along * along;
    if (along <= 0 || off2 > o.r * o.r) continue;
    const hit = along - Math.sqrt(o.r * o.r - off2);
    if (hit > 0 && hit < best) best = hit;
  }
  return best;
}

export const mount: Mount = ({ host, say, reduced }) => {
  const canvas = el("canvas", { class: "stage", tabindex: "0", role: "img", "aria-label": t("irAria") });
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d")!;
  const readout = el("output", { class: "readout", text: "angle = 0, cm = 0.0" });
  const obstacles: Obstacle[] = [
    { x: -25, y: 35, r: 7 },
    { x: 20, y: 22, r: 5 },
    { x: 35, y: 55, r: 9 },
  ];
  const seen = new Map<number, number>(); // angle -> cm from the latest pass
  let angle = 0;
  let forward = true;
  let since = 0;
  let selected = 0;
  let dragging = -1;

  const css = (name: string, fallback: string) => getComputedStyle(host).getPropertyValue(name).trim() || fallback;
  const toPx = (x: number, y: number) => [OX + x * PX, OY - y * PX];

  const draw = () => {
    const ink = css("--ink", "#14231f"), muted = css("--muted", "#5a6b65"), line = css("--line", "#c8d1cb");
    g.clearRect(0, 0, W, H);
    g.strokeStyle = line;
    g.fillStyle = muted;
    g.font = "10px monospace";
    for (const cm of [20, 40, 60, 80]) {
      g.beginPath();
      g.arc(OX, OY, cm * PX, Math.PI, 0);
      g.stroke();
      g.fillText(`${cm}`, OX + cm * PX - 8, OY + 12);
    }
    for (const o of obstacles) {
      const [x, y] = toPx(o.x, o.y);
      g.fillStyle = css("--pad-soft", "#f4e7c4");
      g.strokeStyle = css("--pad", "#7f5a0c");
      g.beginPath();
      g.arc(x, y, o.r * PX, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    // What the sensor saw on the last pass.
    g.fillStyle = css("--accent", "#c0341a");
    for (const [deg, cm] of seen) {
      if (cm > IR.MAX_CM) continue;
      const a = (deg * Math.PI) / 180;
      const [x, y] = toPx(Math.cos(a) * cm, Math.sin(a) * cm);
      g.fillRect(x - 3, y - 3, 6, 6);
    }
    // The beam and the sensor.
    const a = (angle * Math.PI) / 180;
    g.strokeStyle = css("--ok", "#1d7a4c");
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(OX, OY);
    g.lineTo(OX + Math.cos(a) * IR.MAX_CM * PX, OY - Math.sin(a) * IR.MAX_CM * PX);
    g.stroke();
    g.lineWidth = 1;
    g.fillStyle = ink;
    g.fillRect(OX - 10, OY - 4, 20, 10);
  };

  const step = () => {
    let cm = cast(angle, obstacles);
    cm = cm < IR.MIN_CM ? IR.MIN_CM - 1 : cm > IR.MAX_CM ? IR.MAX_CM + 1 : cm + (Math.random() - 0.5) * 1.6;
    seen.set(angle, cm);
    readout.textContent = `angle = ${angle}, cm = ${cm.toFixed(1)}`;
    if ((forward && angle === 180) || (!forward && angle === 0)) {
      let nearest = Infinity, at = -1;
      for (const [deg, d] of seen) if (d < nearest) [nearest, at] = [d, deg];
      if (nearest <= IR.MAX_CM) say(t("irDone", { cm: nearest.toFixed(1), deg: at }));
      forward = !forward;
    } else {
      angle += forward ? IR.STEP_DEG : -IR.STEP_DEG;
    }
    draw();
  };

  const loop = createLoop(host, (dt) => {
    since += dt;
    while (since >= STEP_MS) {
      since -= STEP_MS;
      step();
    }
  }, 30);

  const hitObstacle = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
    const cm = { x: (x - OX) / PX, y: (OY - y) / PX };
    return { cm, index: obstacles.findIndex((o) => (o.x - cm.x) ** 2 + (o.y - cm.y) ** 2 <= (o.r + 4) ** 2) };
  };
  canvas.addEventListener("pointerdown", (e) => {
    const { index } = hitObstacle(e);
    if (index >= 0) {
      dragging = selected = index;
      canvas.setPointerCapture(e.pointerId);
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    if (dragging < 0) return;
    const { cm } = hitObstacle(e);
    obstacles[dragging].x = Math.max(-80, Math.min(80, cm.x));
    obstacles[dragging].y = Math.max(5, Math.min(80, cm.y));
    draw();
  });
  const drop = () => (dragging = -1);
  canvas.addEventListener("pointerup", drop);
  canvas.addEventListener("pointercancel", drop);
  canvas.addEventListener("keydown", (e) => {
    const o = obstacles[selected];
    if (e.key === "Tab" || e.key === "Escape") return;
    if (e.key === "n" || e.key === "N") selected = (selected + 1) % obstacles.length;
    else if (e.key === "ArrowLeft") o.x = Math.max(-80, o.x - 2);
    else if (e.key === "ArrowRight") o.x = Math.min(80, o.x + 2);
    else if (e.key === "ArrowUp") o.y = Math.min(80, o.y + 2);
    else if (e.key === "ArrowDown") o.y = Math.max(5, o.y - 2);
    else return;
    e.preventDefault();
    draw();
  });

  const toggle = playPause(loop, [t("play"), t("pause")]);
  host.append(
    canvas,
    el("div", { class: "tryrow" }, toggle, readout),
    el("p", { class: "readout", text: t("irKeys") }),
  );
  draw();
  if (!reduced) {
    loop.start();
    toggle.textContent = t("pause");
    toggle.setAttribute("aria-pressed", "true");
  } else {
    say(t("reducedMotion"));
  }
  return () => loop.dispose();
};
