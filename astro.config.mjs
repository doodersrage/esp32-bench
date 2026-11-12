import { defineConfig } from "astro/config";

// `site` is the public address. Canonical links, link previews, the sitemap and
// the RSS feed are built from it, so change it here when the domain changes.
// To publish under a sub-path (for example a GitHub Pages project site), also
// set `base: "/esp32-bench"`. Internal links go through src/lib/paths.ts.
export default defineConfig({
  site: "https://esp32-bench.doodersrage.workers.dev",
});
