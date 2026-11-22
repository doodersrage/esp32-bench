// Site-wide facts used by the layout, the feed, the sitemap and the web app manifest.
import { link } from "./paths";

export const SITE = {
  name: "ESP32 Bench",
  short: "ESP32 Bench",
  tagline: "ESP32 projects, pinouts and a serial workbench in your browser",
  description:
    "Free ESP32 project library with pinouts, wiring tables and copy-paste Arduino sketches, plus a Web Serial monitor, crash translator and browser flasher.",
  /** The person behind the site. */
  author: { name: "Robert McDowell", url: "https://robmcd.name/" },
  /** Public source repository. */
  repo: "https://github.com/doodersrage/esp32-bench",
  /** Ahrefs Web Analytics site key. Empty turns analytics off. */
  ahrefsKey: "OCD7LFsMxlGOUms5cW+xFw",
  /** Backend that emails reports to the site owner (api/ in this repository) */
  reportApi: "https://api.esp32bench.dev/report",
  /** Compiles sketches for the editor and Build a sketch (compile/ in this repository) */
  compileApi: "https://compile.esp32bench.dev",
  /** Approved community build reports: GET ?project=<id> */
  buildsApi: "https://api.esp32bench.dev/builds",
  /** Sync codes: one bench log across browsers (api/ in this repository) */
  syncApi: "https://api.esp32bench.dev/sync",
  /** The hardware lab's latest run, per project (api/ in this repository) */
  labLatestApi: "https://api.esp32bench.dev/lab/latest",
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

/** The desktop app (ESP32 Bench for Windows, macOS and Linux): the latest release, for /desktop/. */
export const DESKTOP = {
  version: "0.1.10",
  repo: "https://github.com/doodersrage/esp32-desktop",
  issues: "https://github.com/doodersrage/esp32-desktop/issues",
  release: "https://github.com/doodersrage/esp32-desktop/releases/tag/v0.1.10",
  /** Where the release's packages download from: append a file name from `packages`. */
  download: "https://github.com/doodersrage/esp32-desktop/releases/download/v0.1.10/",
  /** The release's macOS disk image (Apple silicon) and Windows installer and .zip (x86-64). */
  macos: "esp32bench-0.1.10-macos-arm64.dmg",
  windows: { installer: "esp32bench-0.1.10-windows-x86_64-setup.exe", zip: "esp32bench-0.1.10-windows-x86_64.zip" },
  /** The release's package for each supported Linux distribution, in the order the page lists them. */
  packages: [
    { distro: "Arch Linux", file: "esp32bench-bin-0.1.10-1-x86_64.pkg.tar.zst" },
    { distro: "Debian 13", file: "esp32bench_0.1.10-1.debian13_amd64.deb" },
    { distro: "Ubuntu 24.04 LTS", file: "esp32bench_0.1.10-1.ubuntu24.04_amd64.deb" },
    { distro: "Ubuntu 26.04 LTS", file: "esp32bench_0.1.10-1.ubuntu26.04_amd64.deb" },
    { distro: "Fedora 44", file: "esp32bench-0.1.10-1.fc44.x86_64.rpm" },
    { distro: "Fedora 45", file: "esp32bench-0.1.10-1.fc45.x86_64.rpm" },
  ],
  /** A project in the app: its esp32bench:// link (the app asks before it builds anything). */
  projectLink: (id: string) => `esp32bench://project/${id}`,
};

/** Absolute URL for a site path, for canonical links, feeds and previews. */
export function absolute(path: string, site: URL | undefined): string {
  const href = link(path);
  return site ? new URL(href, site).href : href;
}

/** The on-site report form, pre-filled. Reports are emailed to the site owner, never published. */
export function reportUrl(kind: "build" | "correction" | "message" | "print", fields: Record<string, string> = {}): string {
  const params = new URLSearchParams({ kind, ...fields });
  return `${link("/report/")}?${params}`;
}
