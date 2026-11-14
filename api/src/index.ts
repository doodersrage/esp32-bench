// esp32-bench-api: POST /report from esp32bench.dev, emailed to the owner.
import { env } from "cloudflare:workers";
import { checkReport, htmlFor, subjectFor, textFor } from "./report.ts";
import { verifyTurnstile } from "./turnstile.ts";
import { uploadFirmware } from "./firmware.ts";
import { moderationPage, newToken, publicBuild, resultPage, sameHash, sha256, summarise, type BuildRow } from "./builds.ts";
import { checkLabRun, publicLab, tokenMatches, type LabResultRow, type LabRunRow } from "./lab.ts";
import { checkSyncData, codeFrom, newSyncCode } from "./sync.ts";
import {
	accountKey,
	authorizeUrl,
	clearStateCookie,
	githubAccountId,
	newSessionKey,
	readStateCookie,
	safeReturn,
	sessionKeyFrom,
	stateCookie,
} from "./github-auth.ts";

interface Env {
	EMAIL: SendEmail;
	LIMIT: RateLimit;
	DB: D1Database;
	FIRMWARE: R2Bucket;
	ALLOWED_ORIGINS: string;
	SENDER: string;
	TURNSTILE_HOSTNAMES: string;
	TURNSTILE_SECRET?: string;
	/** Verified Email Routing destination, set as a Worker secret */
	REPORT_TO?: string;
	/** Bearer token the hardware lab runner posts with, set as a Worker secret */
	LAB_TOKEN?: string;
	/** GitHub OAuth App for "Sign in with GitHub" (sync), set as Worker secrets */
	GITHUB_CLIENT_ID?: string;
	GITHUB_CLIENT_SECRET?: string;
}

const config = env as unknown as Env;

function cors(origin: string | null): Record<string, string> {
	const allowed = config.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
	if (!origin || !allowed.includes(origin)) return {};
	return {
		"Access-Control-Allow-Origin": origin,
		"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type, Authorization",
		"Access-Control-Max-Age": "86400",
		Vary: "Origin",
	};
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
	});
}

const API_ORIGIN = "https://api.esp32bench.dev";
const SITE = "https://esp32bench.dev";

function html(body: string, status = 200): Response {
	return new Response(body, {
		status,
		headers: {
			"Content-Type": "text/html; charset=utf-8",
			"Cache-Control": "no-store",
			"X-Robots-Tag": "noindex",
			"Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'",
			"Referrer-Policy": "no-referrer",
		},
	});
}

/** GET /builds/summary: approved build reports counted per project and board, for the compatibility table. */
async function buildsSummary(): Promise<Response> {
	const headers = { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" };
	const { results } = await config.DB.prepare("SELECT project, board, result FROM builds WHERE status = 'approved'").all<Pick<BuildRow, "project" | "board" | "result">>();
	return json({ cells: summarise(results) }, 200, headers);
}

/** GET /builds?project=dht22: approved build reports, public and cacheable. */
async function listBuilds(url: URL): Promise<Response> {
	const project = url.searchParams.get("project") ?? "";
	const headers = { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=60" };
	if (!/^[a-z0-9-]{1,60}$/.test(project)) return json({ builds: [] }, 400, headers);
	const { results } = await config.DB.prepare(
		"SELECT * FROM builds WHERE project = ? AND status = 'approved' ORDER BY created_at DESC LIMIT 50",
	)
		.bind(project)
		.all<BuildRow>();
	return json({ builds: results.map(publicBuild), lab: await latestLab(project) }, 200, headers);
}

/** The latest hardware lab run that covered a project, shaped for the page; null when none. */
async function latestLab(project: string) {
	const run = await config.DB.prepare(
		`SELECT r.id, r.finished_at, r.core, r.firmware_built_at FROM lab_runs r
		 WHERE EXISTS (SELECT 1 FROM lab_results x WHERE x.run_id = r.id AND x.project = ?)
		 ORDER BY r.finished_at DESC LIMIT 1`,
	)
		.bind(project)
		.first<LabRunRow>();
	if (!run) return null;
	const { results } = await config.DB.prepare(
		"SELECT project, board, chip, status, seconds, matched, missing, output FROM lab_results WHERE run_id = ? AND project = ? ORDER BY board",
	)
		.bind(run.id, project)
		.all<LabResultRow>();
	return publicLab(run, results);
}

/** GET /lab/latest: per-project outcome of the latest run, for a lab page. */
async function labLatest(): Promise<Response> {
	const headers = { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" };
	const run = await config.DB.prepare("SELECT id, finished_at, core, firmware_built_at FROM lab_runs ORDER BY finished_at DESC LIMIT 1").first<LabRunRow>();
	if (!run) return json({ run: null, projects: {} }, 200, headers);
	const { results } = await config.DB.prepare("SELECT project, board, status, seconds FROM lab_results WHERE run_id = ? ORDER BY project, board")
		.bind(run.id)
		.all<{ project: string; board: string; status: string; seconds: number }>();
	const projects: Record<string, { board: string; status: string; seconds: number }[]> = {};
	for (const r of results) (projects[r.project] ??= []).push({ board: r.board, status: r.status, seconds: r.seconds });
	return json({ run: { finished_at: run.finished_at, core: run.core, firmware_built_at: run.firmware_built_at }, projects }, 200, headers);
}

/** POST /lab/runs: the lab runner's report, with the LAB_TOKEN secret. */
async function labRuns(request: Request): Promise<Response> {
	const none = {};
	if (!config.LAB_TOKEN) return json({ ok: false, error: "The lab is not set up." }, 503, none);
	const auth = request.headers.get("Authorization") ?? "";
	const given = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
	if (!tokenMatches(given, config.LAB_TOKEN)) return json({ ok: false, error: "Not authorised." }, 401, none);
	if (Number(request.headers.get("Content-Length") ?? 0) > 1_000_000) return json({ ok: false, error: "Report too large." }, 413, none);
	let body: unknown;
	try {
		body = JSON.parse((await request.text()).slice(0, 1_000_000));
	} catch {
		return json({ ok: false, error: "Send JSON." }, 400, none);
	}
	const checked = checkLabRun(body);
	if (!checked.ok) return json({ ok: false, error: checked.error }, 400, none);
	const run = checked.run;
	const inserted = await config.DB.prepare(
		"INSERT INTO lab_runs (runner, started_at, finished_at, core, firmware_built_at, created_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
	)
		.bind(run.runner, run.started_at, run.finished_at, run.core, run.firmware_built_at, new Date().toISOString())
		.first<{ id: number }>();
	const runId = inserted?.id;
	if (!runId) return json({ ok: false, error: "Could not store the run." }, 500, none);
	const stmt = config.DB.prepare(
		"INSERT INTO lab_results (run_id, project, board, chip, status, seconds, matched, missing, output) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
	);
	await config.DB.batch(
		run.results.map((r) => stmt.bind(runId, r.project, r.board, r.chip, r.status, r.seconds, JSON.stringify(r.matched), JSON.stringify(r.missing), r.output)),
	);
	const passed = run.results.filter((r) => r.status === "passed").length;
	return json({ ok: true, run: runId, results: run.results.length, passed }, 200, none);
}

/**
 * /sync: a bench log stored under a sync code (see sync.ts).
 *   POST   {turnstile, data}  makes a code and stores data; returns {code, updated_at}
 *   GET    Bearer <code>      returns {data, updated_at}
 *   PUT    Bearer <code>, {data}  replaces the data; returns {updated_at}
 *   DELETE Bearer <code>      removes the cloud copy
 * Only browsers on the site's origins get past CORS; the code is the only key.
 */
async function sync(request: Request, headers: Record<string, string>): Promise<Response> {
	if (request.method === "OPTIONS") return new Response(null, { status: headers["Access-Control-Allow-Origin"] ? 204 : 403, headers });
	if (!headers["Access-Control-Allow-Origin"]) return json({ ok: false, error: "Use sync from esp32bench.dev." }, 403, headers);
	const now = Date.now();

	async function body(): Promise<Record<string, unknown> | null> {
		if (Number(request.headers.get("Content-Length") ?? 0) > 80_000) return null;
		try {
			const parsed: unknown = JSON.parse((await request.text()).slice(0, 80_000));
			return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
		} catch {
			return null;
		}
	}

	if (request.method === "POST") {
		const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
		const { success } = await config.LIMIT.limit({ key: `sync:${ip}` });
		if (!success) return json({ ok: false, error: "Too many new codes in a minute. Please try again shortly." }, 429, headers);
		const b = await body();
		if (!b) return json({ ok: false, error: "Send JSON." }, 400, headers);
		const checked = checkSyncData(b.data);
		if (!checked.ok) return json({ ok: false, error: checked.error }, 400, headers);
		const human = await verifyTurnstile({
			secret: config.TURNSTILE_SECRET,
			token: b.turnstile,
			ip,
			expectedAction: "sync",
			expectedHostnames: new Set(config.TURNSTILE_HOSTNAMES.split(",").map((h) => h.trim()).filter(Boolean)),
		});
		if (!human) return json({ ok: false, error: "The human check failed or expired. Please complete it again." }, 403, headers);
		const code = newSyncCode();
		await config.DB.prepare("INSERT INTO sync (code_hash, data, created_at, updated_at) VALUES (?, ?, ?, ?)")
			.bind(await sha256(code), JSON.stringify(checked.data), now, now)
			.run();
		return json({ ok: true, code, updated_at: now }, 200, headers);
	}

	const gone = () => json({ ok: false, error: "No data for that sync code." }, 404, headers);
	// A sync code, or the key of a browser signed in with GitHub.
	const session = sessionKeyFrom(request);
	const code = session ? null : codeFrom(request);
	if (!session && !code) return json({ ok: false, error: "Send the sync code as a Bearer token." }, 401, headers);
	let hash: string;
	if (session) {
		const keyHash = await sha256(session);
		const row = await config.DB.prepare("SELECT sync_hash FROM sync_sessions WHERE key_hash = ?").bind(keyHash).first<{ sync_hash: string }>();
		if (!row) return gone();
		hash = row.sync_hash;
		await config.DB.prepare("UPDATE sync_sessions SET used_at = ? WHERE key_hash = ?").bind(now, keyHash).run();
	} else {
		hash = await sha256(code!);
	}

	if (request.method === "GET") {
		const row = await config.DB.prepare("SELECT data, updated_at FROM sync WHERE code_hash = ?").bind(hash).first<{ data: string; updated_at: number }>();
		return row ? json({ ok: true, data: JSON.parse(row.data), updated_at: row.updated_at }, 200, headers) : gone();
	}
	if (request.method === "PUT") {
		const b = await body();
		if (!b) return json({ ok: false, error: "Send JSON." }, 400, headers);
		const checked = checkSyncData(b.data);
		if (!checked.ok) return json({ ok: false, error: checked.error }, 400, headers);
		const res = await config.DB.prepare("UPDATE sync SET data = ?, updated_at = ? WHERE code_hash = ?").bind(JSON.stringify(checked.data), now, hash).run();
		return res.meta.changes ? json({ ok: true, updated_at: now }, 200, headers) : gone();
	}
	if (request.method === "DELETE") {
		// Deleting the cloud copy also signs out every browser on that GitHub account.
		await config.DB.batch([
			config.DB.prepare("DELETE FROM sync WHERE code_hash = ?").bind(hash),
			config.DB.prepare("DELETE FROM sync_sessions WHERE sync_hash = ?").bind(hash),
		]);
		return json({ ok: true }, 200, headers);
	}
	return json({ ok: false, error: "Use GET, POST, PUT or DELETE." }, 405, { ...headers, Allow: "GET, POST, PUT, DELETE, OPTIONS" });
}

/** GET /auth/github/start?return=<page>: off to GitHub, remembering where to come back to. */
async function githubStart(request: Request, url: URL): Promise<Response> {
	const allowed = config.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
	const returnTo = safeReturn(url.searchParams.get("return"), allowed);
	if (!returnTo) return html(resultPage("Not allowed", "Sign in with GitHub from esp32bench.dev."), 400);
	if (!config.GITHUB_CLIENT_ID || !config.GITHUB_CLIENT_SECRET) return html(resultPage("Not set up yet", "Sign in with GitHub is not available yet. Use a sync code instead."), 503);
	const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
	const { success } = await config.LIMIT.limit({ key: `github:${ip}` });
	if (!success) return html(resultPage("Too many tries", "Please wait a minute and try again."), 429);
	const { token: state } = await newToken();
	const secure = url.protocol === "https:";
	return new Response(null, {
		status: 302,
		headers: {
			Location: authorizeUrl(config.GITHUB_CLIENT_ID, `${url.origin}/auth/github/callback`, state),
			"Set-Cookie": stateCookie(state, returnTo, secure),
			"Cache-Control": "no-store",
		},
	});
}

/** GET /auth/github/callback: GitHub sends the browser back here. */
async function githubCallback(request: Request, url: URL): Promise<Response> {
	const secure = url.protocol === "https:";
	const saved = readStateCookie(request);
	const allowed = config.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
	const returnTo = saved ? safeReturn(saved.returnTo, allowed) : null;
	const back = (fragment: string) =>
		new Response(null, { status: 302, headers: { Location: `${returnTo}#${fragment}`, "Set-Cookie": clearStateCookie(secure), "Cache-Control": "no-store" } });
	if (!saved || !returnTo || !sameHash(await sha256(saved.state), await sha256(url.searchParams.get("state") ?? ""))) {
		return html(resultPage("Sign-in expired", "That sign-in link is old or was opened in another browser. Start again from esp32bench.dev."), 400);
	}
	// Cancelled on GitHub, or GitHub said no.
	const code = url.searchParams.get("code");
	if (!code || !config.GITHUB_CLIENT_ID || !config.GITHUB_CLIENT_SECRET) return back("sync-error=cancelled");
	const id = await githubAccountId({
		clientId: config.GITHUB_CLIENT_ID,
		clientSecret: config.GITHUB_CLIENT_SECRET,
		code,
		redirectUri: `${url.origin}/auth/github/callback`,
	}).catch(() => null);
	if (!id) return back("sync-error=github");
	const now = Date.now();
	const syncHash = await sha256(accountKey(id));
	const key = newSessionKey();
	await config.DB.batch([
		// The account's row, empty the first time; the browser merges its own log into it.
		config.DB.prepare("INSERT OR IGNORE INTO sync (code_hash, data, created_at, updated_at) VALUES (?, '{}', ?, ?)").bind(syncHash, now, now),
		config.DB.prepare("INSERT INTO sync_sessions (key_hash, sync_hash, created_at, used_at) VALUES (?, ?, ?, ?)").bind(await sha256(key), syncHash, now, now),
	]);
	return back(`sync-session=${key}`);
}

/** DELETE /auth/session: sign this browser out. The account's data stays for its other browsers. */
async function signOut(request: Request, headers: Record<string, string>): Promise<Response> {
	if (request.method === "OPTIONS") return new Response(null, { status: headers["Access-Control-Allow-Origin"] ? 204 : 403, headers });
	if (request.method !== "DELETE") return json({ ok: false, error: "Use DELETE." }, 405, { ...headers, Allow: "DELETE, OPTIONS" });
	const key = sessionKeyFrom(request);
	if (key) await config.DB.prepare("DELETE FROM sync_sessions WHERE key_hash = ?").bind(await sha256(key)).run();
	return json({ ok: true }, 200, headers);
}

/** GET /moderate/<id>?t=...: the report with Approve and Reject buttons. Nothing changes until a button posts. */
async function showModeration(id: number, url: URL): Promise<Response> {
	const row = await findForToken(id, url.searchParams.get("t") ?? "");
	return row ? html(moderationPage(row, url.searchParams.get("t") ?? "", row.project)) : invalidLink();
}

async function findForToken(id: number, token: string): Promise<BuildRow | null> {
	if (!token) return null;
	const row = await config.DB.prepare("SELECT * FROM builds WHERE id = ?").bind(id).first<BuildRow & { token_hash: string }>();
	return row && sameHash(await sha256(token), row.token_hash) ? row : null;
}

const invalidLink = () => html(resultPage("Link not valid", "This moderation link is wrong or has been changed."), 404);

async function decide(row: BuildRow, action: string): Promise<string> {
	if (action !== "approve" && action !== "reject") return resultPage("Nothing changed", "Choose Approve or Reject.");
	const status = action === "approve" ? "approved" : "rejected";
	await config.DB.prepare("UPDATE builds SET status = ?, decided_at = ? WHERE id = ?").bind(status, new Date().toISOString(), row.id).run();
	return status === "approved"
		? resultPage("Published", "The build report now shows on the project page (allow a minute for caches).", `${SITE}/projects/${row.project}/#community`)
		: resultPage("Rejected", "The build report will not be published. Its moderation link still works if you change your mind.");
}

export default {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const origin = request.headers.get("Origin");
		const headers = cors(origin);

		if (url.pathname.startsWith("/fw/")) {
			if (request.method !== "PUT") return json({ ok: false, error: "Use PUT." }, 405, { Allow: "PUT" });
			return uploadFirmware(request, url.pathname.slice(4), config.FIRMWARE, API_ORIGIN, "doodersrage/esp32-bench");
		}
		if (url.pathname === "/sync") return sync(request, headers);
		if (url.pathname === "/auth/github/start" && request.method === "GET") return githubStart(request, url);
		if (url.pathname === "/auth/github/callback" && request.method === "GET") return githubCallback(request, url);
		if (url.pathname === "/auth/session") return signOut(request, headers);
		if (url.pathname === "/builds/summary" && request.method === "GET") return buildsSummary();
		if (url.pathname === "/builds" && request.method === "GET") return listBuilds(url);
		if (url.pathname === "/lab/latest" && request.method === "GET") return labLatest();
		if (url.pathname === "/lab/runs") {
			if (request.method !== "POST") return json({ ok: false, error: "Use POST." }, 405, { Allow: "POST" });
			return labRuns(request);
		}
		const mod = /^\/moderate\/(\d{1,9})$/.exec(url.pathname);
		if (mod) {
			const id = Number(mod[1]);
			if (request.method === "GET") return showModeration(id, url);
			if (request.method !== "POST") return html(resultPage("Not allowed", "Use the buttons on the moderation page."), 405);
			const form = await request.formData().catch(() => new FormData());
			const row = await findForToken(id, String(form.get("t") ?? ""));
			return row ? html(await decide(row, String(form.get("action") ?? ""))) : invalidLink();
		}

		if (url.pathname !== "/report") return json({ ok: false, error: "Not found." }, 404, headers);
		if (request.method === "OPTIONS") return new Response(null, { status: headers["Access-Control-Allow-Origin"] ? 204 : 403, headers });
		if (request.method !== "POST") return json({ ok: false, error: "Use POST." }, 405, { ...headers, Allow: "POST, OPTIONS" });
		if (!headers["Access-Control-Allow-Origin"]) return json({ ok: false, error: "Send reports from esp32bench.dev." }, 403, headers);
		if (!(request.headers.get("Content-Type") ?? "").includes("application/json")) {
			return json({ ok: false, error: "Send the form as JSON." }, 415, headers);
		}
		if (Number(request.headers.get("Content-Length") ?? 0) > 20_000) return json({ ok: false, error: "That report is too long." }, 413, headers);

		const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
		const { success } = await config.LIMIT.limit({ key: ip });
		if (!success) return json({ ok: false, error: "Too many reports in a minute. Please try again shortly." }, 429, headers);

		let body: unknown;
		try {
			body = JSON.parse((await request.text()).slice(0, 20_000));
		} catch {
			return json({ ok: false, error: "Send the form as JSON." }, 400, headers);
		}

		const checked = checkReport(body, Date.now());
		if (!checked.ok) {
			if (checked.spam) return json({ ok: true }, 200, headers);
			return json({ ok: false, error: checked.error }, checked.status, headers);
		}
		if (!config.REPORT_TO) return json({ ok: false, error: "Reports are not set up yet." }, 503, headers);

		const human = await verifyTurnstile({
			secret: config.TURNSTILE_SECRET,
			token: (body as { turnstile?: unknown }).turnstile,
			ip,
			expectedAction: "report",
			expectedHostnames: new Set(config.TURNSTILE_HOSTNAMES.split(",").map((h) => h.trim()).filter(Boolean)),
		});
		if (!human) return json({ ok: false, error: "The human check failed or expired. Please complete it again and press Send." }, 403, headers);

		const r = checked.report;
		let text = textFor(r, {
			country: (request.cf?.country as string | undefined) ?? "",
			agent: request.headers.get("User-Agent") ?? "",
		});
		// A build report the sender agreed to publish waits in the database for approval.
		let pendingId: number | null = null;
		if (r.kind === "build" && r.publish) {
			const { token, hash } = await newToken();
			const row = await config.DB.prepare(
				`INSERT INTO builds (project, board, core, result, output, notes, public_name, created_at, token_hash)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
			)
				.bind(r.projectId, r.board, r.core, r.result, r.output, r.notes, r.publicName, new Date().toISOString(), hash)
				.first<{ id: number }>();
			pendingId = row?.id ?? null;
			if (pendingId !== null) {
				text += `\nThe sender agreed to publish this report on the project page.\nApprove or reject it here: ${API_ORIGIN}/moderate/${pendingId}?t=${token}\n`;
			}
		}
		try {
			await config.EMAIL.send({
				to: config.REPORT_TO,
				from: { email: config.SENDER, name: "ESP32 Bench reports" },
				...(r.email ? { replyTo: r.name ? { email: r.email, name: r.name } : r.email } : {}),
				subject: subjectFor(r),
				text,
				html: htmlFor(text),
			});
		} catch (error) {
			const e = error as { code?: string; message?: string };
			console.error("report email failed", e.code, e.message);
			if (pendingId !== null) await config.DB.prepare("DELETE FROM builds WHERE id = ?").bind(pendingId).run();
			return json({ ok: false, error: "The report could not be sent. Please try again later." }, 502, headers);
		}
		return json({ ok: true }, 200, headers);
	},
} satisfies ExportedHandler;
