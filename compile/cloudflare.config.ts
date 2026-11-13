// The compile service: a Worker that forwards build requests to a container
// running PlatformIO with the Arduino-ESP32 core, started on demand and put to
// sleep after two idle minutes. See README.md for costs and quotas.
import { bindings, defineConfig, defineContainer, exports } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

const compiler = defineContainer({
	name: "esp32-bench-compiler",
	schedulingPolicy: "durable-object",
	images: { base: { dockerfile: "./container/Dockerfile" } },
	observability: { enabled: true, logs: { enabled: true } },
});

export default defineConfig({
	worker: {
		name: "esp32-bench-compile",
		compatibilityDate: "2026-11-10",
		entrypoint,
		domains: ["compile.esp32bench.dev"],
		workersDev: false,
		observability: { enabled: true },
		exports: {
			Compiler: exports.durableObject({ storage: "sqlite", container: compiler }),
		},
		env: {
			// 4 builds a minute per visitor address.
			LIMIT: bindings.rateLimit({ namespace: "3202", simple: { limit: 4, period: 60 } }),
			// Daily counters per address and in total.
			QUOTA: bindings.kv({ id: "d3eae80895304db0b17201e582bfa09b" }),
			ALLOWED_ORIGINS: bindings.text("https://esp32bench.dev,http://localhost:4321"),
		},
	},
	containers: [compiler],
});
