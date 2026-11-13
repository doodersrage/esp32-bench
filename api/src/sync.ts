// Sync codes: a browser's bench log, shopping list and parts drawer stored
// under a random code, so another browser that knows the code can share them.
// No account, no email: the code is the only key, and only its SHA-256 is stored.

/** Crockford base32: no I, L, O or U, so a code read aloud or retyped survives. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
/** 16 characters of 5 bits: 80 random bits, far beyond guessing. */
const LENGTH = 16;

/** The localStorage keys (after "bench.") a sync code carries. View settings like sort order stay per browser. */
export const SYNC_KEYS = ["built", "flashed", "seen", "shop", "drawer", "board"] as const;
export type SyncData = Partial<Record<(typeof SYNC_KEYS)[number], string>>;

const MAX_VALUE = 48_000;
const MAX_TOTAL = 64_000;

/** A new random code, grouped for reading: 7KQ4-M2XD-9PLA-R3TW. */
export function newSyncCode(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(LENGTH));
	// 256 is a multiple of 32, so taking the low 5 bits is unbiased.
	const chars = [...bytes].map((b) => ALPHABET[b & 31]);
	return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join("")).join("-");
}

/** The canonical form of a typed code, or null. Forgives case, spaces, dashes and look-alike letters. */
export function normaliseCode(input: unknown): string | null {
	if (typeof input !== "string" || input.length > 64) return null;
	const raw = input
		.toUpperCase()
		.replace(/[\s-]/g, "")
		.replace(/O/g, "0")
		.replace(/[IL]/g, "1");
	if (raw.length !== LENGTH || [...raw].some((c) => !ALPHABET.includes(c))) return null;
	return [0, 4, 8, 12].map((i) => raw.slice(i, i + 4)).join("-");
}

/** Only the known keys, only strings, within size limits. The values stay opaque: the browser owns their format. */
export function checkSyncData(input: unknown): { ok: true; data: SyncData } | { ok: false; error: string } {
	if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, error: "Send the data as an object." };
	const data: SyncData = {};
	for (const key of SYNC_KEYS) {
		const v = (input as Record<string, unknown>)[key];
		if (v === undefined || v === null) continue;
		if (typeof v !== "string") return { ok: false, error: `${key} must be a string.` };
		if (v.length > MAX_VALUE) return { ok: false, error: `${key} is too long.` };
		data[key] = v;
	}
	if (JSON.stringify(data).length > MAX_TOTAL) return { ok: false, error: "That is too much data." };
	return { ok: true, data };
}

/** The code from an "Authorization: Bearer <code>" header, normalised; null when missing or malformed. */
export function codeFrom(request: Request): string | null {
	const auth = request.headers.get("Authorization") ?? "";
	return auth.startsWith("Bearer ") ? normaliseCode(auth.slice(7).trim()) : null;
}
