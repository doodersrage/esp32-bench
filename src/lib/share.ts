// Pack a serial log into a URL fragment and back. The fragment (#log=...) is
// never sent to a server, so a shared log stays between the people who have the link.

/** Longest log kept in a link; older lines are dropped first. */
export const MAX_SHARE_CHARS = 12_000;

/** Keep the last lines that fit, so the crash at the end survives. */
export function trimLog(text: string, max = MAX_SHARE_CHARS): { text: string; trimmed: boolean } {
  const clean = text.replace(/\r\n?/g, "\n").replace(/\n+$/, "");
  if (clean.length <= max) return { text: clean, trimmed: false };
  const tail = clean.slice(clean.length - max);
  const cut = tail.indexOf("\n");
  return { text: cut >= 0 ? tail.slice(cut + 1) : tail, trimmed: true };
}

function toBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** Compressed, URL-safe form of a log: "1." + base64url(deflate-raw(utf-8)). */
export async function encodeLog(text: string): Promise<string> {
  const packed = await pipe(new TextEncoder().encode(text), new CompressionStream("deflate-raw"));
  return `1.${toBase64Url(packed)}`;
}

/** Inverse of encodeLog. Returns null for anything that is not a valid shared log. */
export async function decodeLog(code: string): Promise<string | null> {
  const m = /^1\.([A-Za-z0-9_-]{1,40000})$/.exec(code);
  if (!m) return null;
  try {
    const bytes = await pipe(fromBase64Url(m[1]), new DecompressionStream("deflate-raw"));
    if (bytes.length > MAX_SHARE_CHARS * 4) return null;
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** Read #log=... from a location hash. */
export function logCodeFromHash(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return params.get("log");
}
