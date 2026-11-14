// Page shell: colour theme switch, the install button, the offline notice and
// the service worker that lets the site work offline and install as an app.
import { link } from "../lib/paths";
import { LOCALE_NAMES, isLocale, type Locale } from "../i18n/locales";
import { SHELL } from "../i18n/strings/shell";
import { pageLocale, translator } from "../i18n/t";

const t = translator(SHELL, pageLocale());
const THEME_NAMES = { auto: t("themeAuto"), light: t("themeLight"), dark: t("themeDark") };

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
  button.textContent = t("theme", { theme: THEME_NAMES[theme] });
  button.setAttribute("aria-label", t("themeLabel", { theme: THEME_NAMES[theme] }));
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

// Language. Picking one in the menu (or the English original link) is
// remembered; on an English page, a visitor whose browser prefers one of the
// other languages is offered it once, never redirected.
const LANG_KEY = "bench.lang";
document.addEventListener("click", (event) => {
  const a = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[data-locale-link]");
  if (!a) return;
  try {
    localStorage.setItem(LANG_KEY, a.dataset.localeLink ?? "en");
  } catch {
    // Without storage the choice lasts for this page only.
  }
});
document.addEventListener("click", (event) => {
  const menu = document.querySelector<HTMLDetailsElement>(".langmenu");
  if (menu?.open && !menu.contains(event.target as Node)) menu.open = false;
});

const offer = document.getElementById("langoffer");
if (offer && pageLocale() === "en" && document.documentElement.hasAttribute("data-translated")) {
  let chosen: string | null = null;
  try {
    chosen = localStorage.getItem(LANG_KEY);
  } catch {
    chosen = "en";
  }
  const wanted = chosen
    ? null
    : (navigator.languages ?? [navigator.language])
        .map((l) => l.toLowerCase())
        .map((l): Locale | null => (l === "pt-br" || l.startsWith("pt") ? "pt-br" : isLocale(l.slice(0, 2)) ? (l.slice(0, 2) as Locale) : null))
        .find((l): l is Locale => l !== null && l !== "en");
  const target = wanted ? document.querySelector<HTMLAnchorElement>(`.langmenu a[data-locale-link="${wanted}"]`) : null;
  if (wanted && target) {
    // In the offered language, so it reads naturally to the person it is for.
    const tw = translator(SHELL, wanted);
    const [text, go, no] = [offer.querySelector("span")!, offer.querySelector("a")!, offer.querySelector("button")!];
    offer.lang = wanted;
    text.textContent = tw("offer", { language: LOCALE_NAMES[wanted] });
    go.textContent = tw("offerGo", { language: LOCALE_NAMES[wanted] });
    go.href = target.href;
    go.dataset.localeLink = wanted;
    no.textContent = tw("offerNo");
    no.addEventListener("click", () => {
      try {
        localStorage.setItem(LANG_KEY, "en");
      } catch {
        // The offer comes back next page; nothing else to do.
      }
      offer.hidden = true;
    });
    offer.hidden = false;
  }
}
