// Check every outside link on the built site. Run after `npx astro build`.
//
//   node scripts/check-links.mjs
//
// Broken links (404, 410, unknown host) fail the check. Shops and sites that turn
// away automated requests (403, 429, 503) are listed as warnings, not failures.
// Writes link-report.md (and the GitHub job summary).
import { appendFileSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SITE_HOSTS = new Set(["esp32bench.dev", "www.esp32bench.dev", "api.esp32bench.dev"]);
const SKIP_HOSTS = new Set(["fonts.googleapis.com", "fonts.gstatic.com", "challenges.cloudflare.com", "analytics.ahrefs.com"]);
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? htmlFiles(p) : p.endsWith(".html") ? [p] : [];
  });
}

const pagesFor = new Map();
for (const file of htmlFiles("dist")) {
  const page = "/" + file.slice("dist/".length).replace(/index\.html$/, "");
  const html = readFileSync(file, "utf8");
  for (const [, raw] of html.matchAll(/<a\s[^>]*href="(https?:\/\/[^"]+)"/g)) {
    const href = raw.replace(/&amp;/g, "&");
    let url;
    try {
      url = new URL(href);
    } catch {
      continue;
    }
    if (SITE_HOSTS.has(url.hostname) || SKIP_HOSTS.has(url.hostname)) continue;
    url.hash = "";
    const key = url.href;
    if (!pagesFor.has(key)) pagesFor.set(key, new Set());
    pagesFor.get(key).add(page);
  }
}

async function check(url) {
  for (const method of ["HEAD", "GET"]) {
    try {
      const res = await fetch(url, { method, redirect: "follow", headers: { "User-Agent": UA, Accept: "text/html,*/*" }, signal: AbortSignal.timeout(20_000) });
      if (res.ok) return { status: res.status, verdict: "ok" };
      if (method === "HEAD" && [400, 403, 405, 429, 501, 503].includes(res.status)) continue; // some servers refuse HEAD
      if ([404, 410].includes(res.status)) return { status: res.status, verdict: "broken" };
      return { status: res.status, verdict: "warn" };
    } catch (e) {
      const code = e?.cause?.code ?? e?.name ?? "error";
      if (method === "HEAD") continue;
      return { status: code, verdict: code === "ENOTFOUND" ? "broken" : "warn" };
    }
  }
  return { status: "?", verdict: "warn" };
}

const urls = [...pagesFor.keys()].sort();
const results = [];
for (let i = 0; i < urls.length; i += 6) {
  results.push(...(await Promise.all(urls.slice(i, i + 6).map(async (u) => ({ url: u, ...(await check(u)) })))));
}

const broken = results.filter((r) => r.verdict === "broken");
const warn = results.filter((r) => r.verdict === "warn");
const where = (u) => [...pagesFor.get(u)].slice(0, 4).join(", ") + (pagesFor.get(u).size > 4 ? ", ..." : "");
const report = [
  `## Link check`,
  ``,
  `${results.length} outside links: ${results.length - broken.length - warn.length} fine, ${broken.length} broken, ${warn.length} could not be confirmed.`,
  ``,
  ...(broken.length ? ["### Broken", "", "| Link | Status | On |", "|---|---|---|", ...broken.map((r) => `| ${r.url} | ${r.status} | ${where(r.url)} |`), ""] : []),
  ...(warn.length ? ["### Could not confirm (often a shop blocking bots)", "", "| Link | Status | On |", "|---|---|---|", ...warn.map((r) => `| ${r.url} | ${r.status} | ${where(r.url)} |`), ""] : []),
].join("\n");
writeFileSync("link-report.md", report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
console.log(report);
process.exit(broken.length ? 1 : 0);
