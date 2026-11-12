// What the monitor checks, and when a failure is worth an email. Pure functions.

export interface Check {
	name: string;
	url: string;
	method?: string;
	headers?: Record<string, string>;
	/** Return a problem description, or null when the response is right. */
	verify(res: Response, body: string): string | null;
}

export interface Result {
	name: string;
	ok: boolean;
	detail: string;
	ms: number;
}

export const CHECKS: Check[] = [
	{
		name: "Home page",
		url: "https://esp32bench.dev/",
		verify: (r, b) => (r.status !== 200 ? `HTTP ${r.status}` : b.includes("ESP32 Bench") ? null : "page loaded but looks wrong"),
	},
	{
		name: "Project page",
		url: "https://esp32bench.dev/projects/dht22/",
		verify: (r, b) => (r.status !== 200 ? `HTTP ${r.status}` : b.includes("DHT22") ? null : "page loaded but looks wrong"),
	},
	{
		name: "Search index",
		url: "https://esp32bench.dev/search-index.json",
		verify: (r, b) => {
			if (r.status !== 200) return `HTTP ${r.status}`;
			try {
				JSON.parse(b);
				return null;
			} catch {
				return "not valid JSON";
			}
		},
	},
	{
		name: "Firmware manifest",
		url: "https://esp32bench.dev/firmware/pin-detective/manifest.json",
		verify: (r, b) => (r.status !== 200 ? `HTTP ${r.status}` : b.includes('"builds"') ? null : "manifest has no builds"),
	},
	{
		name: "Report API",
		url: "https://api.esp32bench.dev/report",
		method: "OPTIONS",
		headers: { Origin: "https://esp32bench.dev", "Access-Control-Request-Method": "POST" },
		verify: (r) =>
			r.status !== 204
				? `HTTP ${r.status}`
				: r.headers.get("Access-Control-Allow-Origin") === "https://esp32bench.dev"
					? null
					: "CORS header missing",
	},
	{
		name: "www redirect",
		url: "https://www.esp32bench.dev/",
		verify: (r) => {
			const to = r.headers.get("Location") ?? "";
			return r.status === 301 && to.startsWith("https://esp32bench.dev/") ? null : `HTTP ${r.status} ${to}`.trim();
		},
	},
];

export async function runChecks(fetcher: typeof fetch, checks = CHECKS, timeoutMs = 10_000): Promise<Result[]> {
	return Promise.all(
		checks.map(async (c) => {
			const start = Date.now();
			try {
				const res = await fetcher(c.url, {
					method: c.method ?? "GET",
					headers: { "User-Agent": "esp32-bench-monitor", ...c.headers },
					redirect: "manual",
					signal: AbortSignal.timeout(timeoutMs),
				});
				const body = c.method === "OPTIONS" ? "" : await res.text();
				const problem = c.verify(res, body);
				return { name: c.name, ok: problem === null, detail: problem ?? `HTTP ${res.status}`, ms: Date.now() - start };
			} catch (e) {
				const msg = e instanceof Error ? (e.name === "TimeoutError" ? `no answer within ${timeoutMs / 1000} s` : e.message) : String(e);
				return { name: c.name, ok: false, detail: msg, ms: Date.now() - start };
			}
		}),
	);
}

export interface State {
	status: "up" | "down";
	/** Consecutive failed runs per check */
	failures: Record<string, number>;
	/** When the current outage was confirmed (ISO time) */
	downSince?: string;
}

export interface Alert {
	subject: string;
	text: string;
}

/** Failed runs in a row before a check counts as down: one blip is not an outage. */
export const CONFIRM_AFTER = 2;

function table(results: Result[]): string {
	return results.map((r) => `${r.ok ? "ok  " : "FAIL"}  ${r.name}: ${r.detail} (${r.ms} ms)`).join("\n");
}

function minutes(fromIso: string, now: Date): string {
	const m = Math.max(1, Math.round((now.getTime() - new Date(fromIso).getTime()) / 60000));
	return m < 120 ? `${m} minutes` : `${(m / 60).toFixed(1)} hours`;
}

/** Work out the new state and whether to send an email. `previous` is null on the very first run. */
export function decide(previous: State | null, results: Result[], now: Date): { state: State; alert: Alert | null; changed: boolean } {
	const failures: Record<string, number> = {};
	for (const r of results) failures[r.name] = r.ok ? 0 : (previous?.failures[r.name] ?? 0) + 1;
	const confirmed = results.filter((r) => failures[r.name] >= CONFIRM_AFTER);
	const status: State["status"] = confirmed.length > 0 ? "down" : "up";

	if (previous === null) {
		const state: State = { status, failures, ...(status === "down" ? { downSince: now.toISOString() } : {}) };
		return {
			state,
			changed: true,
			alert: {
				subject: "[ESP32 Bench] Monitoring started",
				text: `The uptime monitor for esp32bench.dev is running. It checks every 5 minutes and emails you when a check fails twice in a row, and again when it recovers.\n\nFirst run:\n${table(results)}\n`,
			},
		};
	}

	let alert: Alert | null = null;
	let downSince = previous.downSince;
	if (previous.status === "up" && status === "down") {
		downSince = now.toISOString();
		alert = {
			subject: `[ESP32 Bench] DOWN: ${confirmed.map((r) => r.name).join(", ")}`,
			text: `These checks failed ${CONFIRM_AFTER} runs in a row:\n\n${table(results)}\n\nYou will get another email when everything passes again.\n`,
		};
	} else if (previous.status === "down" && status === "up") {
		alert = {
			subject: "[ESP32 Bench] Recovered",
			text: `Everything passes again${downSince ? ` after about ${minutes(downSince, now)}` : ""}.\n\n${table(results)}\n`,
		};
		downSince = undefined;
	}

	const state: State = { status, failures, ...(downSince ? { downSince } : {}) };
	const changed = JSON.stringify(state) !== JSON.stringify(previous);
	return { state, alert, changed };
}
