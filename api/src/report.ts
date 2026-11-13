// Validation and formatting for report submissions. Pure functions, unit-tested.

export type Kind = "build" | "correction" | "message";

export interface Report {
	kind: Kind;
	page: string;
	project: string;
	board: string;
	core: string;
	result: string;
	output: string;
	notes: string;
	name: string;
	email: string;
	/** Project id from the site, e.g. "dht22"; build reports only */
	projectId: string;
	/** The sender agreed to publish this build report on the project page */
	publish: boolean;
	/** Name to show with a published report; "" shows as Anonymous */
	publicName: string;
}

const LIMITS: Record<keyof Report, number> = {
	kind: 20,
	page: 300,
	project: 120,
	board: 120,
	core: 40,
	result: 60,
	output: 6000,
	notes: 4000,
	name: 80,
	email: 120,
	projectId: 60,
	publish: 5,
	publicName: 40,
};

/** Minimum time between showing the form and sending it; bots are faster. */
export const MIN_FILL_MS = 3000;
const MAX_FILL_MS = 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/;

export type Checked = { ok: true; report: Report } | { ok: false; status: number; error: string; spam?: boolean };

const str = (v: unknown): string => (typeof v === "string" ? v.replace(/\r\n?/g, "\n").trim() : "");

export function checkReport(body: unknown, now: number): Checked {
	if (!body || typeof body !== "object") return { ok: false, status: 400, error: "Send the form as JSON." };
	const b = body as Record<string, unknown>;

	// Honeypot: a field people never see. Pretend success so bots learn nothing.
	if (str(b.website) !== "") return { ok: false, status: 200, error: "", spam: true };
	const shown = Number(b.t);
	if (!Number.isFinite(shown) || now - shown < MIN_FILL_MS || now - shown > MAX_FILL_MS) {
		return { ok: false, status: 400, error: "That was quick. Please wait a few seconds and send it again." };
	}

	const kind = str(b.kind);
	if (kind !== "build" && kind !== "correction" && kind !== "message") return { ok: false, status: 400, error: "Unknown report type." };

	const report = { kind } as Report;
	for (const key of Object.keys(LIMITS) as (keyof Report)[]) {
		if (key === "kind" || key === "publish") continue;
		const value = str(b[key]);
		if (value.length > LIMITS[key]) return { ok: false, status: 400, error: `The ${key} field is too long.` };
		(report as unknown as Record<string, string>)[key] = value;
	}
	report.publish = kind === "build" && b.publish === true;
	if (report.projectId && !/^[a-z0-9-]{1,60}$/.test(report.projectId)) return { ok: false, status: 400, error: "Unknown project." };
	if (report.publish && !report.projectId) return { ok: false, status: 400, error: "Choose a project to publish a build report." };
	if (report.email && !EMAIL_RE.test(report.email)) return { ok: false, status: 400, error: "That email address does not look right." };
	if (kind === "build" && (!report.project || !report.board || !report.result)) {
		return { ok: false, status: 400, error: "Say which project, which board and whether it worked." };
	}
	if (kind === "correction" && !report.notes) return { ok: false, status: 400, error: "Describe what is wrong." };
	if (kind === "message" && !report.notes) return { ok: false, status: 400, error: "Write a message." };
	return { ok: true, report };
}

const TITLES: Record<Kind, string> = { build: "Build report", correction: "Correction", message: "Message" };

export function subjectFor(r: Report): string {
	const about = r.kind === "build" ? r.project : r.kind === "correction" ? r.page : r.name || "visitor";
	return `[ESP32 Bench] ${TITLES[r.kind]}: ${about}`.replace(/[\r\n]+/g, " ").slice(0, 160);
}

export function textFor(r: Report, meta: { country: string; agent: string }): string {
	const rows: [string, string][] = [
		["Type", TITLES[r.kind]],
		["Page", r.page],
		["Project", r.project],
		["Board", r.board],
		["Core version", r.core],
		["Result", r.result],
		["Publish", r.kind === "build" ? (r.publish ? `yes, as ${r.publicName || "Anonymous"}` : "no") : ""],
		["From", [r.name, r.email].filter(Boolean).join(" ")],
		["Country", meta.country],
		["Browser", meta.agent.slice(0, 200)],
	];
	const head = rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n");
	const parts = [head];
	if (r.notes) parts.push(`${r.kind === "build" ? "Notes" : "Message"}:\n${r.notes}`);
	if (r.output) parts.push(`Serial output:\n${r.output}`);
	return parts.join("\n\n") + "\n";
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function htmlFor(text: string): string {
	return `<pre style="font: 14px/1.5 ui-monospace, Menlo, Consolas, monospace; white-space: pre-wrap">${esc(text)}</pre>`;
}
