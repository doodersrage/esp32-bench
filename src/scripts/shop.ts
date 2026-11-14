// Shopping list page: merges the parts of the projects on the list.
import { loadShop, saveShop } from "./progress";
import { loadState as loadSyncState } from "./sync";
import { localiseAmazon } from "./amazon-region";

interface Item {
  key: string;
  label: string;
  qty: number;
  text: string;
  optional: boolean;
  alternative: boolean;
  href: string;
  rel: string;
  buy: string;
  amazonQ: string;
}
interface ShopProject {
  id: string;
  name: string;
  url: string;
  items: Item[];
}
interface Line {
  label: string;
  qty: number;
  optional: boolean;
  projects: string[];
  texts: string[];
  href: string;
  rel: string;
  buy: string;
  amazonQ: string;
}

const data = JSON.parse(document.getElementById("shop-data")?.textContent ?? "[]") as ShopProject[];
const byId = new Map(data.map((p) => [p.id, p]));
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const projectsList = $<HTMLUListElement>("shop-projects");
const empty = $<HTMLElement>("shop-empty");
const partsBox = $<HTMLElement>("shop-parts");
const rows = $<HTMLTableSectionElement>("shop-rows");
const add = $<HTMLSelectElement>("shop-add");
const modes = [...document.querySelectorAll<HTMLInputElement>('input[name="shop-mode"]')];

let list = loadShop().filter((id) => byId.has(id));

/** One line per part: the most any project needs (parts are reused), or the sum when building everything at once. */
function merge(projects: ShopProject[], together: boolean): Line[] {
  const lines = new Map<string, Line>();
  for (const p of projects) {
    // A choice of parts lists only its first option.
    for (const item of p.items.filter((i) => !i.alternative)) {
      let line = lines.get(item.key);
      if (!line) {
        line = { label: item.label, qty: 0, optional: true, projects: [], texts: [], href: "", rel: "", buy: "", amazonQ: "" };
        lines.set(item.key, line);
      }
      line.qty = together ? line.qty + item.qty : Math.max(line.qty, item.qty);
      line.optional &&= item.optional;
      if (!line.projects.includes(p.name)) line.projects.push(p.name);
      if (!line.texts.includes(item.text)) line.texts.push(item.text);
      // A product link beats a search when two projects list the same part.
      if (item.href && (!line.href || (line.buy.startsWith("Find") && !item.buy.startsWith("Find")))) Object.assign(line, { href: item.href, rel: item.rel, buy: item.buy, amazonQ: item.amazonQ });
    }
  }
  return [...lines.values()].sort((a, b) => Number(a.optional) - Number(b.optional) || a.label.localeCompare(b.label));
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

let current: Line[] = [];

function render() {
  saveShop(list);
  const projects = list.map((id) => byId.get(id)!).filter(Boolean);
  projectsList.replaceChildren(
    ...projects.map((p) => {
      const li = el("li");
      const a = el("a", "", p.name);
      a.href = p.url;
      const remove = el("button", "", "×");
      remove.type = "button";
      remove.setAttribute("aria-label", `Remove ${p.name}`);
      remove.addEventListener("click", () => {
        list = list.filter((id) => id !== p.id);
        render();
      });
      li.append(a, remove);
      return li;
    }),
  );
  empty.hidden = projects.length > 0;
  partsBox.hidden = projects.length === 0;
  for (const option of add.options) option.disabled = option.value !== "" && list.includes(option.value);

  const together = modes.find((m) => m.checked)?.value === "all";
  current = merge(projects, together);
  rows.replaceChildren(
    ...current.map((line) => {
      const tr = el("tr");
      const qty = el("td", "q", `${line.qty}×`);
      const part = el("td");
      part.append(line.label);
      if (line.optional) part.append(el("span", "opt", "optional"));
      part.title = line.texts.join("\n");
      const used = el("td", "for", line.projects.length === projects.length && projects.length > 1 ? "All" : line.projects.join(", "));
      const buy = el("td", "m");
      if (line.href) {
        const a = el("a", "", line.buy);
        a.href = line.href;
        a.rel = line.rel;
        a.target = "_blank";
        if (line.amazonQ) a.dataset.amazonQ = line.amazonQ;
        buy.append(a);
      }
      tr.append(qty, part, used, buy);
      return tr;
    }),
  );
  localiseAmazon(rows);
}

add.addEventListener("change", () => {
  if (add.value && !list.includes(add.value)) list.push(add.value);
  add.value = "";
  render();
});
$<HTMLButtonElement>("shop-clear").addEventListener("click", () => {
  list = [];
  render();
});
for (const m of modes) m.addEventListener("change", render);
$<HTMLButtonElement>("shop-print").addEventListener("click", () => window.print());
const copy = $<HTMLButtonElement>("shop-copy");
copy.addEventListener("click", async () => {
  const label = copy.textContent;
  const text = current.map((l) => `${l.qty}x ${l.label}${l.optional ? " (optional)" : ""}${l.href ? `  ${l.href}` : ""}`).join("\n");
  try {
    await navigator.clipboard.writeText(text);
    copy.textContent = "Copied";
  } catch {
    copy.textContent = "Copy blocked";
  }
  setTimeout(() => (copy.textContent = label), 1600);
});

render();

// Already synced: the list is on the other devices, so no need to point there.
const phone = document.getElementById("shop-phone");
if (phone && loadSyncState()) phone.hidden = true;
