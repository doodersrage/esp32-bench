// Fit reports on the /prints/ cards: approved 3D print reports from the report
// API (GET /builds/prints), shown under each part they are about. Nothing
// shows if there are none or the API cannot be reached.
interface PrintReport {
  part: string;
  printer: string;
  material: string;
  fit: string;
  notes: string;
  name: string;
  date: string;
}

const uiEl = document.getElementById("print-reports-ui");
if (uiEl) load(JSON.parse(uiEl.textContent ?? "{}"));

async function load(ui: { api: string; heading: string; line: string; fits: Record<string, string> }) {
  let reports: PrintReport[] = [];
  try {
    const res = await fetch(ui.api);
    if (!res.ok) return;
    reports = ((await res.json()) as { reports?: PrintReport[] }).reports ?? [];
  } catch {
    return;
  }
  const fill = (s: string, vars: Record<string, string>) => s.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
  for (const box of document.querySelectorAll<HTMLElement>("[data-print-reports]")) {
    const mine = reports.filter((r) => r.part === box.dataset.printReports);
    if (!mine.length) continue;
    const details = document.createElement("details");
    details.className = "prmore";
    const summary = document.createElement("summary");
    summary.textContent = fill(ui.heading, { n: String(mine.length) });
    const list = document.createElement("ul");
    list.className = "prreports";
    for (const r of mine) {
      const li = document.createElement("li");
      li.textContent = fill(ui.line, { fit: ui.fits[r.fit] ?? r.fit, printer: r.printer || "?", material: r.material || "?", name: r.name, date: r.date });
      if (r.notes) {
        const note = document.createElement("span");
        note.className = "prnote";
        note.textContent = r.notes;
        li.append(note);
      }
      list.append(li);
    }
    details.append(summary, list);
    box.replaceChildren(details);
    box.hidden = false;
  }
}
