// Published build reports: moderation tokens, the approval page and the public JSON.

export interface BuildRow {
	id: number;
	project: string;
	board: string;
	core: string;
	result: string;
	output: string;
	notes: string;
	public_name: string;
	created_at: string;
	status: "pending" | "approved" | "rejected";
}

/** A random URL-safe token for the moderation link, and its SHA-256 for the database. */
export async function newToken(): Promise<{ token: string; hash: string }> {
	const bytes = crypto.getRandomValues(new Uint8Array(24));
	const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
	return { token, hash: await sha256(token) };
}

export async function sha256(text: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time comparison of two hex strings. */
export function sameHash(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

/** What the public sees: no ids, tokens, emails or exact times. */
/** A report worked unless its result starts with "No". */
const worked = (result: string) => !/^no\b/i.test(result);

/** Approved reports counted per project and board, for the compatibility table. */
export function summarise(rows: Pick<BuildRow, "project" | "board" | "result">[]) {
	const cells = new Map<string, { project: string; board: string; worked: number; failed: number }>();
	for (const r of rows) {
		const key = `${r.project}\u0000${r.board}`;
		const cell = cells.get(key) ?? { project: r.project, board: r.board, worked: 0, failed: 0 };
		if (worked(r.result)) cell.worked++;
		else cell.failed++;
		cells.set(key, cell);
	}
	return [...cells.values()];
}

export function publicBuild(r: BuildRow) {
	return {
		board: r.board,
		core: r.core,
		result: r.result,
		worked: worked(r.result),
		output: r.output,
		notes: r.notes,
		name: r.public_name || "Anonymous",
		date: r.created_at.slice(0, 10),
	};
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function page(title: string, body: string): string {
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)}</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:680px;margin:32px auto;padding:0 16px;color:#14231f;background:#f2f5f1}
h1{font-size:1.4rem}pre{background:#13211e;color:#d9e5df;padding:12px;overflow:auto;white-space:pre-wrap}
dl{display:grid;grid-template-columns:auto 1fr;gap:4px 12px}dt{font-weight:600}dd{margin:0}
button{font:inherit;padding:10px 18px;margin-right:8px;border:1px solid #14231f;background:#fff;cursor:pointer}
button.go{background:#1d7a4c;border-color:#1d7a4c;color:#fff}button.no{color:#c0341a;border-color:#c0341a}</style></head>
<body>${body}</body></html>`;
}

/** The page the email links to. Nothing changes until a button is pressed (POST), so link scanners cannot approve. */
export function moderationPage(row: BuildRow, token: string, projectName: string): string {
	const decided = row.status !== "pending";
	return page(
		`Build report ${row.id}`,
		`<h1>Build report for ${esc(projectName)}</h1>
<p>Status: <strong>${row.status}</strong>${decided ? "" : ". Approving shows it on the project page."}</p>
<dl><dt>Name shown</dt><dd>${esc(row.public_name || "Anonymous")}</dd><dt>Board</dt><dd>${esc(row.board)}</dd>
<dt>Core</dt><dd>${esc(row.core || "not given")}</dd><dt>Result</dt><dd>${esc(row.result)}</dd><dt>Sent</dt><dd>${esc(row.created_at)}</dd></dl>
${row.notes ? `<h2>Notes</h2><p>${esc(row.notes).replace(/\n/g, "<br>")}</p>` : ""}
${row.output ? `<h2>Serial output</h2><pre>${esc(row.output)}</pre>` : ""}
<form method="post"><input type="hidden" name="t" value="${esc(token)}">
<button class="go" name="action" value="approve"${row.status === "approved" ? " disabled" : ""}>Approve and publish</button>
<button class="no" name="action" value="reject"${row.status === "rejected" ? " disabled" : ""}>Reject</button></form>`,
	);
}

export function resultPage(title: string, message: string, link?: string): string {
	return page(title, `<h1>${esc(title)}</h1><p>${esc(message)}</p>${link ? `<p><a href="${esc(link)}">${esc(link)}</a></p>` : ""}`);
}
