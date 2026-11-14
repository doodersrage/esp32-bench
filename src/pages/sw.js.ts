// Service worker, generated at build time so each deploy gets a new cache version
// and an up-to-date list of pages to keep for offline use.
//
// Offline use:
// - On install it saves every English page, the search index, and every script
//   and style those pages load (found by reading the pages and following the
//   scripts' imports), so the tools work offline, not just the reading.
// - A page in another language asks for its language's pages ("warm"); they
//   are saved the same way, once per deploy.
// - "Keep for offline" on a project page ("keep") saves that project's
//   firmware for every board, its manifests and preview, and the page itself
//   in the visitor's language. Kept files live in caches that survive deploys
//   and refresh themselves whenever they are fetched online.
import type { APIRoute } from "astro";
import { allPages } from "../lib/routes";
import { link, isTranslatedPage } from "../lib/paths";
import { SITE } from "../lib/site";
import { LOCALES, localePath } from "../i18n/locales";

export const GET: APIRoute = () => {
  const version = new Date().toISOString();
  // The search index is kept too, so search works offline.
  const pages = [...allPages(), "/offline/", "/search-index.json"].map(link);
  const byLocale = Object.fromEntries(
    LOCALES.filter((l) => l !== "en").map((l) => [l, [...allPages().filter(isTranslatedPage), "/offline/"].map((p) => link(localePath(p, l)))]),
  );
  const body = `// ESP32 Bench service worker, built ${version}
const VERSION = ${JSON.stringify(version)};
const PAGES = "pages-" + VERSION;
const FILES = "files-" + VERSION;
const ASSETS = "assets"; // hashed build files never change, so they outlive versions
const FONTS = "fonts";
const KEPT_FW = "kept-firmware"; // "Keep for offline": survives deploys
const KEPT_PAGES = "kept-pages";
const PRECACHE = ${JSON.stringify(pages)};
const BY_LOCALE = ${JSON.stringify(byLocale)};
const OFFLINE = ${JSON.stringify(link("/offline/"))};
const LOCALE_PREFIX = new RegExp("^" + ${JSON.stringify(link("/"))} + "(" + ${JSON.stringify(LOCALES.filter((l) => l !== "en").join("|"))} + ")/");
// The offline page in the language of the page that was asked for.
const offlineFor = (url) => {
  const m = LOCALE_PREFIX.exec(url.pathname);
  return m ? ${JSON.stringify(link("/"))} + m[1] + "/offline/" : OFFLINE;
};
const HASHED = ${JSON.stringify(link("/_astro/"))};
const FW = ${JSON.stringify(SITE.fwBase)};

// Every /_astro/ file a set of pages needs: the ones the HTML names, then the
// chunks those scripts import ("./chunk.js"), and so on.
async function saveAssets(htmls) {
  const cache = await caches.open(ASSETS);
  const seen = new Set();
  const queue = [];
  const add = (url) => {
    if (!seen.has(url)) {
      seen.add(url);
      queue.push(url);
    }
  };
  for (const html of htmls) for (const m of html.matchAll(/(?:src|href)="([^"]*\\/_astro\\/[^"]+\\.(?:js|css))"/g)) add(new URL(m[1], self.location.origin).href);
  while (queue.length) {
    const url = queue.shift();
    let response = await cache.match(url, { ignoreVary: true });
    if (!response) {
      try {
        response = await fetch(url);
        if (!response.ok) continue;
        await cache.put(url, response.clone());
      } catch {
        continue;
      }
    }
    if (url.endsWith(".js")) {
      const text = await response.text();
      for (const m of text.matchAll(/["'](\\.\\.?\\/[\\w.-]+\\.(?:js|css))["']/g)) add(new URL(m[1], url).href);
      for (const m of text.matchAll(/["'](\\/_astro\\/[\\w.-]+\\.(?:js|css))["']/g)) add(new URL(m[1], self.location.origin).href);
    }
  }
}

// Save pages into a cache and return their HTML, for saveAssets.
async function savePages(cacheName, urls) {
  const cache = await caches.open(cacheName);
  const htmls = [];
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      await cache.put(url, response.clone());
      if ((response.headers.get("content-type") || "").includes("html")) htmls.push(await response.text());
    } catch {
      // Offline or a bad page: the rest still get saved.
    }
  }
  return htmls;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    savePages(PAGES, PRECACHE)
      .then((htmls) => saveAssets(htmls))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([PAGES, FILES, ASSETS, FONTS, KEPT_FW, KEPT_PAGES]);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Firmware the visitor kept: everything it needs to flash one project offline.
async function keepProject(project, pageUrl) {
  const cache = await caches.open(KEPT_FW);
  const files = [];
  const put = async (url) => {
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) throw new Error(url + " " + response.status);
    await cache.put(url, response.clone());
    files.push(url);
    return response;
  };
  const index = await (await put(FW + "/index.json")).json();
  const entry = index.projects && index.projects[project];
  if (!entry) throw new Error("not in the firmware library");
  const manifests = new Set([entry.manifest, ...Object.values(entry.manifests || {})].filter(Boolean));
  for (const path of manifests) {
    const url = FW + "/" + path;
    const manifest = await (await put(url)).json();
    for (const build of manifest.builds || []) for (const part of build.parts || []) await put(new URL(part.path, url).href);
  }
  try {
    await put(FW + "/" + project + "/preview.json");
  } catch {
    // Not every project has a preview.
  }
  const htmls = await savePages(KEPT_PAGES, [pageUrl]);
  await saveAssets(htmls);
  let bytes = 0;
  for (const url of files) {
    const hit = await cache.match(url);
    if (hit) bytes += (await hit.clone().arrayBuffer()).byteLength;
  }
  return { files: files.length, bytes };
}

async function dropProject(project) {
  const fw = await caches.open(KEPT_FW);
  for (const request of await fw.keys()) if (new URL(request.url).pathname.startsWith("/" + project + "/")) await fw.delete(request);
  const pages = await caches.open(KEPT_PAGES);
  for (const request of await pages.keys()) if (new URL(request.url).pathname.endsWith("/projects/" + project + "/")) await pages.delete(request);
  // index.json is shared: drop it with the last kept project.
  const left = (await fw.keys()).filter((r) => !r.url.endsWith("/index.json"));
  if (left.length === 0) await fw.delete(FW + "/index.json");
}

const warmed = new Set();
self.addEventListener("message", (event) => {
  const data = event.data || {};
  const reply = (message) => event.ports[0] && event.ports[0].postMessage(message);
  if (data.type === "keep") {
    event.waitUntil(keepProject(data.project, data.page).then((r) => reply({ ok: true, ...r }), (e) => reply({ ok: false, error: String(e && e.message || e) })));
  } else if (data.type === "drop") {
    event.waitUntil(dropProject(data.project).then(() => reply({ ok: true }), (e) => reply({ ok: false, error: String(e) })));
  } else if (data.type === "warm" && BY_LOCALE[data.locale] && !warmed.has(data.locale)) {
    warmed.add(data.locale);
    event.waitUntil(
      caches.open(PAGES).then(async (cache) => {
        const missing = [];
        for (const url of BY_LOCALE[data.locale]) if (!(await cache.match(url))) missing.push(url);
        await saveAssets(await savePages(PAGES, missing));
      }),
    );
  }
});

async function networkFirst(request, cacheName, fallback) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
      // A kept page stays current while online.
      const kept = await caches.open(KEPT_PAGES);
      if (await kept.match(request, { ignoreSearch: true, ignoreVary: true })) kept.put(request, response.clone());
    }
    return response;
  } catch {
    const hit = (await caches.match(request, { ignoreSearch: true, ignoreVary: true })) || (fallback && ((await caches.match(fallback, { ignoreVary: true })) || (await caches.match(OFFLINE, { ignoreVary: true }))));
    return hit || Response.error();
  }
}

async function cacheFirst(request, cacheName) {
  const hit = await caches.match(request, { ignoreVary: true });
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok || response.type === "opaque") (await caches.open(cacheName)).put(request, response.clone());
  return response;
}

// Firmware: always the newest online; the kept copy offline, refreshed whenever fetched.
async function firmware(request) {
  const kept = await caches.open(KEPT_FW);
  try {
    const response = await fetch(request);
    if (response.ok && (await kept.match(request.url, { ignoreSearch: true, ignoreVary: true }))) await kept.put(request.url, response.clone());
    return response;
  } catch {
    return (await kept.match(request.url, { ignoreSearch: true, ignoreVary: true })) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || request.headers.has("range")) return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (request.mode === "navigate") event.respondWith(networkFirst(request, PAGES, offlineFor(url)));
    else if (url.pathname.startsWith(HASHED)) event.respondWith(cacheFirst(request, ASSETS));
    else event.respondWith(networkFirst(request, FILES));
  } else if (url.origin === FW && !url.pathname.startsWith("/elf/")) {
    event.respondWith(firmware(request));
  } else if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(cacheFirst(request, FONTS));
  }
});
`;
  return new Response(body, { headers: { "Content-Type": "text/javascript; charset=utf-8" } });
};
