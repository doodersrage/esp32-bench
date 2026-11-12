// The report form's backend: receives build reports, corrections and messages
// from esp32bench.dev and emails them to the site owner through Cloudflare
// Email Routing. The destination address is the REPORT_TO secret, never in code.
import { bindings, defineConfig } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

export default defineConfig({
	worker: {
		name: "esp32-bench-api",
		compatibilityDate: "2026-11-10",
		entrypoint,
		domains: ["api.esp32bench.dev"],
		workersDev: false,
		observability: { enabled: true },
		env: {
			// Unrestricted binding: Email Routing only delivers to verified addresses.
			EMAIL: bindings.sendEmail(),
			// 3 reports a minute per visitor address.
			LIMIT: bindings.rateLimit({ namespace: "3201", simple: { limit: 3, period: 60 } }),
			ALLOWED_ORIGINS: bindings.text("https://esp32bench.dev,https://www.esp32bench.dev"),
			SENDER: bindings.text("reports@esp32bench.dev"),
		},
	},
});
