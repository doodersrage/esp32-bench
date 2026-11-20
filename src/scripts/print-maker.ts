// The part maker (/prints/make/): read the form, build the part with
// manifold-3d in the browser, show it and offer it as 3MF or STL. The settings
// live in the address (?part=board-case&board=esp32s3&oled=1), so a link
// opens the same part.
import wasmUrl from "manifold-3d/manifold.wasm?url";
import { build, loadKernel, type MeshData } from "../lib/print/kernel";
import { PART_DEFS, cleanValues, defaults, partDef, type PartDef, type Values } from "../lib/print/parts";
import { estimateGrams, flatTriangles, to3mf, toStl } from "../lib/print/formats";
import { BED } from "../data/prints";
import { PartViewer } from "./print-viewer";

const form = document.getElementById("mk-form") as HTMLFormElement | null;
if (form) start(form);

function start(form: HTMLFormElement) {
  const ui = JSON.parse(document.getElementById("mk-ui")!.textContent!) as Record<string, string>;
  const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
  const partSelect = document.getElementById("mk-part") as HTMLSelectElement;
  const status = document.getElementById("mk-status")!;
  const stats = document.getElementById("mk-stats")!;
  const b3mf = document.getElementById("mk-3mf") as HTMLButtonElement;
  const bstl = document.getElementById("mk-stl") as HTMLButtonElement;
  const canvas = document.getElementById("mk-canvas") as HTMLCanvasElement;
  const num = new Intl.NumberFormat(document.documentElement.lang || "en", { maximumFractionDigits: 1 });

  let viewer: PartViewer | undefined;
  try {
    viewer = new PartViewer(canvas);
  } catch {
    canvas.hidden = true;
    status.textContent = ui.noWebgl;
  }

  let mesh: MeshData | undefined;
  let current: PartDef = PART_DEFS[0];

  const fieldset = (id: string) => form.querySelector<HTMLFieldSetElement>(`fieldset[data-part="${id}"]`)!;

  function showPart(id: string) {
    for (const fs of form.querySelectorAll<HTMLFieldSetElement>("fieldset[data-part]")) {
      const on = fs.dataset.part === id;
      fs.hidden = !on;
      fs.disabled = !on;
    }
    current = partDef(id) ?? PART_DEFS[0];
    partSelect.value = current.id;
  }

  function readForm(): Values {
    const fs = fieldset(current.id);
    const raw: Record<string, unknown> = {};
    for (const p of current.params) {
      const el = fs.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${p.key}"]`);
      if (!el) continue;
      raw[p.key] = p.kind === "bool" ? (el as HTMLInputElement).checked : el.value;
    }
    return cleanValues(current, raw);
  }

  function writeForm(v: Values) {
    const fs = fieldset(current.id);
    for (const p of current.params) {
      const el = fs.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${p.key}"]`);
      if (!el) continue;
      if (p.kind === "bool") (el as HTMLInputElement).checked = v[p.key] === true;
      else el.value = String(v[p.key]);
    }
  }

  /** The address for these settings: only what differs from the defaults. */
  function query(v: Values): string {
    const base = defaults(current);
    const q = new URLSearchParams({ part: current.id });
    for (const [k, val] of Object.entries(v)) if (val !== base[k]) q.set(k, typeof val === "boolean" ? (val ? "1" : "0") : String(val));
    return `?${q}`;
  }

  let timer = 0;
  function schedule() {
    clearTimeout(timer);
    timer = window.setTimeout(rebuild, 120);
  }

  async function rebuild() {
    const v = readForm();
    history.replaceState(null, "", query(v) + location.hash);
    status.classList.remove("bad");
    status.textContent = ui.building;
    const k = await loadKernel(wasmUrl);
    try {
      mesh = build(k, (k) => current.make(k, v)).mesh;
    } catch (e) {
      mesh = undefined;
      b3mf.disabled = bstl.disabled = true;
      stats.textContent = "";
      status.classList.add("bad");
      status.textContent = fill(ui.failed, { msg: (e as Error).message });
      return;
    }
    viewer?.show(flatTriangles(mesh));
    const [x, y, z] = mesh.size;
    stats.textContent = fill(ui.stats, { x: num.format(x), y: num.format(y), z: num.format(z), g: estimateGrams(mesh.volume, 20) });
    const big = x > BED.x || y > BED.y || z > BED.z;
    status.classList.toggle("bad", big);
    status.textContent = big ? ui.tooBig : "";
    b3mf.disabled = bstl.disabled = false;
  }

  function download(kind: "3mf" | "stl") {
    if (!mesh) return;
    const name = current.id;
    const bytes = kind === "3mf" ? to3mf(mesh, name) : toStl(mesh, name);
    const blob = new Blob([bytes as BlobPart], { type: kind === "3mf" ? "model/3mf" : "model/stl" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${name}.${kind}`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  }

  // A board choice fills in that board's size.
  form.addEventListener("change", (e) => {
    const el = e.target as HTMLElement;
    if (el === partSelect) {
      showPart(partSelect.value);
      writeForm(defaults(current));
    } else if (el instanceof HTMLSelectElement) {
      const p = current.params.find((x) => x.key === el.name);
      const preset = p?.kind === "choice" ? p.presets?.[el.value] : undefined;
      if (preset && el.value !== "custom") writeForm({ ...readForm(), ...preset });
    }
    schedule();
  });
  form.addEventListener("input", schedule);
  form.addEventListener("submit", (e) => e.preventDefault());
  b3mf.addEventListener("click", () => download("3mf"));
  bstl.addEventListener("click", () => download("stl"));
  document.getElementById("mk-reset")!.addEventListener("click", () => {
    writeForm(defaults(current));
    schedule();
  });
  const copy = document.getElementById("mk-copy") as HTMLButtonElement;
  copy.addEventListener("click", async () => {
    await navigator.clipboard?.writeText(location.href).catch(() => undefined);
    const was = copy.textContent;
    copy.textContent = ui.copied;
    setTimeout(() => (copy.textContent = was), 1500);
  });

  // Start from the address.
  const params = new URLSearchParams(location.search);
  showPart(params.get("part") ?? PART_DEFS[0].id);
  writeForm(cleanValues(current, Object.fromEntries(params)));
  status.textContent = ui.loading;
  rebuild();
}
