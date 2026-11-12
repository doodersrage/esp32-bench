// esp32-bench-monitor: scheduled checks of esp32bench.dev with email alerts.
import { env } from "cloudflare:workers";
import { decide, runChecks, type State } from "./checks.ts";

interface Env {
	STATE: KVNamespace;
	EMAIL: SendEmail;
	SENDER: string;
	/** Verified Email Routing destination, set as a Worker secret */
	ALERT_TO?: string;
}
const config = env as unknown as Env;
const KEY = "state";

async function monitor(): Promise<void> {
	const previous = await config.STATE.get<State>(KEY, "json");
	const results = await runChecks(fetch);
	const { state, alert, changed } = decide(previous, results, new Date());
	console.log(JSON.stringify({ status: state.status, results }));

	if (alert) {
		if (!config.ALERT_TO) {
			console.error("ALERT_TO is not set; alert not sent:", alert.subject);
		} else {
			try {
				await config.EMAIL.send({
					to: config.ALERT_TO,
					from: { email: config.SENDER, name: "ESP32 Bench monitor" },
					subject: alert.subject,
					text: alert.text,
				});
			} catch (e) {
				const err = e as { code?: string; message?: string };
				console.error("alert email failed", err.code, err.message);
				// Keep the old state so the next run tries the alert again.
				return;
			}
		}
	}
	if (changed) await config.STATE.put(KEY, JSON.stringify(state));
}

export default {
	async scheduled(_controller: ScheduledController, _env: unknown, ctx: ExecutionContext) {
		ctx.waitUntil(monitor());
	},
	async fetch() {
		return new Response("Not found", { status: 404 });
	},
} satisfies ExportedHandler;
