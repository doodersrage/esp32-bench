// Uptime monitor for esp32bench.dev. Every 5 minutes it checks the site and the
// report API; after two failed runs in a row it emails the owner, and again when
// everything recovers. State lives in KV and is only written when it changes.
// The alert address is the ALERT_TO secret (a verified Email Routing destination).
import { bindings, defineConfig, triggers } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

export default defineConfig({
	worker: {
		name: "esp32-bench-monitor",
		compatibilityDate: "2026-11-10",
		// Fetch our own sites over the public internet, as a visitor would.
		compatibilityFlags: ["global_fetch_strictly_public"],
		entrypoint,
		workersDev: false,
		observability: { enabled: true },
		triggers: [triggers.scheduled({ schedule: "*/5 * * * *" })],
		env: {
			STATE: bindings.kv({ id: "5f0b3db091284e74ba0b6131d21a994e" }),
			EMAIL: bindings.sendEmail(),
			SENDER: bindings.text("monitor@esp32bench.dev"),
		},
	},
});
