// Verifies a GitHub Actions OIDC token, so workflows in this repository can
// upload to the API without any shared secret. GitHub signs the token; we check
// the signature against GitHub's published keys and the claims we care about.

const ISSUER = "https://token.actions.githubusercontent.com";
const JWKS_URL = `${ISSUER}/.well-known/jwks`;

export interface OidcRules {
	audience: string;
	repository: string;
	/** Allowed refs, e.g. ["refs/heads/main"]. Empty allows any. */
	refs?: string[];
}

export interface OidcClaims {
	repository: string;
	ref: string;
	workflow: string;
	run_id: string;
	actor: string;
}

export interface Jwk {
	kid: string;
	kty: string;
	n: string;
	e: string;
}

let keys: { fetched: number; jwks: Jwk[] } | null = null;

function b64url(text: string): Uint8Array {
	const b64 = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
	return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function jwks(force = false): Promise<Jwk[]> {
	if (!force && keys && Date.now() - keys.fetched < 6 * 3600_000) return keys.jwks;
	const res = await fetch(JWKS_URL, { signal: AbortSignal.timeout(10_000) });
	if (!res.ok) throw new Error(`jwks ${res.status}`);
	const body = (await res.json()) as { keys: Jwk[] };
	keys = { fetched: Date.now(), jwks: body.keys };
	return keys.jwks;
}

/** Returns the claims when the token is valid for the rules, otherwise null. `keySource` is for tests only. */
export async function verifyGithubToken(
	token: string,
	rules: OidcRules,
	now = Date.now(),
	keySource: (force: boolean) => Promise<Jwk[]> = jwks,
): Promise<OidcClaims | null> {
	const parts = token.split(".");
	if (parts.length !== 3) return null;
	let header: { alg?: string; kid?: string };
	let claims: Record<string, unknown>;
	try {
		header = JSON.parse(new TextDecoder().decode(b64url(parts[0])));
		claims = JSON.parse(new TextDecoder().decode(b64url(parts[1])));
	} catch {
		return null;
	}
	if (header.alg !== "RS256" || !header.kid) return null;

	let key = (await keySource(false)).find((k) => k.kid === header.kid);
	if (!key) key = (await keySource(true)).find((k) => k.kid === header.kid);
	if (!key || key.kty !== "RSA") return null;

	const cryptoKey = await crypto.subtle.importKey(
		"jwk",
		{ kty: "RSA", n: key.n, e: key.e, alg: "RS256", ext: true },
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		false,
		["verify"],
	);
	const ok = await crypto.subtle.verify(
		"RSASSA-PKCS1-v1_5",
		cryptoKey,
		b64url(parts[2]),
		new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
	);
	if (!ok) return null;

	const nowSec = Math.floor(now / 1000);
	const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
	if (claims.iss !== ISSUER) return null;
	if (!aud.includes(rules.audience)) return null;
	if (typeof claims.exp !== "number" || claims.exp < nowSec - 60) return null;
	if (typeof claims.nbf === "number" && claims.nbf > nowSec + 60) return null;
	if (claims.repository !== rules.repository) return null;
	if (rules.refs?.length && !rules.refs.includes(String(claims.ref))) return null;
	return {
		repository: String(claims.repository),
		ref: String(claims.ref),
		workflow: String(claims.workflow ?? ""),
		run_id: String(claims.run_id ?? ""),
		actor: String(claims.actor ?? ""),
	};
}
