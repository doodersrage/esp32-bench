// esp32-bench-compile: compiles Arduino-ESP32 sketches for esp32bench.dev in a
// container (PlatformIO, Arduino core 3.x) and returns a merged flash image.
//
//   POST /compile  {board, code, libs?, partitions?}  -> see README.md
//   GET  /health   -> {ok, state: "ready" | "sleeping" | ..., core}
import { DurableObject, env } from "cloudflare:workers";
import { CHIP, MAX_BODY_BYTES, checkRequest, dayKey, parseBuild, quotaDecision, secondsToMidnight } from "./shared.ts";

interface Env {
	LIMIT: RateLimit;
	QUOTA: KVNamespace;
	ALLOWED_ORIGINS: string;
}
const config = env as unknown as Env;

const PORT = 8080;
// 1 vCPU halves build times compared with standard-1 (½ vCPU), and its 12 GB disk fits the image.
const INSTANCE = "standard-2";
const SLEEP_AFTER_MS = 2 * 60 * 1000;
/** Fixed pool of container instances; a build waits for a free one rather than booting more. */
const POOL = ["c0", "c1"];
const COMPILE_TIMEOUT_MS = 150_000;

function cors(origin: string | null): Record<string, string> {
	const allowed = config.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
	if (!origin || !allowed.includes(origin)) return {};
	return {
		"Access-Control-Allow-Origin": origin,
		"Access-Control-Allow-Methods": "POST, GET, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type",
		"Access-Control-Max-Age": "86400",
		Vary: "Origin",
	};
}

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
	});
}

/** One container instance. Starts on demand, sleeps after two idle minutes. */
export class Compiler extends DurableObject {
	private starting: Promise<void> | undefined;
	private monitoring: Promise<void> | undefined;

	constructor(ctx: DurableObjectState, env: unknown) {
		super(ctx, env as never);
		const container = ctx.container;
		if (container?.running) {
			void ctx.blockConcurrencyWhile(async () => {
				await container.setInactivityTimeout(SLEEP_AFTER_MS);
				// After a restart or deploy, make sure the idle guard is armed.
				if ((await ctx.storage.getAlarm()) === null) await ctx.storage.setAlarm(Date.now() + SLEEP_AFTER_MS);
			});
			this.observeExit();
		}
	}

	/**
	 * Idle guard: stop the container once no build has used it for SLEEP_AFTER_MS,
	 * whatever the platform counts as activity, so an idle container never bills on.
	 */
	async alarm(): Promise<void> {
		const container = this.ctx.container;
		if (!container?.running) return;
		const last = (await this.ctx.storage.get<number>("lastUsed")) ?? 0;
		const idle = Date.now() - last;
		if (idle >= SLEEP_AFTER_MS) {
			console.log(JSON.stringify({ event: "idle-stop", idleSeconds: Math.round(idle / 1000) }));
			await container.destroy("idle");
			return;
		}
		await this.ctx.storage.setAlarm(last + SLEEP_AFTER_MS + 1000);
	}

	/** Health without waking a sleeping container. */
	async status(): Promise<{ state: string; core?: string; busy?: boolean; resources?: Record<string, string | number> }> {
		const container = this.ctx.container;
		if (!container?.running) return { state: "sleeping" };
		try {
			const res = await container.getTcpPort(PORT).fetch("http://container/health", { signal: AbortSignal.timeout(3000) });
			const body = (await res.json()) as { core?: string; busy?: boolean; resources?: Record<string, string | number> };
			return { state: res.ok ? "ready" : "starting", core: body.core, busy: body.busy, resources: body.resources };
		} catch {
			return { state: "starting" };
		}
	}

	async fetch(request: Request): Promise<Response> {
		const now = Date.now();
		await this.ctx.storage.put("lastUsed", now);
		await this.ctx.storage.setAlarm(now + COMPILE_TIMEOUT_MS + SLEEP_AFTER_MS);
		this.starting ??= this.startAndWaitForPort().finally(() => {
			this.starting = undefined;
		});
		await this.starting;
		await this.ctx.container!.setInactivityTimeout(SLEEP_AFTER_MS);
		const url = new URL(request.url);
		url.protocol = "http:";
		url.host = "container";
		const forwarded = new Request(url, request);
		forwarded.headers.delete("host");
		const response = await this.ctx.container!.getTcpPort(PORT).fetch(forwarded, { signal: AbortSignal.timeout(COMPILE_TIMEOUT_MS) });
		// The idle clock starts when the build finishes, not when it was asked for.
		await this.ctx.storage.put("lastUsed", Date.now());
		await this.ctx.storage.setAlarm(Date.now() + SLEEP_AFTER_MS + 1000);
		return response;
	}

	private async startAndWaitForPort(): Promise<void> {
		const container = this.ctx.container!;
		if (!container.running) {
			container.start({ image: container.images.base, instance: INSTANCE, enableInternet: false });
		}
		this.observeExit();
		await container.setInactivityTimeout(SLEEP_AFTER_MS);
		const port = container.getTcpPort(PORT);
		for (let attempt = 0; attempt < 300; attempt++) {
			try {
				const response = await port.fetch("http://container/health", { signal: AbortSignal.timeout(1000) });
				await response.body?.cancel();
				if (response.ok) return;
			} catch {
				// Not listening yet.
			}
			await scheduler.wait(250);
		}
		throw new Error("The compiler container did not start.");
	}

	private observeExit(): void {
		if (this.monitoring) return;
		// Not passed to waitUntil: monitor() only settles when the container exits,
		// and keeping the Durable Object busy that long would keep the container awake.
		this.monitoring = this.ctx
			.container!.monitor()
			.then(() => console.log("compiler container exited"))
			.catch((error: unknown) => console.error("compiler container failed:", error))
			.finally(() => {
				this.monitoring = undefined;
			});
	}
}

async function checkQuota(ip: string, now: Date): Promise<{ allowed: boolean; reason: string; commit: () => Promise<void> }> {
	const day = dayKey(now);
	const ipKey = `q:${day}:ip:${ip}`;
	const allKey = `q:${day}:all`;
	const [ipCount, allCount] = await Promise.all([config.QUOTA.get(ipKey), config.QUOTA.get(allKey)]);
	const decision = quotaDecision(Number(ipCount ?? 0), Number(allCount ?? 0));
	const ttl = secondsToMidnight(now) + 3600;
	return {
		...decision,
		commit: async () => {
			await Promise.all([
				config.QUOTA.put(ipKey, String(Number(ipCount ?? 0) + 1), { expirationTtl: ttl }),
				config.QUOTA.put(allKey, String(Number(allCount ?? 0) + 1), { expirationTtl: ttl }),
			]);
		},
	};
}

export default {
	async fetch(request, _env, ctx): Promise<Response> {
		const url = new URL(request.url);
		const origin = request.headers.get("Origin");
		const headers = cors(origin);

		if (request.method === "OPTIONS") return new Response(null, { status: headers["Access-Control-Allow-Origin"] ? 204 : 403, headers });

		if (url.pathname === "/health" && request.method === "GET") {
			const states = await Promise.all(POOL.map(async (name) => ({ name, ...(await ctx.exports.Compiler.getByName(name).status()) })));
			const ready = states.find((s) => s.state === "ready");
			return json({ ok: true, state: ready ? "ready" : states.some((s) => s.state === "starting") ? "starting" : "sleeping", core: ready?.core ?? null, instances: states }, 200, {
				...headers,
				"Access-Control-Allow-Origin": "*",
			});
		}

		if (url.pathname !== "/compile") return json({ ok: false, error: "Not found." }, 404, headers);
		if (request.method !== "POST") return json({ ok: false, error: "Use POST." }, 405, { ...headers, Allow: "POST, OPTIONS" });
		if (!headers["Access-Control-Allow-Origin"]) return json({ ok: false, error: "Build requests must come from esp32bench.dev." }, 403, headers);
		if (!(request.headers.get("Content-Type") ?? "").includes("application/json")) return json({ ok: false, error: "Send the build request as JSON." }, 415, headers);
		if (Number(request.headers.get("Content-Length") ?? 0) > MAX_BODY_BYTES) return json({ ok: false, error: "The request is too large." }, 413, headers);

		const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
		const { success } = await config.LIMIT.limit({ key: ip });
		if (!success) return json({ ok: false, error: "Too many builds in a minute. Please wait a moment." }, 429, headers);

		let body: unknown;
		try {
			body = JSON.parse((await request.text()).slice(0, MAX_BODY_BYTES));
		} catch {
			return json({ ok: false, error: "Send the build request as JSON." }, 400, headers);
		}
		const checked = checkRequest(body);
		if (!checked.ok) return json({ ok: false, error: checked.error }, checked.status, headers);

		const quota = await checkQuota(ip, new Date());
		if (!quota.allowed) return json({ ok: false, error: quota.reason }, 429, headers);

		const name = POOL[Math.floor(Math.random() * POOL.length)];
		const started = Date.now();
		let upstream: Response;
		try {
			upstream = await ctx.exports.Compiler.getByName(name).fetch(
				new Request("http://container/compile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(checked.request) }),
			);
		} catch (error) {
			console.error("compile failed", name, error instanceof Error ? error.message : error);
			return json({ ok: false, error: "The build service is not available right now. Please try again in a minute." }, 503, headers);
		}
		const raw = (await upstream.json().catch(() => null)) as Record<string, unknown> | null;
		if (!raw) return json({ ok: false, error: "The build service gave an unreadable answer." }, 502, headers);
		if (!upstream.ok && !("exit_code" in raw)) return json({ ok: false, error: String(raw.error ?? "Build request refused.") }, upstream.status, headers);

		await quota.commit();
		const parsed = parseBuild(String(raw.log ?? ""));
		const total = Math.round((Date.now() - started) / 100) / 10;
		console.log(JSON.stringify({ event: "compile", instance: name, board: checked.request.board, ok: raw.ok, seconds: raw.seconds, total, errors: parsed.errors.length }));
		const out: Record<string, unknown> = {
			ok: raw.ok === true,
			board: checked.request.board,
			chip: CHIP[checked.request.board],
			core: raw.core || parsed.core,
			seconds: raw.seconds,
			totalSeconds: total,
			errors: parsed.errors,
			warnings: parsed.warnings,
			sizes: parsed.sizes,
			failure: raw.ok ? "" : parsed.errors.length ? "" : parsed.failure || "The build failed; see the log.",
			log: String(raw.log ?? "").slice(-6000),
		};
		if (raw.ok === true) {
			out.image_bytes = raw.image_bytes;
			out.bootloader_offset = 0;
			if (url.searchParams.get("nobin") !== "1") out.image_b64 = raw.image_b64;
		}
		return json(out, 200, headers);
	},
} satisfies ExportedHandler;
