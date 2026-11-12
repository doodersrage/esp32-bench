// Report form: switches fields by report type, fills in from the address,
// and posts JSON to the report API, which emails the site owner.
import { PROJECTS } from "../data/projects";

type Kind = "build" | "correction" | "message";
const KINDS: Kind[] = ["build", "correction", "message"];

const form = document.querySelector<HTMLFormElement>("#report");
const status = document.querySelector<HTMLElement>("#report-status");
const thanks = document.querySelector<HTMLElement>("#thanks");
const send = document.querySelector<HTMLButtonElement>("#send");

if (form && status && thanks && send) {
  const api = form.dataset.api ?? "";
  let shownAt = Date.now();
  const field = <T extends HTMLElement = HTMLInputElement>(name: string) => form.elements.namedItem(name) as T | null;

  function setKind(kind: Kind): void {
    for (const el of form!.querySelectorAll<HTMLElement>("[data-for]")) {
      const on = el.dataset.for === kind;
      el.hidden = !on;
      for (const input of el.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea")) {
        input.disabled = !on;
      }
    }
    for (const el of form!.querySelectorAll<HTMLElement>("[data-label]")) el.hidden = el.dataset.label !== kind;
    const notes = field<HTMLTextAreaElement>("notes");
    if (notes) notes.required = kind !== "build";
    status!.textContent = "";
  }

  // Fill in from the address: /report/?kind=build&project=dht22 or ?kind=correction&page=...
  const params = new URLSearchParams(location.search);
  const start = KINDS.includes(params.get("kind") as Kind) ? (params.get("kind") as Kind) : "build";
  const radio = form.querySelector<HTMLInputElement>(`input[name="kind"][value="${start}"]`);
  if (radio) radio.checked = true;
  const project = params.get("project");
  if (project && PROJECTS.some((p) => p.id === project)) field<HTMLSelectElement>("project")!.value = project;
  const page = params.get("page");
  if (page) field("page")!.value = page.slice(0, 300);
  setKind(start);

  form.addEventListener("change", (event) => {
    const target = event.target as HTMLInputElement;
    if (target.name === "kind") setKind(target.value as Kind);
  });

  function fail(message: string): void {
    status!.textContent = message;
    status!.classList.add("bad");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.classList.remove("bad");
    const kind = (new FormData(form).get("kind") as Kind) ?? "build";

    const missing = [...form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("[required]")].find(
      (el) => !el.disabled && !el.value.trim(),
    );
    if (missing) {
      fail("Please fill in the highlighted field.");
      missing.focus();
      return;
    }
    const email = field("email")!;
    if (email.value && !email.checkValidity()) {
      fail("That email address does not look right.");
      email.focus();
      return;
    }
    if (!navigator.onLine) {
      fail("You are offline. Connect again and press Send.");
      return;
    }

    const value = (name: string) => {
      const el = field<HTMLInputElement>(name);
      return el && !el.disabled ? el.value.trim() : "";
    };
    const projectId = value("project");
    const projectName = PROJECTS.find((p) => p.id === projectId)?.name ?? projectId;
    const board = [value("board"), value("boardDetail")].filter(Boolean).join(", ");
    const body = {
      kind,
      project: kind === "build" ? projectName : "",
      page: kind === "build" && projectId ? `${location.origin}/projects/${projectId}/` : value("page"),
      board,
      core: value("core"),
      result: value("result"),
      output: value("output"),
      notes: value("notes"),
      name: value("name"),
      email: value("email"),
      website: field("website")!.value,
      t: shownAt,
    };

    send.disabled = true;
    status.textContent = "Sending...";
    try {
      const res = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const answer = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && answer.ok) {
        form.hidden = true;
        thanks.hidden = false;
        thanks.focus();
        return;
      }
      fail(answer.error ?? `The report could not be sent (error ${res.status}). Please try again later.`);
    } catch {
      fail("The report could not be sent. Check your connection and try again.");
    } finally {
      send.disabled = false;
    }
  });

  document.querySelector("#again")?.addEventListener("click", (event) => {
    event.preventDefault();
    form.reset();
    setKind("build");
    shownAt = Date.now();
    status.textContent = "";
    thanks.hidden = true;
    form.hidden = false;
  });
}
