// Page shell: colour theme switch, the install button, the offline notice and
// the service worker that lets the site work offline and install as an app.
import { link } from "../lib/paths";

type Theme = "auto" | "light" | "dark";
const THEME_KEY = "bench.theme";
const ORDER: Theme[] = ["auto", "light", "dark"];

function savedTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : "auto";
  } catch {
    return "auto";
  }
}

function applyTheme(theme: Theme, button: HTMLButtonElement): void {
  if (theme === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  button.textContent = `Theme: ${theme}`;
  button.setAttribute("aria-label", `Colour theme: ${theme}. Select to change.`);
  try {
    if (theme === "auto") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage can be blocked; the theme still applies for this page.
  }
}

const themeButton = document.querySelector<HTMLButtonElement>("#theme");
if (themeButton) {
  let theme = savedTheme();
  applyTheme(theme, themeButton);
  themeButton.addEventListener("click", () => {
    theme = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    applyTheme(theme, themeButton);
  });
}

// Install as an app, where the browser offers it (Chrome and Edge).
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
const installButton = document.querySelector<HTMLButtonElement>("#install-app");
let deferred: InstallPromptEvent | null = null;
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferred = event as InstallPromptEvent;
  if (installButton) installButton.hidden = false;
});
installButton?.addEventListener("click", async () => {
  if (!deferred) return;
  await deferred.prompt();
  await deferred.userChoice;
  deferred = null;
  installButton.hidden = true;
});
window.addEventListener("appinstalled", () => {
  if (installButton) installButton.hidden = true;
});

// Offline notice.
const offlineNote = document.querySelector<HTMLElement>("#offline-note");
const showOnline = () => {
  if (offlineNote) offlineNote.hidden = navigator.onLine;
};
window.addEventListener("online", showOnline);
window.addEventListener("offline", showOnline);
showOnline();

// The service worker only runs on the built site, so the dev server never serves stale files.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(link("/sw.js"), { scope: link("/") }).catch(() => {
      // Offline support is a bonus; the site works without it.
    });
  });
}
