// Offline use, from the page's side (the service worker, src/pages/sw.js.ts,
// does the saving): "Keep for offline" on project pages, the "Saved for
// offline" list, and asking for this language's pages to be saved.
//
// What this browser kept is listed in localStorage (bench.offline). It is not
// synced: each device keeps its own.
import { OFFLINE } from "../i18n/strings/offline";
import { HTML_LANG } from "../i18n/locales";
import { pageLocale, translator } from "../i18n/t";

const t = translator(OFFLINE, pageLocale());
const KEY = "bench.offline";

export interface Kept {
  name: string;
  /** The page as it was kept, in its language */
  page: string;
  at: number;
  bytes: number;
}

export function loadKept(): Record<string, Kept> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as unknown;
    return raw && typeof raw === "object" ? (raw as Record<string, Kept>) : {};
  } catch {
    return {};
  }
}

function saveKept(kept: Record<string, Kept>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(kept));
  } catch {
    // Without storage the list is lost, but the saved files stay until removed.
  }
  window.dispatchEvent(new CustomEvent("bench:offline"));
}

export const offlineSupported = () => "serviceWorker" in navigator && "caches" in window;

/** Ask the service worker to do something and wait for its answer. */
async function ask(message: Record<string, unknown>): Promise<{ ok: boolean; error?: string; bytes?: number; files?: number }> {
  const registration = await Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 8000))]);
  const worker = registration?.active;
  if (!worker) throw new Error(t("keepUnsupported"));
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = (event) => resolve(event.data);
    worker.postMessage(message, [channel.port2]);
  });
}

export function formatSize(bytes: number): string {
  const mb = bytes / 1_048_576;
  const n = new Intl.NumberFormat(HTML_LANG[pageLocale()], { maximumFractionDigits: mb < 10 ? 1 : 0 });
  return mb >= 1 ? `${n.format(mb)} MB` : `${n.format(Math.max(1, Math.round(bytes / 1024)))} KB`;
}

export async function keepProject(id: string, name: string): Promise<Kept> {
  if (!offlineSupported()) throw new Error(t("keepUnsupported"));
  if (!navigator.onLine) throw new Error(t("keepNeedsOnline"));
  // Ask the browser not to clear saved files when space runs low (granted to installed apps).
  void navigator.storage?.persist?.();
  const page = location.pathname;
  const answer = await ask({ type: "keep", project: id, page });
  if (!answer.ok) throw new Error(answer.error ?? "");
  const kept = loadKept();
  kept[id] = { name, page, at: Date.now(), bytes: answer.bytes ?? 0 };
  saveKept(kept);
  return kept[id];
}

export async function dropProject(id: string): Promise<void> {
  if (offlineSupported()) await ask({ type: "drop", project: id }).catch(() => undefined);
  const kept = loadKept();
  delete kept[id];
  saveKept(kept);
}

/** A page in another language: have its language's pages saved for offline use too. */
export function warmLanguage() {
  const locale = pageLocale();
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  if (locale === "en" || saveData || !offlineSupported() || !navigator.onLine) return;
  void navigator.serviceWorker.ready.then((r) => r.active?.postMessage({ type: "warm", locale }));
}

/** The "Saved for offline" list: a <ul> filled with the kept projects, plus a total line. */
export function renderKept(list: HTMLElement, total: HTMLElement | null, empty: HTMLElement | null) {
  const kept = Object.entries(loadKept()).sort((a, b) => b[1].at - a[1].at);
  if (empty) empty.hidden = kept.length > 0;
  const date = new Intl.DateTimeFormat(HTML_LANG[pageLocale()], { dateStyle: "medium" });
  list.replaceChildren(
    ...kept.map(([id, k]) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = k.page;
      a.textContent = k.name;
      const meta = document.createElement("span");
      meta.className = "cap";
      meta.textContent = ` ${formatSize(k.bytes)}, ${t("savedOn", { date: date.format(k.at) })} `;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "btn sm";
      remove.textContent = t("remove");
      remove.setAttribute("aria-label", t("removeLabel", { name: k.name }));
      remove.addEventListener("click", () => void dropProject(id));
      li.append(a, meta, remove);
      return li;
    }),
  );
  if (total) {
    const bytes = kept.reduce((s, [, k]) => s + k.bytes, 0);
    total.textContent = kept.length === 0 ? "" : kept.length === 1 ? t("totalOne", { size: formatSize(bytes) }) : t("total", { n: kept.length, size: formatSize(bytes) });
  }
}

// The project page button.
const button = document.querySelector<HTMLButtonElement>("[data-keep-offline]");
const status = document.querySelector<HTMLElement>("[data-keep-status]");
if (button && offlineSupported()) {
  const id = button.dataset.project ?? "";
  const name = button.dataset.name ?? id;
  const show = () => {
    const isKept = id in loadKept();
    button.textContent = isKept ? t("kept") : t("keep");
    button.title = isKept ? t("keptTitle") : t("keepTitle");
    button.setAttribute("aria-pressed", String(isKept));
  };
  show();
  button.hidden = false;
  window.addEventListener("bench:offline", show);
  button.addEventListener("click", async () => {
    const say = (text: string) => {
      if (status) {
        status.textContent = text;
        status.hidden = false;
      }
    };
    button.disabled = true;
    try {
      if (id in loadKept()) {
        await dropProject(id);
        say(t("dropped"));
      } else {
        button.textContent = t("keeping");
        const k = await keepProject(id, name);
        say(t("keptDone", { size: formatSize(k.bytes), boards: button.dataset.boards ?? "" }));
      }
    } catch (e) {
      say(t("keepFailed", { error: (e as Error).message }));
    } finally {
      button.disabled = false;
      show();
    }
  });
}

// Any "Saved for offline" list on the page (home, offline page).
const list = document.querySelector<HTMLElement>("[data-kept-list]");
if (list) {
  const total = document.querySelector<HTMLElement>("[data-kept-total]");
  const empty = document.querySelector<HTMLElement>("[data-kept-empty]");
  const render = () => renderKept(list, total, empty);
  render();
  window.addEventListener("bench:offline", render);
  window.addEventListener("storage", (e) => e.key === KEY && render());
}

warmLanguage();
