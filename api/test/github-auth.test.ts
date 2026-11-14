// Run: node --experimental-strip-types test/github-auth.test.ts
import assert from "node:assert/strict";
import {
	accountKey,
	authorizeUrl,
	githubAccountId,
	isSessionKey,
	newSessionKey,
	readStateCookie,
	safeReturn,
	sessionKeyFrom,
	stateCookie,
} from "../src/github-auth.ts";

// Sign-in keys: gh_ + 43 base64url characters, random, never shaped like a sync code.
const key = newSessionKey();
assert.ok(isSessionKey(key), key);
assert.notEqual(key, newSessionKey());
assert.equal(isSessionKey("7KQ4-M2XD-9PQA-R3TW"), false);
assert.equal(isSessionKey("gh_short"), false);
const req = (auth?: string, cookie?: string) =>
	new Request("https://api.example/sync", { headers: { ...(auth ? { Authorization: auth } : {}), ...(cookie ? { Cookie: cookie } : {}) } });
assert.equal(sessionKeyFrom(req(`Bearer ${key}`)), key);
assert.equal(sessionKeyFrom(req("Bearer 7KQ4-M2XD-9PQA-R3TW")), null, "a code is not a session");
assert.equal(sessionKeyFrom(req()), null);
assert.equal(accountKey(1234), "github:1234");

// Return pages: only the site's own origins, and any fragment is dropped.
const allowed = ["https://esp32bench.dev", "https://www.esp32bench.dev"];
assert.equal(safeReturn("https://esp32bench.dev/de/#sync", allowed), "https://esp32bench.dev/de/");
assert.equal(safeReturn("https://evil.example/", allowed), null);
assert.equal(safeReturn("https://esp32bench.dev.evil.example/", allowed), null);
assert.equal(safeReturn("javascript:alert(1)", allowed), null);
assert.equal(safeReturn("not a url", allowed), null);
assert.equal(safeReturn(null, allowed), null);

// GitHub link: our client id, callback and state, and no scope at all.
const auth = new URL(authorizeUrl("cid", "https://api.example/auth/github/callback", "st4te"));
assert.equal(auth.origin + auth.pathname, "https://github.com/login/oauth/authorize");
assert.equal(auth.searchParams.get("client_id"), "cid");
assert.equal(auth.searchParams.get("state"), "st4te");
assert.equal(auth.searchParams.get("scope"), null, "no scopes requested");

// State cookie round trip, scoped to the auth path, HttpOnly.
const set = stateCookie("abc123", "https://esp32bench.dev/fr/", true);
assert.match(set, /HttpOnly/);
assert.match(set, /Path=\/auth\/github/);
assert.match(set, /Secure/);
const value = set.split(";")[0];
assert.deepEqual(readStateCookie(req(undefined, `other=1; ${value}`)), { state: "abc123", returnTo: "https://esp32bench.dev/fr/" });
assert.equal(readStateCookie(req(undefined, "other=1")), null);

// Code exchange: token, then /user, then the token is revoked. Only the id comes back.
const calls: string[] = [];
const fake = (async (input: RequestInfo | URL, init?: RequestInit) => {
	const url = String(input);
	calls.push(`${init?.method ?? "GET"} ${url}`);
	if (url.endsWith("/login/oauth/access_token")) {
		const body = JSON.parse(String(init?.body));
		assert.equal(body.code, "one-time");
		return Response.json({ access_token: "gho_secret", token_type: "bearer", scope: "" });
	}
	if (url === "https://api.github.com/user") {
		assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer gho_secret");
		return Response.json({ id: 583231, login: "octocat", email: "octo@example.com" });
	}
	if (url.endsWith("/applications/cid/token")) return new Response(null, { status: 204 });
	return new Response("?", { status: 404 });
}) as typeof fetch;
const id = await githubAccountId({ clientId: "cid", clientSecret: "sec", code: "one-time", redirectUri: "https://api.example/cb" }, fake);
assert.equal(id, 583231);
assert.deepEqual(calls, [
	"POST https://github.com/login/oauth/access_token",
	"GET https://api.github.com/user",
	"DELETE https://api.github.com/applications/cid/token",
]);

// A bad code: no token, no id, nothing else called.
calls.length = 0;
const refused = (async (input: RequestInfo | URL, init?: RequestInit) => {
	calls.push(`${init?.method ?? "GET"} ${String(input)}`);
	return Response.json({ error: "bad_verification_code" });
}) as typeof fetch;
assert.equal(await githubAccountId({ clientId: "cid", clientSecret: "sec", code: "x", redirectUri: "https://api.example/cb" }, refused), null);
assert.equal(calls.length, 1);

console.log("github sign-in: all checks pass");
