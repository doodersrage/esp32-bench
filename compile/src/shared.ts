// Pure parts of the compile service: request validation, compiler output
// parsing and the daily quota arithmetic. Node-testable, no Workers APIs.
import libList from "../container/compile-libs.json" with { type: "json" };

export const BOARDS = ["esp32", "esp32s3", "esp32c3", "esp32s2", "esp32c6", "xiao-esp32c3", "xiao-esp32s3", "esp32-cam"] as const;
export type BoardId = (typeof BOARDS)[number];

export const CHIP: Record<BoardId, string> = {
	esp32: "esp32",
	esp32s3: "esp32s3",
	esp32c3: "esp32c3",
	esp32s2: "esp32s2",
	esp32c6: "esp32c6",
	"xiao-esp32c3": "esp32c3",
	"xiao-esp32s3": "esp32s3",
	"esp32-cam": "esp32",
};

/** Site library names the container has installed: the site's src/data/compile-libs.json, copied by scripts/sync-libs.mjs. */
export const LIBS: string[] = Object.keys(libList.libs);

export const MAX_CODE_BYTES = 150_000;
export const MAX_BODY_BYTES = 200_000;

export interface CompileRequest {
	board: BoardId;
	code: string;
	libs: string[];
	partitions?: "huge_app";
}

export type Checked = { ok: true; request: CompileRequest } | { ok: false; status: number; error: string };

export function checkRequest(body: unknown): Checked {
	if (!body || typeof body !== "object") return { ok: false, status: 400, error: "Send the build request as JSON." };
	const b = body as Record<string, unknown>;
	const board = String(b.board ?? "");
	if (!(BOARDS as readonly string[]).includes(board)) return { ok: false, status: 400, error: `Unknown board "${board}".` };
	if (typeof b.code !== "string" || b.code.trim() === "") return { ok: false, status: 400, error: "The sketch is empty." };
	if (new TextEncoder().encode(b.code).length > MAX_CODE_BYTES) return { ok: false, status: 413, error: "The sketch is too long (150 KB max)." };
	const libs = Array.isArray(b.libs) ? b.libs.map(String) : [];
	const unknown = libs.filter((l) => !LIBS.includes(l) && !/built in/i.test(l));
	if (unknown.length) return { ok: false, status: 400, error: `Unknown library: ${unknown.join(", ")}. Only the libraries used by the site's projects are available.` };
	if (b.partitions !== undefined && b.partitions !== "huge_app") return { ok: false, status: 400, error: 'partitions may only be "huge_app".' };
	return {
		ok: true,
		request: { board: board as BoardId, code: b.code, libs: libs.filter((l) => !/built in/i.test(l)), ...(b.partitions === "huge_app" ? { partitions: "huge_app" as const } : {}) },
	};
}

export interface Diagnostic {
	file: string;
	line: number;
	col: number;
	message: string;
	/** True when the message is about the visitor's sketch rather than a library or the core */
	inSketch: boolean;
}

export interface Sizes {
	flashUsed: number;
	flashTotal: number;
	ramUsed: number;
	ramTotal: number;
}

export interface ParsedBuild {
	errors: Diagnostic[];
	warnings: Diagnostic[];
	sizes: Sizes | null;
	core: string;
	/** A short reason when there are no parsed errors but the build failed */
	failure: string;
}

const DIAG = /^\s*([^\s:][^:]*\.(?:ino|cpp|c|h|hpp)):(\d+):(\d+):\s+(error|warning|fatal error):\s+(.*)$/;

/** "main.ino" for the visitor's sketch wherever the build put it, otherwise the file's base name. */
function shortFile(path: string): string {
	if (/(^|\/)src\/main\.ino$/.test(path) || path === "main.ino") return "main.ino";
	return path.slice(path.lastIndexOf("/") + 1);
}

/** Parse PlatformIO/GCC output into sketch-relative diagnostics and sizes. */
export function parseBuild(log: string): ParsedBuild {
	const errors: Diagnostic[] = [];
	const warnings: Diagnostic[] = [];
	const seen = new Set<string>();
	for (const raw of log.split("\n")) {
		const line = raw.replace(/\x1b\[[0-9;]*m/g, "").trimEnd();
		const m = DIAG.exec(line);
		if (!m) continue;
		const file = shortFile(m[1]);
		const d: Diagnostic = { file, line: Number(m[2]), col: Number(m[3]), message: m[5].trim(), inSketch: file === "main.ino" };
		const key = `${m[4]}|${file}|${d.line}|${d.col}|${d.message}`;
		if (seen.has(key)) continue;
		seen.add(key);
		(m[4] === "warning" ? warnings : errors).push(d);
	}
	const flash = /Flash:\s*\[[^\]]*\]\s*[\d.]+%\s*\(used (\d+) bytes from (\d+) bytes\)/.exec(log);
	const ram = /RAM:\s*\[[^\]]*\]\s*[\d.]+%\s*\(used (\d+) bytes from (\d+) bytes\)/.exec(log);
	const sizes = flash && ram ? { flashUsed: +flash[1], flashTotal: +flash[2], ramUsed: +ram[1], ramTotal: +ram[2] } : null;
	const core = /framework-arduinoespressif32\s*@\s*([\w.+-]+)/.exec(log)?.[1] ?? "";
	let failure = "";
	if (errors.length === 0) {
		if (/region `?iram0_0_seg'? overflowed|section `?\.iram0\.text'? will not fit|overflowed by \d+ bytes/.test(log)) failure = "The program does not fit in the chip's instruction memory.";
		else if (/program size .* is greater than maximum allowed|Error: The program size .* exceeds/i.test(log)) failure = "The program is bigger than the app partition. Try the huge_app partition table.";
		else if (/undefined reference to/.test(log)) failure = "Linking failed: " + (/undefined reference to `([^']+)'/.exec(log)?.[1] ?? "a symbol is missing");
		else if (/\*\*\* Build stopped after/.test(log)) failure = "The build took too long and was stopped.";
		else if (/No such file or directory/.test(log)) failure = /fatal error: ([^\n]+)/.exec(log)?.[1]?.trim() ?? "A header could not be found.";
	}
	return { errors, warnings, sizes, core, failure };
}

/** UTC day key for quota counters. */
export const dayKey = (now: Date) => now.toISOString().slice(0, 10);

export const QUOTA = { perIpPerDay: 40, globalPerDay: 600 };

export function quotaDecision(ipCount: number, globalCount: number, q = QUOTA): { allowed: boolean; reason: string } {
	if (globalCount >= q.globalPerDay) return { allowed: false, reason: "The build service has reached its daily limit. Please try again tomorrow, or build with the Arduino IDE." };
	if (ipCount >= q.perIpPerDay) return { allowed: false, reason: `You have used today's ${q.perIpPerDay} builds. Please try again tomorrow, or build with the Arduino IDE.` };
	return { allowed: true, reason: "" };
}

/** Seconds until the next UTC midnight, for counter expiry. */
export function secondsToMidnight(now: Date): number {
	const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
	return Math.max(60, Math.ceil((next - now.getTime()) / 1000));
}
