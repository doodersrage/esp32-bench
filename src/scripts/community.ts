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

const box = document.querySelector<HTMLElement>("#community");
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
    const { builds } = (await res.json()) as { builds: Build[] };
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
    status.textContent = navigator.onLine
      ? "Community build reports could not be loaded right now."
      : "Community build reports need a connection.";
  }
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
