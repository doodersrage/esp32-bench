// Upload a built firmware library (see build-firmware-library.mjs) to the
// site's API, which stores it in R2 behind https://fw.esp32bench.dev/.
//
//   FW_UPLOAD_TOKEN=<GitHub Actions OIDC token> node scripts/upload-firmware-library.mjs [--dir .firmware-library] [--api https://api.esp32bench.dev]
//
// Each file is PUT to <api>/fw/<key> with the token as a Bearer; the API checks
// the token came from this repository's main branch. index.json goes last, so a
// reader never sees an index that points at files not uploaded yet. Refuses to
// run without an index.json (the builder writes one only when every build passed).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const dir = resolve(opt("--dir", ".firmware-library"));
const api = opt("--api", process.env.FW_API ?? "https://api.esp32bench.dev").replace(/\/$/, "");
const token = process.env.FW_UPLOAD_TOKEN;
if (!token) {
  console.error("FW_UPLOAD_TOKEN is not set.");
  process.exit(2);
}
if (!existsSync(join(dir, "index.json"))) {
  console.error(`${dir} has no index.json: the build did not finish cleanly, nothing uploaded.`);
  process.exit(2);
}

function walk(d) {
  return readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const files = walk(dir)
  .map((p) => relative(dir, p).split("\\").join("/"))
  .filter((k) => k !== "index.json")
  .sort();
files.push("index.json");

const type = (key) => (key.endsWith(".json") ? "application/json" : "application/octet-stream");

async function put(key, attempt = 1) {
  const body = readFileSync(join(dir, key));
  try {
    const res = await fetch(`${api}/fw/${key}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": type(key) },
      body,
      signal: AbortSignal.timeout(60_000),
    });
    if (res.status === 401 || res.status === 403) throw Object.assign(new Error(`${res.status}: ${(await res.text()).slice(0, 200)}`), { fatal: true });
    if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 200)}`);
    return body.length;
  } catch (e) {
    if (e.fatal || attempt >= 4) throw e;
    const wait = 1000 * 2 ** attempt;
    console.log(`  retry ${attempt} for ${key} in ${wait / 1000} s: ${e.message}`);
    await new Promise((r) => setTimeout(r, wait));
    return put(key, attempt + 1);
  }
}

let bytes = 0;
let done = 0;
try {
  for (const key of files) {
    const size = await put(key);
    bytes += size;
    done++;
    console.log(`up  ${key} (${(size / 1024).toFixed(0)} KB)`);
  }
} catch (e) {
  console.error(`\nUpload failed after ${done} of ${files.length} files: ${e.message}`);
  console.error(done < files.length - 1 ? "index.json was not uploaded, so the published library is unchanged." : "");
  process.exit(1);
}
console.log(`\nUploaded ${files.length} files, ${(bytes / 1024 / 1024).toFixed(1)} MB, to ${api}/fw/`);
