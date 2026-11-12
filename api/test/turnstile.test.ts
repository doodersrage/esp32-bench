// Run: node --experimental-strip-types test/turnstile.test.ts
import assert from "node:assert/strict";
import { verifyTurnstile } from "../src/turnstile.ts";

const hosts = new Set(["esp32bench.dev"]);
const answer = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
const base = { secret: "s", token: "tok", ip: "1.2.3.4", expectedAction: "report", expectedHostnames: hosts };

assert.equal(await verifyTurnstile({ ...base, fetcher: answer({ success: true, action: "report", hostname: "esp32bench.dev" }) }), true, "good token");
assert.equal(await verifyTurnstile({ ...base, fetcher: answer({ success: false }) }), false, "rejected token");
assert.equal(await verifyTurnstile({ ...base, fetcher: answer({ success: true, action: "login", hostname: "esp32bench.dev" }) }), false, "wrong action");
assert.equal(await verifyTurnstile({ ...base, fetcher: answer({ success: true, action: "report", hostname: "localhost" }) }), false, "localhost not accepted in production");
assert.equal(await verifyTurnstile({ ...base, fetcher: answer({}, 500) }), false, "siteverify error fails closed");
assert.equal(await verifyTurnstile({ ...base, fetcher: (async () => { throw new Error("down"); }) as unknown as typeof fetch }), false, "network error fails closed");
assert.equal(await verifyTurnstile({ ...base, secret: undefined, fetcher: answer({ success: true, action: "report", hostname: "esp32bench.dev" }) }), false, "missing secret fails closed");
assert.equal(await verifyTurnstile({ ...base, token: "", fetcher: answer({ success: true, action: "report", hostname: "esp32bench.dev" }) }), false, "empty token");
assert.equal(await verifyTurnstile({ ...base, token: "x".repeat(2049), fetcher: answer({ success: true, action: "report", hostname: "esp32bench.dev" }) }), false, "oversized token");
assert.equal(await verifyTurnstile({ ...base, expectedHostnames: new Set(), fetcher: answer({ success: true, action: "report", hostname: "esp32bench.dev" }) }), false, "no hostnames configured");
console.log("turnstile verification: all checks pass");
