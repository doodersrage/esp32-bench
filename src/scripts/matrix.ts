// Compatibility table: fill the supported squares with hardware lab results and
// approved build reports. Without a connection the table still shows support.
const table = document.getElementById("mx") as HTMLTableElement | null;
const summary = document.getElementById("mx-summary");

interface Cell {
  lab?: "passed" | "failed";
  worked: number;
  failed: number;
}

async function getJson<T>(url: string | undefined): Promise<T | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

async function fill() {
  if (!table) return;
  const names = JSON.parse(table.dataset.names ?? "{}") as Record<string, string>;
  const [builds, lab] = await Promise.all([
    getJson<{ cells: { project: string; board: string; worked: number; failed: number }[] }>(table.dataset.builds),
    getJson<{ run: { finished_at: string } | null; projects: Record<string, { board: string; status: string }[]> }>(table.dataset.lab),
  ]);
  const cells = new Map<string, Cell>();
  const at = (key: string) => {
    let c = cells.get(key);
    if (!c) cells.set(key, (c = { worked: 0, failed: 0 }));
    return c;
  };
  for (const [project, results] of Object.entries(lab?.projects ?? {})) {
    for (const r of results) {
      if (r.status !== "passed" && r.status !== "failed") continue;
      const c = at(`${project}|${r.board}`);
      // One pass on any lab board of this kind counts.
      if (c.lab !== "passed") c.lab = r.status;
    }
  }
  for (const b of builds?.cells ?? []) {
    const board = names[b.board];
    if (!board) continue;
    const c = at(`${b.project}|${board}`);
    c.worked += b.worked;
    c.failed += b.failed;
  }

  let labbed = 0;
  let reported = 0;
  for (const td of table.querySelectorAll<HTMLTableCellElement>("td[data-cell]")) {
    const c = cells.get(td.dataset.cell ?? "");
    if (!c) continue;
    const parts: string[] = [];
    const notes: string[] = [];
    if (c.lab === "passed") parts.push("Lab");
    if (c.lab) notes.push(`hardware lab: ${c.lab}`);
    if (c.worked) parts.push(String(c.worked));
    if (c.worked || c.failed) notes.push(`${c.worked} build reports worked, ${c.failed} did not`);
    if (c.failed && !c.worked && c.lab !== "passed") parts.push(`✗${c.failed}`);
    td.textContent = parts.join(" ") || "✗";
    td.className = `mxc ${c.lab === "passed" || c.worked > c.failed ? "ok" : c.failed || c.lab === "failed" ? "bad" : "sup"}`;
    td.title = `${td.title.split(":")[0]}: ${notes.join("; ")}`;
    if (c.lab === "passed") labbed++;
    if (c.worked) reported++;
  }
  if (summary) {
    summary.textContent =
      !builds && !lab
        ? "Results could not be loaded right now; the table shows supported combinations only."
        : labbed === 0 && reported === 0
          ? "No hardware lab results or approved build reports yet."
          : `${labbed} combinations passed the hardware lab${lab?.run ? ` (run of ${lab.run.finished_at.slice(0, 10)})` : ""}, and ${reported} have a build report that worked.`;
  }
}

void fill();
