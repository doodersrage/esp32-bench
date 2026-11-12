// esp32-bench-api: POST /report from esp32bench.dev, emailed to the owner.
import { env } from "cloudflare:workers";
import { checkReport, htmlFor, subjectFor, textFor } from "./report.ts";

interface Env {
	EMAIL: SendEmail;
	LIMIT: RateLimit;
	ALLOWED_ORIGINS: string;
	SENDER: string;
	/** Verified Email Routing destination, set as a Worker secret */
	REPORT_TO?: string;
}

const config = env as unknown as Env;

function cors(origin: string | null): Record<string, string> {
	const allowed = config.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
	if (!origin || !allowed.includes(origin)) return {};
	return {
		"Access-Control-Allow-Origin": origin,
		"Access-Control-Allow-Methods": "POST, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type",
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

export default {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const origin = request.headers.get("Origin");
		const headers = cors(origin);

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

		const r = checked.report;
		const text = textFor(r, {
			country: (request.cf?.country as string | undefined) ?? "",
			agent: request.headers.get("User-Agent") ?? "",
		});
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
			return json({ ok: false, error: "The report could not be sent. Please try again later." }, 502, headers);
		}
		return json({ ok: true }, 200, headers);
	},
} satisfies ExportedHandler;
