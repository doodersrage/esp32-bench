// Community builds on a project page: approved build reports from the report API.
import { reportUrl } from "../lib/site";
import { pageLocale, translator } from "../i18n/t";
import { PROJECT, withNode } from "../i18n/strings/project";

const t = translator(PROJECT, pageLocale());

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
      status.replaceChildren(...withNode(t("noneYet"), sendLink(t("sendFirst"))));
      return;
    }
    const worked = builds.filter((b) => b.worked).length;
    status.replaceChildren(...withNode(t(builds.length === 1 ? "countOne" : "countMany", { n: builds.length, worked }), sendLink(t("addYours"))));
    list.replaceChildren(
      ...builds.map((b) => {
        const li = el("li", "build");
        const head = el("div", "buildhead");
        head.append(
          el("span", `tag ${b.worked ? "ok" : "bad"}`, b.worked ? t("worked") : t("didNotWork")),
          el("span", "tag", b.board),
          ...(b.core ? [el("span", "tag", t("core", { v: b.core }))] : []),
          el("span", "buildby", t("buildBy", { name: b.name, date: b.date })),
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
    status.replaceChildren(...withNode(t(navigator.onLine ? "loadFail" : "needConnection"), sendLink(t("sendReport"))));
  }
}

const BOARD_NAMES: Record<string, string> = {
  esp32: "ESP32", esp32s3: "ESP32-S3", esp32c3: "ESP32-C3", esp32s2: "ESP32-S2", esp32c6: "ESP32-C6",
  "xiao-esp32c3": "XIAO ESP32C3", "xiao-esp32s3": "XIAO ESP32S3", "esp32-cam": "ESP32-CAM",
  "esp32-doit": "ESP32 DOIT 30-pin", "esp32c3-supermini": "ESP32-C3 SuperMini",
};
const statusWord = (s: LabResult["status"]) => t(`status.${s}`);
const STATUS_CLASS: Record<LabResult["status"], string> = { passed: "ok", failed: "bad", flash_failed: "pending", skipped: "pending" };

function joinNames(names: string[]): string {
  return names.length <= 1 ? names.join("") : t("and", { list: names.slice(0, -1).join(", "), last: names[names.length - 1] });
}

/** The latest hardware lab run for this project, shown before visitors' reports. */
function showLab(lab: Lab): void {
  if (!labBox) return;
  const name = (b: string) => BOARD_NAMES[b] ?? b;
  const by = (status: LabResult["status"]) => lab.results.filter((r) => r.status === status).map((r) => name(r.board));
  const passed = by("passed");
  const parts: string[] = [];
  if (passed.length) parts.push(t("passedOn", { boards: joinNames(passed) }));
  const failed = by("failed");
  if (failed.length) parts.push(t("failedOn", { boards: joinNames(failed) }));
  const unflashed = by("flash_failed");
  if (unflashed.length) parts.push(t("unflashedOn", { boards: joinNames(unflashed) }));
  const date = lab.run.finished_at.slice(0, 10);

  const head = el("div", "labhead");
  head.append(el("span", "tag ok", t("lab")), ...lab.results.map((r) => el("span", `tag ${STATUS_CLASS[r.status]}`, `${name(r.board)}: ${statusWord(r.status)}`)), el("span", "labwhen", date));
  const results = parts.join(", ");
  const line = el("p", "", lab.run.core ? t("labLineCore", { date, core: lab.run.core, results }) : t("labLine", { date, results }));
  const details = lab.results
    .filter((r) => r.output)
    .map((r) => {
      const d = el("details", "");
      const board = name(r.board);
      const n = r.missing.length;
      d.append(el("summary", "", n ? t(n === 1 ? "labLastMissingOne" : "labLastMissingMany", { board, n }) : t("labLast", { board })));
      if (n) d.append(el("p", "", t("expectedNotSeen", { list: r.missing.map((m) => `/${m}/`).join(", ") })));
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
