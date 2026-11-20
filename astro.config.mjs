import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";

// manifold-3d (the 3D-printable parts) imports "node:module" only when it runs
// under Node. In the browser build, point that import at a stub so Vite does
// not warn about externalizing a Node built-in; server builds keep the real one.
const nodeModuleStub = fileURLToPath(new URL("./src/lib/print/node-module-stub.ts", import.meta.url));
const browserNodeModule = {
  name: "browser-node-module-stub",
  enforce: "pre",
  applyToEnvironment: (environment) => environment.name === "client",
  resolveId: (id) => (id === "node:module" ? nodeModuleStub : null),
};

// `site` is the public address. Canonical links, link previews, the sitemap and
// the RSS feed are built from it, so change it here when the domain changes.
// To publish under a sub-path (for example a GitHub Pages project site), also
// set `base: "/esp32-bench"`. Internal links go through src/lib/paths.ts.
//
// Languages: English at the root, the others under /es/, /de/, /fr/, /pt-br/.
// Pages live in src/pages/[...lang]/ and build once per language
// (src/i18n/locales.ts); Astro.currentLocale tells a component which one.
export default defineConfig({
  site: "https://esp32bench.dev",
  vite: { plugins: [browserNodeModule] },
  i18n: {
    defaultLocale: "en",
    locales: ["en", "es", "de", "fr", "pt-br"],
    routing: { prefixDefaultLocale: false },
  },
});
