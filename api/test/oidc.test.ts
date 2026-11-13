// Run: node --experimental-strip-types test/oidc.test.ts
import assert from "node:assert/strict";
import { verifyGithubToken, type Jwk } from "../src/github-oidc.ts";

const pair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const pub = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey;
const keys: Jwk[] = [{ kid: "k1", kty: "RSA", n: pub.n!, e: pub.e! }];
const other = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);

const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const nowSec = Math.floor(Date.now() / 1000);
const base = { iss: "https://token.actions.githubusercontent.com", aud: "https://api.esp32bench.dev", exp: nowSec + 300, nbf: nowSec - 10, repository: "doodersrage/esp32-bench", ref: "refs/heads/main", workflow: "Firmware library", run_id: "42", actor: "doodersrage" };
async function sign(claims: object, key = pair.privateKey, header = { alg: "RS256", kid: "k1", typ: "JWT" }) {
	const data = `${enc(header)}.${enc(claims)}`;
	const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(data)));
	return `${data}.${Buffer.from(sig).toString("base64url")}`;
}
const rules = { audience: "https://api.esp32bench.dev", repository: "doodersrage/esp32-bench", refs: ["refs/heads/main"] };
const source = async () => keys;
const v = (t: string, r = rules) => verifyGithubToken(t, r, Date.now(), source);

const good = await v(await sign(base));
assert.ok(good && good.workflow === "Firmware library" && good.run_id === "42", "valid token accepted");
assert.equal(await v(await sign(base, other.privateKey)), null, "wrong key");
assert.equal(await v(await sign({ ...base, repository: "someone/else" })), null, "other repository");
assert.equal(await v(await sign({ ...base, ref: "refs/heads/feature" })), null, "other branch");
assert.equal(await v(await sign({ ...base, aud: "https://other.example" })), null, "other audience");
assert.equal(await v(await sign({ ...base, exp: nowSec - 600 })), null, "expired");
assert.equal(await v(await sign({ ...base, iss: "https://evil.example" })), null, "other issuer");
assert.equal(await v(await sign(base, pair.privateKey, { alg: "none", kid: "k1", typ: "JWT" })), null, "alg none");
assert.equal(await v(await sign(base, pair.privateKey, { alg: "RS256", kid: "unknown", typ: "JWT" })), null, "unknown kid");
assert.equal(await v("not.a.token"), null);
assert.equal(await v(""), null);
const tampered = (await sign(base)).replace(/\.[^.]+$/, ".AAAA");
assert.equal(await v(tampered), null, "bad signature");
assert.ok(await v(await sign({ ...base, ref: "refs/heads/feature" }), { ...rules, refs: [] }), "any ref when refs empty");
console.log("github oidc: all checks pass");
