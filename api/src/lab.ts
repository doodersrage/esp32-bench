// Hardware lab runs: validation of what the runner posts, and the public shape.

export type LabStatus = "passed" | "failed" | "flash_failed" | "skipped";
const STATUSES: LabStatus[] = ["passed", "failed", "flash_failed", "skipped"];

export interface LabResultIn {
	project: string;
	board: string;
	chip: string;
	status: LabStatus;
	seconds: number;
	matched: string[];
	missing: string[];
	output: string;
}

export interface LabRunIn {
	runner: string;
	started_at: string;
	finished_at: string;
	core: string;
	firmware_built_at: string;
	results: LabResultIn[];
}

export type LabChecked = { ok: true; run: LabRunIn } | { ok: false; error: string };

const SLUG = /^[a-z0-9][a-z0-9-]{0,59}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
export const MAX_OUTPUT = 8000;
export const MAX_RESULTS = 1000;

const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.length <= max ? v : null);

function strings(v: unknown, maxEach: number, maxCount: number): string[] | null {
	if (!Array.isArray(v) || v.length > maxCount) return null;
	const out: string[] = [];
	for (const x of v) {
		if (typeof x !== "string" || x.length > maxEach) return null;
		out.push(x);
	}
	return out;
}

/** Checks a run report from the lab runner. */
export function checkLabRun(body: unknown): LabChecked {
	if (!body || typeof body !== "object") return { ok: false, error: "Send JSON." };
	const b = body as Record<string, unknown>;
	const runner = str(b.runner ?? "", 60);
	const started = str(b.started_at, 40);
	const finished = str(b.finished_at, 40);
	const core = str(b.core ?? "", 40);
	const built = str(b.firmware_built_at ?? "", 40);
	if (runner === null || core === null || built === null) return { ok: false, error: "runner, core and firmware_built_at must be short strings." };
	if (!started || !finished || !ISO.test(started) || !ISO.test(finished)) return { ok: false, error: "started_at and finished_at must be ISO-8601 times." };
	if (!Array.isArray(b.results) || b.results.length === 0) return { ok: false, error: "results must be a non-empty array." };
	if (b.results.length > MAX_RESULTS) return { ok: false, error: "Too many results." };

	const results: LabResultIn[] = [];
	for (const raw of b.results) {
		if (!raw || typeof raw !== "object") return { ok: false, error: "Each result must be an object." };
		const r = raw as Record<string, unknown>;
		const project = str(r.project, 60);
		const board = str(r.board, 60);
		const chip = str(r.chip ?? "", 20) ?? "";
		if (!project || !SLUG.test(project)) return { ok: false, error: `Bad project id: ${String(r.project).slice(0, 40)}` };
		if (!board || !SLUG.test(board)) return { ok: false, error: `Bad board id for ${project}.` };
		if (!STATUSES.includes(r.status as LabStatus)) return { ok: false, error: `Bad status for ${project}.` };
		const seconds = Number(r.seconds ?? 0);
		if (!Number.isFinite(seconds) || seconds < 0 || seconds > 3600) return { ok: false, error: `Bad seconds for ${project}.` };
		const matched = strings(r.matched ?? [], 300, 50);
		const missing = strings(r.missing ?? [], 300, 50);
		if (!matched || !missing) return { ok: false, error: `matched and missing must be arrays of patterns for ${project}.` };
		const output = typeof r.output === "string" ? r.output.replace(/\r\n?/g, "\n").slice(-MAX_OUTPUT) : "";
		results.push({ project, board, chip, status: r.status as LabStatus, seconds: Math.round(seconds), matched, missing, output });
	}
	return { ok: true, run: { runner, started_at: started, finished_at: finished, core, firmware_built_at: built, results } };
}

/** Constant-time comparison for the lab token. */
export function tokenMatches(given: string, expected: string): boolean {
	const a = new TextEncoder().encode(given);
	const b = new TextEncoder().encode(expected);
	if (a.length !== b.length || a.length === 0) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
	return diff === 0;
}

export interface LabResultRow {
	project: string;
	board: string;
	chip: string;
	status: LabStatus;
	seconds: number;
	matched: string;
	missing: string;
	output: string;
}

export interface LabRunRow {
	id: number;
	finished_at: string;
	core: string;
	firmware_built_at: string;
}

const parseList = (text: string): string[] => {
	try {
		const v = JSON.parse(text);
		return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
	} catch {
		return [];
	}
};

/** The last `lines` lines of a capture, for the public page. */
export function tail(output: string, lines = 20): string {
	const all = output.replace(/\r\n?/g, "\n").replace(/\n+$/, "").split("\n");
	return all.slice(-lines).join("\n");
}

/** What the project page shows: no run ids, runner names or full captures. */
export function publicLab(run: LabRunRow, rows: LabResultRow[]) {
	return {
		run: { finished_at: run.finished_at, core: run.core, firmware_built_at: run.firmware_built_at },
		results: rows.map((r) => ({
			board: r.board,
			chip: r.chip,
			status: r.status,
			seconds: r.seconds,
			missing: parseList(r.missing),
			output: tail(r.output),
		})),
	};
}
