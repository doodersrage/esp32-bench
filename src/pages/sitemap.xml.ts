import type { APIRoute } from "astro";
import { allPages } from "../lib/routes";
import { absolute } from "../lib/site";

export const GET: APIRoute = ({ site }) => {
  const urls = allPages()
    .map((path) => `  <url><loc>${absolute(path, site)}</loc></url>`)
    .join("\n");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { "Content-Type": "application/xml; charset=utf-8" } },
  );
};
