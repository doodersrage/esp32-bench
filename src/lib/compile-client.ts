// Talking to the compile service (compile.esp32bench.dev): building the request,
// reading the answer, and turning compiler errors into editor positions.
// Pure functions, tested in tests/editor.test.ts.

export interface CompileRequest {
  board: string;
  code: string;
  libs?: string[];
  partitions?: "huge_app";
}

export interface CompileError {
  file: string;
  line: number;
  col: number;
  message: string;
  inSketch: boolean;
}

export interface CompileSizes {
  flashUsed: number;
  flashTotal: number;
  ramUsed: number;
  ramTotal: number;
}

export interface CompileAnswer {
  ok: boolean;
  board?: string;
  chip?: string;
  core?: string;
  seconds?: number;
  totalSeconds?: number;
  errors?: CompileError[];
  warnings?: (CompileError | string)[];
  sizes?: Partial<CompileSizes>;
  failure?: string;
  log?: string;
  image_b64?: string;
  image_bytes?: number;
  bootloader_offset?: number;
  error?: string;
}

/** What the page shows after a build attempt. */
export type CompileResult =
  | { kind: "built"; answer: CompileAnswer; image: Uint8Array | null }
  | { kind: "errors"; answer: CompileAnswer; sketch: CompileError[]; other: CompileError[] }
  | { kind: "failure"; answer: CompileAnswer; message: string }
  | { kind: "busy"; message: string }
  | { kind: "unavailable"; message: string }
  | { kind: "rejected"; message: string };

/** Largest sketch the service accepts. */
export const MAX_CODE_BYTES = 150 * 1024;

/** The request body. Libraries keep the site's names; "built in" ones are left out, duplicates dropped. */
export function buildRequest(board: string, code: string, libs: string[] = [], hugeApp = false): CompileRequest {
  const wanted = [...new Set(libs.map((l) => l.trim()).filter((l) => l && !/built in/i.test(l)))];
  return {
    board,
    code,
    ...(wanted.length ? { libs: wanted } : {}),
    ...(hugeApp ? { partitions: "huge_app" as const } : {}),
  };
}

/** Problems worth stopping for before sending anything. */
export function checkBeforeBuild(code: string): string | null {
  if (!code.trim()) return "The sketch is empty.";
  if (new TextEncoder().encode(code).length > MAX_CODE_BYTES) return "The sketch is larger than 150 KB, which is the most the compiler accepts.";
  if (!/\bvoid\s+setup\s*\(/.test(code) || !/\bvoid\s+loop\s*\(/.test(code)) {
    return "An Arduino sketch needs both setup() and loop() functions.";
  }
  return null;
}

/** Decode the merged image from base64. */
export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s+/g, ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** A merged image starts with the bootloader's 0xE9 magic at the chip's bootloader offset. */
export function looksLikeImage(image: Uint8Array, bootloaderOffset = 0): boolean {
  const app = 0x10000;
  return image.length > app && image[bootloaderOffset] === 0xe9 && image[app] === 0xe9;
}

/** Turn an HTTP status and parsed body into what the page should show. */
export function readAnswer(status: number, body: CompileAnswer | null): CompileResult {
  const said = body?.error?.trim();
  if (status === 429) {
    return { kind: "busy", message: said || "You've reached the build limit for now. Try again in a minute, or tomorrow if it's the daily limit." };
  }
  if (status === 503 || status === 502 || status === 504) {
    return { kind: "unavailable", message: said || "The compiler could not be reached. It may be starting up: try again in a minute." };
  }
  if (status !== 200 || !body) {
    return { kind: "rejected", message: said || `The compiler refused the request (error ${status}).` };
  }
  if (body.ok) {
    const image = body.image_b64 ? base64ToBytes(body.image_b64) : null;
    return { kind: "built", answer: body, image };
  }
  const errors = body.errors ?? [];
  if (errors.length) {
    return { kind: "errors", answer: body, sketch: errors.filter((e) => e.inSketch), other: errors.filter((e) => !e.inSketch) };
  }
  return { kind: "failure", answer: body, message: body.failure?.trim() || "The build failed. The log below says why." };
}

/** What to say while waiting, from GET /health. */
export function healthMessage(state: string | undefined): string {
  if (state === "sleeping" || state === "starting") return "Waking the compiler, about 30 s...";
  return "Building...";
}

/**
 * Character range for an error in the editor's text: the line's start plus the
 * column (1-based), clamped to the line, to the end of the word there.
 */
export function errorRange(code: string, line: number, col: number): { from: number; to: number; line: number } {
  const lines = code.split("\n");
  const n = Math.min(Math.max(1, Math.trunc(line) || 1), lines.length);
  let start = 0;
  for (let i = 0; i < n - 1; i++) start += lines[i].length + 1;
  const text = lines[n - 1];
  const c = Math.min(Math.max(1, Math.trunc(col) || 1), Math.max(1, text.length));
  const from = start + c - 1;
  const word = /^[A-Za-z0-9_]+/.exec(text.slice(c - 1));
  const to = text.length === 0 ? from : from + Math.max(1, word ? word[0].length : 1);
  return { from: Math.min(from, start + text.length), to: Math.min(to, start + text.length), line: n };
}

/** localStorage key for an edited sketch. */
export function storageKey(project: string, board: string): string {
  return `bench.edit.${project}.${board}`;
}

/** Bytes as "312 KB". */
export function kb(bytes: number): string {
  return `${Math.round(bytes / 1024).toLocaleString("en")} KB`;
}

/** Share of a budget as a whole percentage, 0 when unknown. */
export function percent(used?: number, total?: number): number {
  if (!used || !total) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}
