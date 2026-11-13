// Site-wide facts used by the layout, the feed, the sitemap and the web app manifest.
import { link } from "./paths";

export const SITE = {
  name: "ESP32 Bench",
  short: "ESP32 Bench",
  tagline: "ESP32 projects, pinouts and a serial workbench in your browser",
  description:
    "Free ESP32 project library with pinouts, wiring tables and copy-paste Arduino sketches, plus a Web Serial monitor, crash translator and browser flasher.",
  /** Public source repository. */
  repo: "https://github.com/doodersrage/esp32-bench",
  /** Ahrefs Web Analytics site key. Empty turns analytics off. */
  ahrefsKey: "OCD7LFsMxlGOUms5cW+xFw",
  /** Backend that emails reports to the site owner (api/ in this repository) */
  reportApi: "https://api.esp32bench.dev/report",
  /** Approved community build reports: GET ?project=<id> */
  buildsApi: "https://api.esp32bench.dev/builds",
  /** Prebuilt firmware for every project (R2 bucket esp32-bench-firmware, filled by the Firmware library workflow) */
  fwBase: "https://fw.esp32bench.dev",
  /** Public Turnstile site key for the report form (widget "esp32bench.dev report form") */
  turnstileSitekey: "0x4AAAAAAF-UtZoWkeF1Xe9G",
  /**
   * Comments through GitHub Discussions (giscus) in the public, code-free repo
   * doodersrage/esp32-bench-community. Hidden until enabled is true.
   */
  giscus: {
    repo: "doodersrage/esp32-bench-community",
    repoId: "R_kgDOVsLL1A",
    category: "Announcements",
    categoryId: "DIC_kwDOVsLL1M4DK-8y",
    /** Turn on once the giscus GitHub App is installed on the repository. */
    enabled: true,
  },
  themeColor: "#14231f",
  background: "#f2f5f1",
};

/** ProbeHarbor: the sister project behind the tested boards, the probe firmware and the ProbeHarbor sketches. */
export const PROBEHARBOR = {
  url: "https://probeharbor.dev/",
  repo: "https://github.com/doodersrage/probeharbor",
  blurb: "open-source freeze and flood monitoring for garages, workshops, attics and crawlspaces, with live charts and alerts",
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
