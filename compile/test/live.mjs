// Exercises a running compile service with the payloads from make-payloads.py.
//
//   node test/live.mjs <base-url> <payload-dir> [--origin https://esp32bench.dev] [--resolve <ip>]
//
// --resolve sends the requests with curl pinned to that address, for a host name
// the local resolver does not know yet.
//
// For each payload it posts to /compile, checks the answer, and for successful
// builds decodes the image and verifies the bootloader magic (0xE9) at the chip's
// bootloader offset and the app magic at 0x10000. Prints timings.
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const [base, dir] = process.argv.slice(2);
const originIdx = process.argv.indexOf("--origin");
const origin = originIdx > 0 ? process.argv[originIdx + 1] : "";
const resolveIdx = process.argv.indexOf("--resolve");
const resolveIp = resolveIdx > 0 ? process.argv[resolveIdx + 1] : "";

async function post(url, body) {
	if (!resolveIp) {
		const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) }, body });
		return { status: res.status, out: await res.json().catch(() => ({})) };
	}
	const u = new URL(url);
	const raw = execFileSync("curl", ["-s", "-w", "\\n%{http_code}", "--max-time", "300", "--resolve", `${u.hostname}:443:${resolveIp}`, "-X", "POST",
		"-H", "Content-Type: application/json", ...(origin ? ["-H", `Origin: ${origin}`] : []), "--data-binary", "@-", url], { input: body, maxBuffer: 64 * 1024 * 1024 }).toString();
	const cut = raw.lastIndexOf("\n");
	let out = {};
	try { out = JSON.parse(raw.slice(0, cut)); } catch {}
	return { status: Number(raw.slice(cut + 1)), out };
}
if (!base || !dir) {
	console.error("usage: node test/live.mjs <base-url> <payload-dir> [--origin <origin>]");
	process.exit(2);
}
const BOOT = { esp32: 0x1000, esp32s2: 0x1000, esp32s3: 0, esp32c3: 0, esp32c6: 0 };
let failed = 0;

for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
	const body = readFileSync(join(dir, file), "utf8");
	const started = Date.now();
	const { status, out } = await post(`${base}/compile`, body);
	const res = { status };
	const secs = ((Date.now() - started) / 1000).toFixed(1);
	const expectFail = file.startsWith("broken");
	let verdict;
	if (out.ok) {
		const image = Buffer.from(out.image_b64 ?? "", "base64");
		const chip = out.chip ?? JSON.parse(body).board;
		const bootOk = image[BOOT[chip] ?? 0] === 0xe9;
		const appOk = image[0x10000] === 0xe9;
		verdict = bootOk && appOk ? `image ${image.length} B, bootloader and app magic ok` : `BAD IMAGE (boot ${bootOk}, app ${appOk})`;
		if (!(bootOk && appOk) || expectFail) failed++;
		if (image.length !== out.image_bytes) {
			verdict += ` (image_bytes mismatch ${out.image_bytes})`;
			failed++;
		}
	} else {
		const first = out.errors?.[0];
		verdict = `not ok: ${first ? `${first.file}:${first.line}:${first.col} ${first.message}` : out.failure || out.error || "?"}`;
		if (!expectFail) failed++;
		if (expectFail && !(first && first.inSketch && first.line > 0)) failed++;
	}
	const sizes = out.sizes ? ` flash ${out.sizes.flashUsed}/${out.sizes.flashTotal}` : "";
	console.log(`${file.padEnd(20)} HTTP ${res.status} ${secs}s (build ${out.seconds ?? "?"}s, core ${out.core ?? "?"})${sizes}: ${verdict}`);
}
process.exit(failed ? 1 : 0);
