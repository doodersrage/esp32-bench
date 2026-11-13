// Community builds on a project page: approved build reports from the report API.
import { reportUrl } from "../lib/site";

interface Build {
  board: string;
  core: string;
  result: string;
  worked: boolean;
  output: string;
  notes: string;
  name: string;
  date: string;
}

interface LabResult {
  board: string;
  chip: string;
  status: "passed" | "failed" | "flash_failed" | "skipped";
  seconds: number;
  missing: string[];
  output: string;
}

interface Lab {
  run: { finished_at: string; core: string; firmware_built_at: string };
  results: LabResult[];
}

const box = document.querySelector<HTMLElement>("#community");
const labBox = box?.querySelector<HTMLElement>("[data-lab]");
const labTag = document.querySelector<HTMLElement>("[data-lab-tag]");
const status = box?.querySelector<HTMLElement>("[data-community-status]");
const list = box?.querySelector<HTMLUListElement>("[data-community-list]");

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function sendLink(label: string): HTMLAnchorElement {
  const a = el("a", "", label);
  a.href = reportUrl("build", { project: box?.dataset.project ?? "" });
  return a;
}

async function load(): Promise<void> {
  if (!box || !status || !list) return;
  try {
    const res = await fetch(`${box.dataset.builds}?project=${encodeURIComponent(box.dataset.project ?? "")}`);
    if (!res.ok) throw new Error(String(res.status));
    const { builds, lab } = (await res.json()) as { builds: Build[]; lab?: Lab | null };
    if (lab && lab.results.length > 0) showLab(lab);
    if (builds.length === 0) {
      status.replaceChildren("Nobody has published a build of this project yet. Built it? ", sendLink("Send the first build report"), ".");
      return;
    }
    const worked = builds.filter((b) => b.worked).length;
    status.replaceChildren(
      `${builds.length} published build ${builds.length === 1 ? "report" : "reports"}, ${worked} working. Built it too? `,
      sendLink("Add yours"),
      ".",
    );
    list.replaceChildren(
      ...builds.map((b) => {
        const li = el("li", "build");
        const head = el("div", "buildhead");
        head.append(
          el("span", `tag ${b.worked ? "ok" : "bad"}`, b.worked ? "Worked" : "Did not work"),
          el("span", "tag", b.board),
          ...(b.core ? [el("span", "tag", `core ${b.core}`)] : []),
          el("span", "buildby", `${b.name}, ${b.date}`),
        );
        li.append(head);
        if (b.result && !/^yes, as described$/i.test(b.result)) li.append(el("p", "buildresult", b.result));
        if (b.notes) li.append(el("p", "buildnotes", b.notes));
        if (b.output) li.append(el("pre", "code", b.output));
        return li;
      }),
    );
    list.hidden = false;
  } catch {
    status.replaceChildren(
      navigator.onLine ? "Community build reports could not be loaded right now. " : "Community build reports need a connection. ",
      "Built it? ",
      sendLink("Send a build report"),
      ".",
    );
  }
}

const BOARD_NAMES: Record<string, string> = {
  esp32: "ESP32", esp32s3: "ESP32-S3", esp32c3: "ESP32-C3", esp32s2: "ESP32-S2", esp32c6: "ESP32-C6",
  "xiao-esp32c3": "XIAO ESP32C3", "xiao-esp32s3": "XIAO ESP32S3", "esp32-cam": "ESP32-CAM",
  "esp32-doit": "ESP32 DOIT 30-pin", "esp32c3-supermini": "ESP32-C3 SuperMini",
};
const STATUS_WORD: Record<LabResult["status"], string> = { passed: "passed", failed: "failed", flash_failed: "could not be flashed", skipped: "skipped" };
const STATUS_CLASS: Record<LabResult["status"], string> = { passed: "ok", failed: "bad", flash_failed: "pending", skipped: "pending" };

function joinNames(names: string[]): string {
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The latest hardware lab run for this project, shown before visitors' reports. */
function showLab(lab: Lab): void {
  if (!labBox) return;
  const name = (b: string) => BOARD_NAMES[b] ?? b;
  const by = (status: LabResult["status"]) => lab.results.filter((r) => r.status === status).map((r) => name(r.board));
  const passed = by("passed");
  const parts: string[] = [];
  if (passed.length) parts.push(`passed on ${joinNames(passed)}`);
  const failed = by("failed");
  if (failed.length) parts.push(`failed on ${joinNames(failed)}`);
  const unflashed = by("flash_failed");
  if (unflashed.length) parts.push(`could not be flashed on ${joinNames(unflashed)}`);
  const date = lab.run.finished_at.slice(0, 10);

  const head = el("div", "labhead");
  head.append(el("span", "tag ok", "Lab"), ...lab.results.map((r) => el("span", `tag ${STATUS_CLASS[r.status]}`, `${name(r.board)}: ${STATUS_WORD[r.status]}`)), el("span", "labwhen", date));
  const line = el("p", "", `Ran in the ESP32 Bench lab on ${date}${lab.run.core ? ` with core ${lab.run.core}` : ""}: ${parts.join(", ")}. The lab flashes the prebuilt firmware onto a bare board and checks what it prints.`);
  const details = lab.results
    .filter((r) => r.output)
    .map((r) => {
      const d = el("details", "");
      d.append(el("summary", "", `${name(r.board)}: last lines the board printed${r.missing.length ? `, missing ${r.missing.length} expected ${r.missing.length === 1 ? "line" : "lines"}` : ""}`));
      if (r.missing.length) d.append(el("p", "", `Expected but not seen: ${r.missing.map((m) => `/${m}/`).join(", ")}`));
      d.append(el("pre", "code", r.output));
      return d;
    });
  labBox.replaceChildren(head, line, ...details);
  labBox.hidden = false;
  if (labTag && passed.length) labTag.hidden = false;
}

// Load when the section comes near the screen, so the page itself stays fast.
if (box) {
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        void load();
      }
    },
    { rootMargin: "400px" },
  );
  io.observe(box);
}
