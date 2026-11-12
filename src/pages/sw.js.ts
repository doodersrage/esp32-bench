// Service worker, generated at build time so each deploy gets a new cache version
// and an up-to-date list of pages to keep for offline use.
import type { APIRoute } from "astro";
import { allPages } from "../lib/routes";
import { link } from "../lib/paths";

export const GET: APIRoute = () => {
  const version = new Date().toISOString();
  // The search index is kept too, so search works offline.
  const pages = [...allPages(), "/offline/", "/search-index.json"].map(link);
  const body = `// ESP32 Bench service worker, built ${version}
const VERSION = ${JSON.stringify(version)};
const PAGES = "pages-" + VERSION;
const FILES = "files-" + VERSION;
const ASSETS = "assets"; // hashed build files never change, so they outlive versions
const FONTS = "fonts";
const PRECACHE = ${JSON.stringify(pages)};
const OFFLINE = ${JSON.stringify(link("/offline/"))};
const HASHED = ${JSON.stringify(link("/_astro/"))};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PAGES).then((cache) =>
      Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => undefined))),
    ).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([PAGES, FILES, ASSETS, FONTS]);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, cacheName, fallback) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const hit = (await caches.match(request, { ignoreSearch: true })) || (fallback && (await caches.match(fallback)));
    return hit || Response.error();
  }
}

async function cacheFirst(request, cacheName) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok || response.type === "opaque") (await caches.open(cacheName)).put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || request.headers.has("range")) return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (request.mode === "navigate") event.respondWith(networkFirst(request, PAGES, OFFLINE));
    else if (url.pathname.startsWith(HASHED)) event.respondWith(cacheFirst(request, ASSETS));
    else event.respondWith(networkFirst(request, FILES));
  } else if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(cacheFirst(request, FONTS));
  }
});
`;
  return new Response(body, { headers: { "Content-Type": "text/javascript; charset=utf-8" } });
};
