// Cloudflare Workers config for the static site. `npm run deploy` builds with
// Astro, then `cf deploy dist` uploads dist/ as static assets (no server code).
export default {
  worker: {
    name: "esp32-bench",
    compatibilityDate: "2026-11-01",
    // Cloudflare creates the DNS records and certificates for these.
    domains: ["esp32bench.dev", "www.esp32bench.dev"],
    assets: {
      htmlHandling: "auto-trailing-slash",
      notFoundHandling: "404-page",
    },
  },
};
