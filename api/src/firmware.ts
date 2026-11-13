// The firmware library: GitHub Actions uploads prebuilt images into the R2
// bucket served at fw.esp32bench.dev. Only this repository's main branch may.
import { verifyGithubToken } from "./github-oidc.ts";

const KEY = /^(?:[a-z0-9][a-z0-9-]{0,60}\/)?(?:[a-z0-9][a-z0-9-]{0,60}\.(?:bin|json))$/;
/** Gzipped firmware ELFs for the backtrace decoder, named by their SHA-256: elf/<32 hex digits>.gz */
const ELF_KEY = /^elf\/[0-9a-f]{32}\.gz$/;
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_ELF_BYTES = 32 * 1024 * 1024;

const TYPES: Record<string, string> = { bin: "application/octet-stream", json: "application/json; charset=utf-8", gz: "application/gzip" };

export async function uploadFirmware(request: Request, key: string, bucket: R2Bucket, audience: string, repository: string): Promise<Response> {
	const json = (body: unknown, status: number) =>
		new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

	const isElf = ELF_KEY.test(key);
	if (!KEY.test(key) && !isElf) return json({ ok: false, error: "Key must be <project>/<file>.bin|json, index.json or elf/<sha>.gz." }, 400);
	const maxBytes = isElf ? MAX_ELF_BYTES : MAX_BYTES;
	const auth = request.headers.get("Authorization") ?? "";
	const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
	if (!token) return json({ ok: false, error: "Missing bearer token." }, 401);
	const claims = await verifyGithubToken(token, { audience, repository, refs: ["refs/heads/main"] });
	if (!claims) return json({ ok: false, error: "Token not accepted." }, 403);

	const length = Number(request.headers.get("Content-Length") ?? 0);
	if (length > maxBytes) return json({ ok: false, error: "File too large." }, 413);
	const body = new Uint8Array(await request.arrayBuffer());
	if (body.byteLength === 0 || body.byteLength > maxBytes) return json({ ok: false, error: "Empty or too large." }, 413);
	if (key.endsWith(".json")) {
		try {
			JSON.parse(new TextDecoder().decode(body));
		} catch {
			return json({ ok: false, error: "Not valid JSON." }, 400);
		}
	}
	const ext = key.slice(key.lastIndexOf(".") + 1);
	await bucket.put(key, body, {
		httpMetadata: { contentType: TYPES[ext], cacheControl: key.endsWith("index.json") ? "public, max-age=300" : isElf ? "public, max-age=31536000, immutable" : "public, max-age=86400" },
		customMetadata: { workflow: claims.workflow, run: claims.run_id, actor: claims.actor },
	});
	return json({ ok: true, key, size: body.byteLength }, 200);
}
