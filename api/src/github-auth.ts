// Sign in with GitHub, for sync: another way to reach the same kind of sync row
// a code reaches. GitHub only tells us who someone is: no scopes are asked
// for, so there is no access to repositories or email. We keep a SHA-256 of
// "github:<numeric account id>" as the row's key, and a SHA-256 of a random
// sign-in key per browser. GitHub's access token is revoked at once and never
// stored; the login name and email are never read into storage.
//
// Flow: /auth/github/start?return=<page> sets a short-lived state cookie on
// the API and sends the browser to GitHub; GitHub returns to
// /auth/github/callback, which checks the state, asks GitHub for the account
// id, starts a session and sends the browser back to <page>#sync-session=<key>.
// The key rides in the URL fragment, which browsers never send to a server.

export const STATE_COOKIE = "gh_state";
const STATE_MAX_AGE = 600;

/** Sign-in keys look like gh_ + 43 base64url characters (256 random bits), so they never collide with codes. */
export function newSessionKey(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return `gh_${btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}

export const isSessionKey = (s: string): boolean => /^gh_[A-Za-z0-9_-]{43}$/.test(s);

/** The sign-in key from an "Authorization: Bearer gh_…" header, or null. */
export function sessionKeyFrom(request: Request): string | null {
	const auth = request.headers.get("Authorization") ?? "";
	const key = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
	return isSessionKey(key) ? key : null;
}

/** The sync row key for a GitHub account, before hashing. */
export const accountKey = (githubId: number): string => `github:${githubId}`;

/** A page to send the browser back to: only on one of the site's own origins, and never with a fragment of its own. */
export function safeReturn(input: string | null, allowedOrigins: string[]): string | null {
	if (!input) return null;
	try {
		const url = new URL(input);
		if (!allowedOrigins.includes(url.origin)) return null;
		url.hash = "";
		return url.toString();
	} catch {
		return null;
	}
}

export function authorizeUrl(clientId: string, redirectUri: string, state: string): string {
	const url = new URL("https://github.com/login/oauth/authorize");
	url.searchParams.set("client_id", clientId);
	url.searchParams.set("redirect_uri", redirectUri);
	url.searchParams.set("state", state);
	// No scope: the public profile only, which is all we need to tell accounts apart.
	url.searchParams.set("allow_signup", "true");
	return url.toString();
}

/** State cookie: the random state and the page to return to, readable only by the API. */
export function stateCookie(state: string, returnTo: string, secure: boolean): string {
	const value = `${state}.${btoa(returnTo).replace(/=+$/, "")}`;
	return `${STATE_COOKIE}=${value}; Max-Age=${STATE_MAX_AGE}; Path=/auth/github; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export const clearStateCookie = (secure: boolean) => `${STATE_COOKIE}=; Max-Age=0; Path=/auth/github; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;

export function readStateCookie(request: Request): { state: string; returnTo: string } | null {
	const cookie = request.headers.get("Cookie") ?? "";
	const raw = cookie
		.split(";")
		.map((c) => c.trim())
		.find((c) => c.startsWith(`${STATE_COOKIE}=`))
		?.slice(STATE_COOKIE.length + 1);
	if (!raw) return null;
	const dot = raw.indexOf(".");
	if (dot < 1) return null;
	try {
		return { state: raw.slice(0, dot), returnTo: atob(raw.slice(dot + 1)) };
	} catch {
		return null;
	}
}

/** Swap GitHub's one-time code for the account's numeric id, then revoke the access token. */
export async function githubAccountId(
	opts: { clientId: string; clientSecret: string; code: string; redirectUri: string },
	fetcher: typeof fetch = fetch,
): Promise<number | null> {
	const tokenRes = await fetcher("https://github.com/login/oauth/access_token", {
		method: "POST",
		headers: { Accept: "application/json", "Content-Type": "application/json" },
		body: JSON.stringify({ client_id: opts.clientId, client_secret: opts.clientSecret, code: opts.code, redirect_uri: opts.redirectUri }),
	});
	if (!tokenRes.ok) return null;
	const { access_token: token } = (await tokenRes.json()) as { access_token?: string };
	if (!token) return null;
	try {
		const userRes = await fetcher("https://api.github.com/user", {
			headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "esp32-bench-sync" },
		});
		if (!userRes.ok) return null;
		const { id } = (await userRes.json()) as { id?: unknown };
		return typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? id : null;
	} finally {
		// We only needed to know who it was: give the token back.
		await fetcher(`https://api.github.com/applications/${opts.clientId}/token`, {
			method: "DELETE",
			headers: {
				Authorization: `Basic ${btoa(`${opts.clientId}:${opts.clientSecret}`)}`,
				Accept: "application/vnd.github+json",
				"Content-Type": "application/json",
				"User-Agent": "esp32-bench-sync",
			},
			body: JSON.stringify({ access_token: token }),
		}).catch(() => undefined);
	}
}
