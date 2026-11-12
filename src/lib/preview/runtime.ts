// Browser helpers shared by the previews: a frame loop that only runs while the
// preview is on screen and the tab is visible, sound that starts only after a
// user gesture, an OLED canvas, and small DOM helpers.
import { Framebuffer, OLED_H, OLED_W } from "./oled";

export interface PreviewContext {
  host: HTMLElement;
  /** Announce a result to screen readers (and show it as the status line). */
  say(text: string): void;
  /** The visitor prefers reduced motion: animations start paused or slowed. */
  reduced: boolean;
  sound: Sound;
}

export type Mount = (ctx: PreviewContext) => () => void;

// ---------- Visibility-aware loop ----------

export interface Loop {
  start(): void;
  stop(): void;
  readonly running: boolean;
  dispose(): void;
}

/**
 * Calls step(dt in ms, now) on animation frames, at most `fps` times a second,
 * only while the host is on screen, the tab is visible and the loop is started.
 */
export function createLoop(host: HTMLElement, step: (dt: number, now: number) => void, fps = 60): Loop {
  let wanted = false;
  let onScreen = true;
  let raf = 0;
  let last = 0;
  const minGap = 1000 / fps - 1;

  const frame = (now: number) => {
    raf = 0;
    if (!active()) return;
    const dt = last ? now - last : 1000 / fps;
    if (dt >= minGap) {
      last = now;
      step(Math.min(dt, 100), now);
    }
    raf = requestAnimationFrame(frame);
  };
  const active = () => wanted && onScreen && document.visibilityState === "visible";
  const kick = () => {
    if (active() && !raf) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  };
  const io = new IntersectionObserver((entries) => {
    onScreen = entries.some((e) => e.isIntersecting);
    kick();
  });
  io.observe(host);
  const onVis = () => kick();
  document.addEventListener("visibilitychange", onVis);

  return {
    start() {
      wanted = true;
      kick();
    },
    stop() {
      wanted = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
    get running() {
      return wanted;
    },
    dispose() {
      this.stop();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    },
  };
}

// ---------- Sound ----------

const SOUND_KEY = "bench.previewSound";

/** Square-wave beeps like a piezo. Nothing plays until unlock() runs inside a user gesture. */
export class Sound {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  enabled: boolean;

  constructor() {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(SOUND_KEY);
    } catch {
      // storage blocked: default on
    }
    this.enabled = saved !== "off";
  }

  /** Call from a click, key or touch handler. */
  unlock(): void {
    if (!this.enabled) return;
    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state === "suspended") void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    try {
      localStorage.setItem(SOUND_KEY, on ? "on" : "off");
    } catch {
      // ignore
    }
    if (!on) this.stop();
  }

  /** Start (or retune) a continuous tone, like tone(pin, hz). */
  start(hz: number, volume = 0.05): void {
    if (!this.enabled || !this.ctx || this.ctx.state !== "running" || hz <= 0) return;
    if (!this.osc) {
      this.gain = this.ctx.createGain();
      this.gain.gain.value = volume;
      this.osc = this.ctx.createOscillator();
      this.osc.type = "square";
      this.osc.connect(this.gain).connect(this.ctx.destination);
      this.osc.start();
    }
    this.osc.frequency.setTargetAtTime(hz, this.ctx.currentTime, 0.005);
    this.gain?.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.005);
  }

  /** noTone(). */
  stop(): void {
    if (this.osc && this.ctx) {
      const osc = this.osc;
      this.gain?.gain.setTargetAtTime(0, this.ctx.currentTime, 0.01);
      osc.stop(this.ctx.currentTime + 0.05);
    }
    this.osc = null;
    this.gain = null;
  }

  /** tone(pin, hz, ms). */
  beep(hz: number, ms: number, volume = 0.05): void {
    if (!this.enabled || !this.ctx || this.ctx.state !== "running") return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "square";
    osc.frequency.value = hz;
    gain.gain.value = volume;
    osc.connect(gain).connect(this.ctx.destination);
    const t = this.ctx.currentTime;
    gain.gain.setValueAtTime(volume, t + ms / 1000 - 0.01);
    gain.gain.linearRampToValueAtTime(0, t + ms / 1000);
    osc.start(t);
    osc.stop(t + ms / 1000 + 0.02);
  }
}

// ---------- OLED canvas ----------

/** A crisp 128 x 64 canvas that shows a Framebuffer in the colour of a white SSD1306. */
export function oledCanvas(label: string): { canvas: HTMLCanvasElement; fb: Framebuffer; draw(): void } {
  const canvas = document.createElement("canvas");
  canvas.width = OLED_W;
  canvas.height = OLED_H;
  canvas.className = "oled";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", label);
  const g = canvas.getContext("2d")!;
  const image = g.createImageData(OLED_W, OLED_H);
  const fb = new Framebuffer();
  return {
    canvas,
    fb,
    draw() {
      const d = image.data;
      for (let i = 0; i < fb.pixels.length; i++) {
        const on = fb.pixels[i] === 1;
        d[i * 4] = on ? 214 : 6;
        d[i * 4 + 1] = on ? 240 : 10;
        d[i * 4 + 2] = on ? 255 : 14;
        d[i * 4 + 3] = 255;
      }
      g.putImageData(image, 0, 0);
    },
  };
}

// ---------- DOM helpers ----------

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else e.setAttribute(k, v);
  }
  e.append(...children);
  return e;
}

export function button(label: string, onClick: (e: Event) => void, cls = "btn sm"): HTMLButtonElement {
  const b = el("button", { type: "button", class: cls, text: label });
  b.addEventListener("click", onClick);
  return b;
}

/** A Play / Pause toggle for a loop. */
export function playPause(loop: Loop, labels = ["Play", "Pause"]): HTMLButtonElement {
  const b = button(loop.running ? labels[1] : labels[0], () => {
    if (loop.running) loop.stop();
    else loop.start();
    b.textContent = loop.running ? labels[1] : labels[0];
    b.setAttribute("aria-pressed", String(loop.running));
  });
  b.setAttribute("aria-pressed", String(loop.running));
  return b;
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function stored(key: string): number {
  try {
    return Number(localStorage.getItem(`bench.preview.${key}`) ?? 0) || 0;
  } catch {
    return 0;
  }
}

export function store(key: string, value: number): void {
  try {
    localStorage.setItem(`bench.preview.${key}`, String(value));
  } catch {
    // ignore
  }
}

/** A row of virtual LEDs on a canvas. set(colors) paints them. */
export function ledStrip(count: number, label: string): { canvas: HTMLCanvasElement; set(colors: [number, number, number][]): void } {
  const canvas = document.createElement("canvas");
  const cell = 24;
  canvas.width = count * cell;
  canvas.height = cell * 2;
  canvas.className = "ledstrip";
  canvas.style.maxWidth = `${count * 36}px`; // keep short strips from stretching tall
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", label);
  const g = canvas.getContext("2d")!;
  return {
    canvas,
    set(colors) {
      g.fillStyle = "#0b1012";
      g.fillRect(0, 0, canvas.width, canvas.height);
      colors.forEach(([r, gg, b], i) => {
        const x = i * cell + cell / 2, y = cell;
        // Glow, then the LED itself. NeoPixels are bright even at low values, so lift dim colours a little.
        const lift = (v: number) => Math.round(255 * (v / 255) ** 0.6);
        const c = `rgb(${lift(r)},${lift(gg)},${lift(b)})`;
        const glow = g.createRadialGradient(x, y, 2, x, y, cell);
        glow.addColorStop(0, `rgba(${lift(r)},${lift(gg)},${lift(b)},0.55)`);
        glow.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = glow;
        g.fillRect(x - cell, 0, cell * 2, canvas.height);
        g.fillStyle = "#1c2326";
        g.fillRect(x - 7, y - 7, 14, 14);
        g.fillStyle = c;
        g.beginPath();
        g.arc(x, y, 5, 0, Math.PI * 2);
        g.fill();
      });
    },
  };
}
