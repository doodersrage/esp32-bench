// Tell IndexNow search engines (Bing, Yandex, Seznam, Naver) which pages exist,
// so new and changed pages are crawled within hours. Runs after `npm run deploy`.
// The key is public on purpose: search engines fetch /<key>.txt to check it.
import { readdirSync, readFileSync } from "node:fs";

const dist = new URL("../dist/", import.meta.url);
const keyFile = readdirSync(new URL("../public/", import.meta.url)).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) throw new Error("No IndexNow key file in public/");
const key = keyFile.slice(0, -4);

const sitemap = readFileSync(new URL("sitemap.xml", dist), "utf8");
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const host = new URL(urls[0]).host;

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host, key, keyLocation: `https://${host}/${keyFile}`, urlList: urls }),
});
console.log(`IndexNow: sent ${urls.length} URLs for ${host}, answer ${res.status} ${res.statusText}`);
if (res.status >= 400) process.exitCode = 1;
