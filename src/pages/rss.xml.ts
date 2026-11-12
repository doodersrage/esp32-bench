import type { APIRoute } from "astro";
import { CHANGES } from "../data/changes";
import { SITE, absolute } from "../lib/site";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const GET: APIRoute = ({ site }) => {
  const items = CHANGES.map((c) => {
    const body = `<p>${esc(c.summary)}</p><ul>${c.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
    return `    <item>
      <title>${esc(c.title)}</title>
      <link>${absolute(c.link, site)}</link>
      <guid isPermaLink="false">${absolute("/changes/", site)}#${c.id}</guid>
      <pubDate>${new Date(`${c.date}T12:00:00Z`).toUTCString()}</pubDate>
      <description>${esc(body)}</description>
    </item>`;
  }).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(SITE.name)}: what's new</title>
    <link>${absolute("/", site)}</link>
    <atom:link href="${absolute("/rss.xml", site)}" rel="self" type="application/rss+xml" />
    <description>${esc(SITE.description)}</description>
    <language>en</language>
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
};
