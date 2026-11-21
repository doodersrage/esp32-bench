// Hardware lab runs: validation of what the runner posts, and the public shape.

export type LabStatus = "passed" | "failed" | "flash_failed" | "skipped";
/** "full": the lab rig's parts were wired and the patterns needed them; "boot": a bare-board check. */
export type LabCheck = "boot" | "full";
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
	check: LabCheck;
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
		// Older runners send no check: theirs were all bare-board checks.
		const check = r.check ?? "boot";
		if (check !== "boot" && check !== "full") return { ok: false, error: `Bad check for ${project}.` };
		results.push({ project, board, chip, status: r.status as LabStatus, seconds: Math.round(seconds), matched, missing, output, check });
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
	checked: LabCheck;
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
			check: r.checked === "full" ? "full" : "boot",
			missing: parseList(r.missing),
			output: tail(r.output),
		})),
	};
}

// --- The quiet-lab email --------------------------------------------------------

const DAY = 86_400_000;
/** Weekly runs leave a 7-day gap; a day of slack before saying anything. */
export const QUIET_AFTER_DAYS = 8;

/**
 * The email to send when the lab has gone quiet, or null. Checked once a day by
 * the Worker's cron; it fires on day 8 after the last run and every 7 days after
 * that, so a lab left off sends one email a week, not one a day, with nothing
 * stored. No run ever posted means the lab was never set up: no email.
 */
export function quietLabNotice(lastFinishedAt: string | null, now: number): { subject: string; text: string } | null {
	if (!lastFinishedAt) return null;
	const last = Date.parse(lastFinishedAt);
	if (!Number.isFinite(last)) return null;
	const days = Math.floor((now - last) / DAY);
	if (days < QUIET_AFTER_DAYS || (days - QUIET_AFTER_DAYS) % 7 !== 0) return null;
	const date = new Date(last).toISOString().slice(0, 10);
	return {
		subject: `ESP32 Bench lab: no run for ${days} days`,
		text: [
			`The hardware lab has not posted a run since ${date} (${days} days ago).`,
			"",
			"On the Pi, check the timer and the last log:",
			"  systemctl --user list-timers esp32-bench-lab.timer",
			"  journalctl --user -u esp32-bench-lab.service -n 50",
			"",
			"If the timer is missing, see \"Weekly runs\" in lab/README.md. This email repeats weekly until a run comes in.",
		].join("\n"),
	};
}
