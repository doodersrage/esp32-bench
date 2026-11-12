// Cloudflare Workers config for the static site. `npm run deploy` builds with
// Astro, then `cf deploy dist` uploads dist/ as static assets (no server code).
export default {
  worker: {
    name: "esp32-bench",
    compatibilityDate: "2026-11-01",
    assets: {
      htmlHandling: "auto-trailing-slash",
      notFoundHandling: "404-page",
    },
  },
};
