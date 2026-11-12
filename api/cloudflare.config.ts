// The report form's backend: receives build reports, corrections and messages
// from esp32bench.dev and emails them to the site owner through Cloudflare
// Email Routing. The destination address is the REPORT_TO secret, never in code.
// TURNSTILE_SECRET (the widget secret) is also a Worker secret.
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
			// Build reports waiting for approval, and the approved ones shown on project pages.
			DB: bindings.d1({ id: "9fe09f5a-3e8b-40f0-8be5-6e7ca050c335", name: "esp32-bench-reports" }),
			// Prebuilt firmware for every project, served at fw.esp32bench.dev; written by GitHub Actions.
			FIRMWARE: bindings.r2({ name: "esp32-bench-firmware" }),
			LIMIT: bindings.rateLimit({ namespace: "3201", simple: { limit: 3, period: 60 } }),
			ALLOWED_ORIGINS: bindings.text("https://esp32bench.dev,https://www.esp32bench.dev"),
			SENDER: bindings.text("reports@esp32bench.dev"),
			// Turnstile: the frontend hostnames whose tokens are accepted. Never localhost in production.
			TURNSTILE_HOSTNAMES: bindings.text("esp32bench.dev"),
		},
	},
});
