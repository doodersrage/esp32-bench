// Server-side Turnstile check. Fails closed: any doubt means "not verified".

export interface TurnstileOptions {
	secret: string | undefined;
	token: unknown;
	ip: string;
	expectedAction: string;
	expectedHostnames: Set<string>;
	fetcher?: typeof fetch;
}

export async function verifyTurnstile(o: TurnstileOptions): Promise<boolean> {
	const { token, secret } = o;
	if (!secret || typeof token !== "string" || token.length === 0 || token.length > 2048 || o.expectedHostnames.size === 0) {
		return false;
	}
	let result: { success?: boolean; action?: string; hostname?: string };
	try {
		const res = await (o.fetcher ?? fetch)("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			signal: AbortSignal.timeout(10_000),
			body: new URLSearchParams({ secret, response: token, remoteip: o.ip }),
		});
		if (!res.ok) return false;
		result = await res.json();
	} catch {
		return false;
	}
	return result.success === true && result.action === o.expectedAction && o.expectedHostnames.has(result.hostname ?? "");
}
