// Shows the "Flash it from the browser" block when the prebuilt firmware
// library has images for this project, and lets a board that shares its chip
// family with a DevKit (a XIAO, the ESP32-CAM) pick its own manifest.
import { HTML_LANG } from "../i18n/locales";
import { FIRMWARE } from "../i18n/strings/firmware";
import { pageLocale, translator } from "../i18n/t";

const t = translator(FIRMWARE, pageLocale());

interface LibraryIndex {
  builtAt: string;
  core: string;
  version: string;
  projects: Record<string, { boards: string[]; manifest: string; manifests?: Record<string, string>; size: Record<string, number> }>;
}

const CACHE_KEY = "bench.fwlib";
const CACHE_MS = 10 * 60 * 1000;

async function loadIndex(base: string): Promise<LibraryIndex | null> {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      const { at, index } = JSON.parse(cached) as { at: number; index: LibraryIndex };
      if (Date.now() - at < CACHE_MS) return index;
    }
  } catch {
    // No session storage: fetch every time.
  }
  try {
    const res = await fetch(`${base}/index.json`, { cache: "no-cache" });
    if (!res.ok) return null;
    const index = (await res.json()) as LibraryIndex;
    if (!index || typeof index !== "object" || !index.projects) return null;
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), index }));
    } catch {
      // Fine without the cache.
    }
    return index;
  } catch {
    return null;
  }
}

const FAMILY: Record<string, string> = {
  esp32: "ESP32",
  esp32s3: "ESP32-S3",
  esp32c3: "ESP32-C3",
  esp32s2: "ESP32-S2",
  esp32c6: "ESP32-C6",
  "xiao-esp32c3": "ESP32-C3",
  "xiao-esp32s3": "ESP32-S3",
  "esp32-cam": "ESP32",
  "esp32-doit": "ESP32",
  "esp32c3-supermini": "ESP32-C3",
};

const box = document.querySelector<HTMLElement>("#fwlib");
if (box) {
  const base = box.dataset.fwBase ?? "";
  const id = box.dataset.project ?? "";
  void loadIndex(base).then((index) => {
    const entry = index?.projects[id];
    if (!index || !entry) return;

    const built = box.querySelector<HTMLElement>("[data-fw-built]");
    const families = [...new Set(entry.boards.map((b) => FAMILY[b] ?? b))];
    const date = new Date(index.builtAt);
    // In UTC, so the date matches the one in the version string.
    const when = Number.isNaN(date.getTime())
      ? ""
      : date.toLocaleDateString(HTML_LANG[pageLocale()], { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
    const vars = { version: index.version, when, core: index.core, families: families.join(", ") };
    const key = index.version ? (index.core ? "builtVerCore" : "builtVer") : index.core ? "builtCore" : "builtPlain";
    if (built) built.textContent = t(key, vars);

    const button = box.querySelector<HTMLElement>("esp-web-install-button");
    const activate = box.querySelector<HTMLButtonElement>('[slot="activate"]');
    if (activate) activate.textContent = t("flashButton");
    const caption = box.querySelector<HTMLElement>(".flashbox .cap");
    if (caption) caption.textContent = t("oneImage", { families: families.join(", ") });

    // Boards with their own manifest (they share a chip family with a DevKit board).
    const pick = box.querySelector<HTMLElement>("[data-fw-pick]");
    const select = box.querySelector<HTMLSelectElement>("[data-fw-select]");
    const alternates = entry.manifests ?? {};
    if (pick && select && button) {
      for (const option of [...select.options]) {
        if (option.value && !(option.value in alternates)) option.remove();
      }
      if (select.options.length > 1) {
        pick.hidden = false;
        const apply = () => {
          const path = select.value ? alternates[select.value] : entry.manifest;
          button.setAttribute("manifest", `${base}/${path}`);
        };
        select.addEventListener("change", apply);
        // Follow the page's board: a board with its own image (a XIAO, the C3
        // SuperMini) needs it, since the DevKit image may print nothing over its USB.
        const boardMap = JSON.parse(box.dataset.boardMap ?? "{}") as Record<string, string>;
        const follow = (board: string) => {
          const target = boardMap[board] ?? board;
          select.value = [...select.options].some((o) => o.value === target) ? target : "";
          apply();
        };
        try {
          const saved = localStorage.getItem("bench.board");
          if (saved) follow(saved);
        } catch {
          // No storage: keep chip detection.
        }
        document.getElementById("boardswitch")?.addEventListener("click", (e) => {
          const board = (e.target as Element).closest<HTMLElement>("[data-board]")?.dataset.board;
          if (board) follow(board);
        });
      }
    }
    box.hidden = false;
  });
}
