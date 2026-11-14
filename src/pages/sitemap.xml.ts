import type { APIRoute } from "astro";
import { allPages } from "../lib/routes";
import { absolute } from "../lib/site";
import { isTranslatedPage } from "../lib/paths";
import { HTML_LANG, LOCALES, localePath } from "../i18n/locales";

// Every page, and every language version of the translated ones. Each version
// lists all the others (hreflang), as search engines ask for.
export const GET: APIRoute = ({ site }) => {
  const entry = (path: string) => {
    if (!isTranslatedPage(path)) return `  <url><loc>${absolute(path, site)}</loc></url>`;
    const alternates = [
      ...LOCALES.map((l) => `    <xhtml:link rel="alternate" hreflang="${HTML_LANG[l]}" href="${absolute(localePath(path, l), site)}"/>`),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${absolute(path, site)}"/>`,
    ].join("\n");
    return LOCALES.map((l) => `  <url>\n    <loc>${absolute(localePath(path, l), site)}</loc>\n${alternates}\n  </url>`).join("\n");
  };
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${allPages().map(entry).join("\n")}\n</urlset>\n`,
    { headers: { "Content-Type": "application/xml; charset=utf-8" } },
  );
};
