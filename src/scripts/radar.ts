// Wi-Fi radar. Reads the output of the Wi-Fi scanner project and draws each
// network as an arch over its channel, the way a spectrum view would.

interface Network {
  ssid: string;
  rssi: number;
  channel: number;
  open: boolean;
}

// " 1  workshop-2g               -48 dBm  ch  6  secured"
const NETWORK = /^\s*\d+\s+(.*?)\s+(-\d+) dBm\s+ch\s+(\d+)\s+(open|secured)\s*$/;
const HEADER = /^\s*(\d+) networks?\s*$/;

const FLOOR = -100;
const CEILING = -30;

let panel: HTMLElement | null = null;
let canvas: HTMLCanvasElement | null = null;
let note: HTMLElement | null = null;
let current: Network[] = [];
let pending: Network[] = [];

export function initRadar(section: HTMLElement) {
  panel = section;
  canvas = section.querySelector("canvas");
  note = section.querySelector("[data-radar-note]");
  window.addEventListener("resize", () => current.length > 0 && draw());
}

export function resetRadar() {
  current = [];
  pending = [];
  if (panel) panel.hidden = true;
}

export function feedRadar(line: string) {
  if (HEADER.test(line)) {
    pending = [];
    return;
  }
  const m = NETWORK.exec(line);
  if (!m) return;
  pending.push({ ssid: m[1] || "(hidden)", rssi: Number(m[2]), channel: Number(m[3]), open: m[4] === "open" });
  current = pending.slice();
  if (panel) panel.hidden = false;
  draw();
}

/** Rough interference score for a channel: nearby networks count, strong ones count more. */
function congestion(channel: number): number {
  return current
    .filter((n) => Math.abs(n.channel - channel) <= 4)
    .reduce((sum, n) => sum + Math.pow(10, n.rssi / 10) * (1 - Math.abs(n.channel - channel) / 5), 0);
}

function draw() {
  if (!canvas) return;
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 320;
  const height = canvas.clientHeight || 220;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(ratio, ratio);

  const style = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  const colors = [token("--accent", "#d23a1e"), token("--pad", "#a97a17"), token("--ok", "#1d7a4c")];
  const grid = token("--line", "#ccc");
  const text = token("--muted", "#666");
  const ink = token("--ink", "#111");

  const left = 58;
  const right = 10;
  const top = 22;
  const bottom = 26;
  // Channels 1 to 14, with two channels of margin so edge arches fit.
  const x = (channel: number) => left + ((channel + 1) / 17) * (width - left - right);
  const y = (rssi: number) => top + ((CEILING - Math.max(FLOOR, Math.min(CEILING, rssi))) / (CEILING - FLOOR)) * (height - top - bottom);

  ctx.font = '11px "IBM Plex Mono", ui-monospace, monospace';
  ctx.lineWidth = 1;
  ctx.strokeStyle = grid;
  ctx.fillStyle = text;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (const level of [-90, -70, -50]) {
    const gy = Math.round(y(level)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(left, gy);
    ctx.lineTo(width - right, gy);
    ctx.stroke();
    ctx.fillText(`${level} dBm`, left - 6, gy);
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let channel = 1; channel <= 14; channel++) ctx.fillText(String(channel), x(channel), height - bottom + 6);

  const base = y(FLOOR);
  [...current]
    .sort((a, b) => a.rssi - b.rssi)
    .forEach((n, i) => {
      const color = colors[i % colors.length];
      const peak = y(n.rssi);
      // A 20 MHz network spans about two channels either side of its centre.
      ctx.beginPath();
      ctx.moveTo(x(n.channel - 2), base);
      ctx.quadraticCurveTo(x(n.channel), peak - (base - peak), x(n.channel + 2), base);
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash(n.open ? [5, 4] : []);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = ink;
      ctx.textBaseline = "bottom";
      const label = n.ssid.length > 16 ? `${n.ssid.slice(0, 15)}…` : n.ssid;
      ctx.fillText(label, Math.max(left + 40, Math.min(width - right - 40, x(n.channel))), peak - 3);
    });

  if (note) {
    const strongest = [...current].sort((a, b) => b.rssi - a.rssi)[0];
    const quiet = [1, 6, 11].sort((a, b) => congestion(a) - congestion(b))[0];
    note.textContent =
      `${current.length} ${current.length === 1 ? "network" : "networks"}. Strongest: ${strongest.ssid} at ${strongest.rssi} dBm on channel ${strongest.channel}. ` +
      `Of channels 1, 6 and 11, channel ${quiet} looks quietest from here. Dashed arches are open networks.`;
  }
}
