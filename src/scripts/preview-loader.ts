// Loads a project's "Try it" preview only when it can matter: after the page has
// finished loading and the section is near the screen, or at once if the visitor
// presses Start. Each preview lives in its own chunk.
import { Sound, type Mount, type PreviewContext } from "../lib/preview/runtime";

const LOADERS: Record<string, () => Promise<{ mount: Mount }>> = {
  oled: () => import("./previews/oled"),
  "oled-pong": () => import("./previews/oled-pong"),
  dice: () => import("./previews/dice"),
  "ntp-clock": () => import("./previews/ntp-clock"),
  "ph-display": () => import("./previews/ph-display"),
  "fire-lamp": () => import("./previews/fire-lamp"),
  neopixel: () => import("./previews/neopixel"),
  simon: () => import("./previews/simon"),
  "reaction-timer": () => import("./previews/reaction-timer"),
  "morse-decoder": () => import("./previews/morse-decoder"),
  "visitor-counter": () => import("./previews/visitor-counter"),
  theremin: () => import("./previews/theremin"),
  "ir-sweep": () => import("./previews/ir-sweep"),
  "level-platform": () => import("./previews/level-platform"),
  "joystick-turret": () => import("./previews/joystick-turret"),
};

export function mountPreview(section: HTMLElement): void {
  const id = section.dataset.preview ?? "";
  const host = section.querySelector<HTMLElement>("[data-host]");
  const status = section.querySelector<HTMLElement>("[data-status]");
  const startButton = section.querySelector<HTMLButtonElement>("[data-start]");
  const soundBox = section.querySelector<HTMLInputElement>("[data-sound]");
  const load = LOADERS[id];
  if (!host || !status || !load) return;

  const sound = new Sound();
  if (soundBox) {
    soundBox.checked = sound.enabled;
    soundBox.addEventListener("change", () => {
      sound.setEnabled(soundBox.checked);
      if (soundBox.checked) sound.unlock();
    });
  }
  // Any gesture inside the section may start audio; nothing plays before one.
  for (const type of ["pointerdown", "keydown", "touchstart"]) {
    section.addEventListener(type, () => sound.unlock(), { passive: true });
  }

  const ctx: PreviewContext = {
    host,
    say(text) {
      status.textContent = text;
    },
    reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    sound,
  };

  let started = false;
  const start = async () => {
    if (started) return;
    started = true;
    try {
      const { mount } = await load();
      host.replaceChildren();
      mount(ctx);
    } catch {
      // Messages come from the page in its language (Preview.astro).
      status.textContent = (navigator.onLine ? section.dataset.loadFail : section.dataset.offline) ?? "";
      started = false;
    }
  };

  startButton?.addEventListener("click", () => {
    sound.unlock();
    void start();
  });

  // Otherwise: once the page is loaded and idle, mount it when it comes near the screen.
  const whenIdle = (fn: () => void) =>
    "requestIdleCallback" in window ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 300);
  const watch = () =>
    whenIdle(() => {
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            io.disconnect();
            void start();
          }
        },
        { rootMargin: "200px" },
      );
      io.observe(section);
    });
  if (document.readyState === "complete") watch();
  else window.addEventListener("load", watch, { once: true });
}
