// Browser smoke test: serve the built site, load one page of each kind in
// headless Chrome, and fail on any uncaught script error or a missing file
// from this site. Outside requests (API, firmware, comments) may fail offline;
// the pages are written to cope, so those are not errors.
//
//   npx astro build && node scripts/smoke-pages.mjs
//
// Needs Chrome or Chromium: CHROME=/path/to/chrome, or google-chrome,
// chromium or chromium-browser on PATH. No npm packages: Chrome is driven
// over the DevTools protocol with Node's own WebSocket.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, extname, normalize } from "node:path";

const DIST = new URL("../dist/", import.meta.url).pathname;
const PAGES = [
  "/",
  "/start/",
  "/projects/rfid-reader/",
  "/projects/probeharbor-probe/",
  "/projects/nrf24-link/",
  "/boards/",
  "/boards/esp32/",
  "/boards/esp32c3-supermini/",
  "/boards/compare/",
  "/boards/matrix/",
  "/wire/",
  "/detective/",
  "/bench/",
  "/bench/?sample=dht22",
  "/errors/",
  "/errors/brownout-detector-was-triggered/",
  "/flames/",
  "/tools/",
  "/tools/backtrace/",
  "/tools/build/",
  "/tools/flash/",
  "/tools/partitions/",
  "/shop/",
  "/search/?q=oled",
  "/changes/",
  "/about/",
  "/report/",
  "/does-not-exist/",
  // Translated pages: each language and each kind of page at least once.
  "/de/",
  "/de/projects/rfid-reader/",
  "/de/wire/",
  "/de/bench/?sample=dht22",
  "/de/tools/partitions/",
  "/de/shop/",
  "/fr/detective/",
  "/fr/tools/flash/",
  "/fr/tools/backtrace/",
  "/fr/projects/probeharbor-probe/",
  "/es/report/",
  "/es/start/",
  "/es/about/",
  "/es/tools/",
  "/pt-br/search/?q=oled",
  "/pt-br/projects/nrf24-link/",
  "/pt-br/tools/build/",
];
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
  ".xml": "application/xml",
  ".txt": "text/plain",
};

// --- Static server for dist/, like the production host: /path/ serves /path/index.html, unknown paths the 404 page.
async function fileFor(pathname) {
  const clean = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  for (const candidate of [join(DIST, clean), join(DIST, clean, "index.html")]) {
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {
      // Try the next one.
    }
  }
  return null;
}
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const file = await fileFor(url.pathname);
  const target = file ?? join(DIST, "404.html");
  res.writeHead(file ? 200 : 404, { "Content-Type": TYPES[extname(target)] ?? "application/octet-stream" });
  res.end(await readFile(target));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

// --- Chrome
function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  for (const name of ["google-chrome", "chromium", "chromium-browser"]) {
    try {
      return execFileSync("which", [name], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch {
      // Not installed.
    }
  }
  throw new Error("No Chrome found. Set CHROME to its path.");
}
const profile = mkdtempSync(join(tmpdir(), "smoke-"));
const chrome = spawn(findChrome(), ["--headless=new", "--disable-gpu", "--no-sandbox", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], {
  stdio: ["ignore", "ignore", "pipe"],
});
const wsUrl = await new Promise((resolve, reject) => {
  let err = "";
  chrome.stderr.on("data", (d) => {
    err += d;
    const m = /DevTools listening on (ws:\/\/\S+)/.exec(err);
    if (m) resolve(m[1]);
  });
  chrome.on("exit", () => reject(new Error(`Chrome exited:\n${err}`)));
  setTimeout(() => reject(new Error("Chrome did not start")), 20000);
});

const browser = new WebSocket(wsUrl);
await new Promise((r) => browser.addEventListener("open", r));
let nextId = 0;
const pending = new Map();
const listeners = [];
browser.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  } else if (m.method) {
    for (const l of listeners) l(m);
  }
});
const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
    browser.send(JSON.stringify({ id, method, params, sessionId }));
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
for (const domain of ["Page", "Runtime", "Network", "Log"]) await send(`${domain}.enable`, {}, sessionId);

let problems = [];
listeners.push((m) => {
  if (m.sessionId !== sessionId) return;
  if (m.method === "Runtime.exceptionThrown") {
    const d = m.params.exceptionDetails;
    problems.push(`uncaught: ${d.exception?.description?.split("\n")[0] ?? d.text} (${d.url ?? ""}:${d.lineNumber})`);
  }
  if (m.method === "Network.responseReceived") {
    const { url, status } = m.params.response;
    // The 404 test page is meant to be a 404.
    if (url.startsWith(origin) && status >= 400 && !url.includes("/does-not-exist/")) problems.push(`HTTP ${status}: ${url.slice(origin.length)}`);
  }
  if (m.method === "Network.loadingFailed" && m.params.type !== "Other") {
    // Same-site files only; outside services may be unreachable from CI.
    const url = m.params.requestUrl ?? "";
    if (url.startsWith(origin)) problems.push(`failed to load: ${url.slice(origin.length)} (${m.params.errorText})`);
  }
});

let failed = 0;
for (const page of PAGES) {
  problems = [];
  await send("Page.navigate", { url: origin + page }, sessionId);
  await sleep(2500);
  // Every page has the site header; a blank or half-rendered page does not.
  const { result } = await send("Runtime.evaluate", { expression: "Boolean(document.querySelector('header.top .brand') && document.querySelector('main'))", returnByValue: true }, sessionId);
  if (!result.value) problems.push("page did not render the header and main content");
  if (problems.length) {
    failed++;
    console.log(`FAIL ${page}`);
    for (const p of [...new Set(problems)]) console.log(`  ${p}`);
  } else {
    console.log(`ok   ${page}`);
  }
}

browser.close();
await new Promise((r) => {
  chrome.once("exit", r);
  chrome.kill();
  setTimeout(r, 5000);
});
server.close();
try {
  rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
} catch {
  // A leftover temp profile is harmless.
}
console.log(failed ? `\n${failed} of ${PAGES.length} pages had problems.` : `\nAll ${PAGES.length} pages loaded without script errors.`);
process.exit(failed ? 1 : 0);
