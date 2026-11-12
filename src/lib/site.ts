// Site-wide facts used by the layout, the feed, the sitemap and the web app manifest.
import { link } from "./paths";

export const SITE = {
  name: "ESP32 Bench",
  short: "ESP32 Bench",
  tagline: "ESP32 projects, pinouts and a serial workbench in your browser",
  description:
    "Free ESP32 project library with pinouts, wiring tables and copy-paste Arduino sketches, plus a Web Serial monitor, crash translator and browser flasher.",
  /** Public source repository. Leave empty while the repository is private. */
  repo: "",
  /** Ahrefs Web Analytics site key. Empty turns analytics off. */
  ahrefsKey: "OCD7LFsMxlGOUms5cW+xFw",
  /** Backend that emails reports to the site owner (api/ in this repository) */
  reportApi: "https://api.esp32bench.dev/report",
  /** Public Turnstile site key for the report form (widget "esp32bench.dev report form") */
  turnstileSitekey: "0x4AAAAAAF-UtZoWkeF1Xe9G",
  themeColor: "#14231f",
  background: "#f2f5f1",
};

/** Absolute URL for a site path, for canonical links, feeds and previews. */
export function absolute(path: string, site: URL | undefined): string {
  const href = link(path);
  return site ? new URL(href, site).href : href;
}

/** The on-site report form, pre-filled. Reports are emailed to the site owner, never published. */
export function reportUrl(kind: "build" | "correction" | "message", fields: Record<string, string> = {}): string {
  const params = new URLSearchParams({ kind, ...fields });
  return `${link("/report/")}?${params}`;
}
