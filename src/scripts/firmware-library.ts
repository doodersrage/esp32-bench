// Shows the "Flash it from the browser" block when the prebuilt firmware
// library has images for this project, and lets a board that shares its chip
// family with a DevKit (a XIAO, the ESP32-CAM) pick its own manifest.

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
    const when = Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    if (built) built.textContent = `Built ${when}${index.core ? ` with Arduino-ESP32 core ${index.core}` : ""}, for the ${families.join(", ")}.`;

    const button = box.querySelector<HTMLElement>("esp-web-install-button");
    const activate = box.querySelector<HTMLButtonElement>('[slot="activate"]');
    if (activate) activate.textContent = `Flash ${index.version ? `firmware ${index.version}` : "the firmware"}`;
    const caption = box.querySelector<HTMLElement>(".flashbox .cap");
    if (caption) caption.textContent = `One image per chip family: ${families.join(", ")}. The installer detects which one is connected.`;

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
        select.addEventListener("change", () => {
          const path = select.value ? alternates[select.value] : entry.manifest;
          button.setAttribute("manifest", `${base}/${path}`);
        });
      }
    }
    box.hidden = false;
  });
}
