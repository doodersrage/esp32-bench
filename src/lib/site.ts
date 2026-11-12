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
  themeColor: "#14231f",
  background: "#f2f5f1",
};

/** Absolute URL for a site path, for canonical links, feeds and previews. */
export function absolute(path: string, site: URL | undefined): string {
  const href = link(path);
  return site ? new URL(href, site).href : href;
}

/** GitHub issue form, pre-filled. Returns "" while the repository is private. */
export function issueUrl(template: "build-report" | "correction", fields: Record<string, string>): string {
  if (!SITE.repo) return "";
  const params = new URLSearchParams({ template: `${template}.yml`, ...fields });
  return `${SITE.repo}/issues/new?${params}`;
}
