import type { APIRoute } from "astro";
import { SITE } from "../lib/site";
import { link } from "../lib/paths";

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      {
        name: SITE.name,
        short_name: SITE.short,
        description: SITE.description,
        id: link("/"),
        start_url: link("/"),
        scope: link("/"),
        display: "standalone",
        background_color: SITE.background,
        theme_color: SITE.themeColor,
        categories: ["education", "developer", "utilities"],
        icons: [
          { src: link("/icons/icon-192.png"), sizes: "192x192", type: "image/png" },
          { src: link("/icons/icon-512.png"), sizes: "512x512", type: "image/png" },
          { src: link("/icons/icon-maskable-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: link("/favicon.svg"), sizes: "any", type: "image/svg+xml" },
        ],
        shortcuts: [
          { name: "Serial bench", url: link("/bench/") },
          { name: "Pin detective", url: link("/detective/") },
          { name: "Error reference", url: link("/errors/") },
        ],
      },
      null,
      2,
    ),
    { headers: { "Content-Type": "application/manifest+json" } },
  );
