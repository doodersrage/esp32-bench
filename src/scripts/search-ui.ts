// Site search in the browser: the header box with its dropdown, the "/" key,
// and the /search/ page. The index is fetched the first time it is needed.
import { link } from "../lib/paths";
import { prepare, search, unpackIndex, type Entry, type IndexFile, type Prepared } from "../lib/search";

let loading: Promise<Prepared[]> | null = null;

export function loadIndex(): Promise<Prepared[]> {
  loading ??= fetch(link("/search-index.json"))
    .then((r) => {
      if (!r.ok) throw new Error(`search index ${r.status}`);
      return r.json() as Promise<IndexFile>;
    })
    .then((file) => prepare(unpackIndex(file)))
    .catch((error: unknown) => {
      loading = null; // try again next time
      throw error;
    });
  return loading;
}

export function resultItem(e: Entry, tag: "li" | "div" = "li"): HTMLElement {
  const item = document.createElement(tag);
  const a = document.createElement("a");
  a.href = e.url;
  a.className = "sresult";
  const kind = document.createElement("span");
  kind.className = `tag skind skind-${e.kind.toLowerCase()}`;
  kind.textContent = e.kind;
  const title = document.createElement("span");
  title.className = "stitle";
  title.textContent = e.title;
  const snip = document.createElement("span");
  snip.className = "ssnip";
  snip.textContent = e.snippet;
  a.append(kind, title, snip);
  item.append(a);
  return item;
}

const isTyping = (el: Element | null) =>
  !!el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || (el as HTMLElement).isContentEditable);

// "/" focuses search from anywhere on the page.
document.addEventListener("keydown", (event) => {
  if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey || isTyping(document.activeElement)) return;
  const page = document.querySelector<HTMLInputElement>("#search-q");
  const header = document.querySelector<HTMLInputElement>("#hsearch-q");
  const target = page ?? (header && header.offsetParent !== null ? header : null);
  event.preventDefault();
  if (target) {
    target.focus();
    target.select();
  } else {
    location.href = link("/search/");
  }
});

// Header box with a dropdown of the top results.
const form = document.querySelector<HTMLFormElement>("#hsearch");
const input = document.querySelector<HTMLInputElement>("#hsearch-q");
const list = document.querySelector<HTMLUListElement>("#hsearch-list");

if (form && input && list) {
  let active = -1;
  let timer = 0;
  const items = () => [...list.querySelectorAll<HTMLAnchorElement>("a")];

  const close = () => {
    list.hidden = true;
    list.replaceChildren();
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    active = -1;
  };

  const highlight = (i: number) => {
    const links = items();
    links.forEach((a, n) => a.parentElement?.setAttribute("aria-selected", n === i ? "true" : "false"));
    active = i;
    if (i >= 0 && links[i]) input.setAttribute("aria-activedescendant", links[i].parentElement!.id);
  };

  const render = async () => {
    const q = input.value.trim();
    if (!q) return close();
    let index: Prepared[];
    try {
      index = await loadIndex();
    } catch {
      return close();
    }
    if (input.value.trim() !== q) return; // typed on meanwhile
    const hits = search(index, q, 6);
    list.replaceChildren(
      ...hits.map((e, i) => {
        const li = resultItem(e);
        li.id = `hsearch-opt-${i}`;
        li.setAttribute("role", "option");
        li.querySelector("a")!.tabIndex = -1;
        return li;
      }),
    );
    const all = document.createElement("li");
    all.className = "sall";
    const more = document.createElement("a");
    more.href = `${link("/search/")}?q=${encodeURIComponent(q)}`;
    more.tabIndex = -1;
    more.textContent = hits.length ? `All results for "${q}"` : `No quick matches. Search all for "${q}"`;
    all.append(more);
    list.append(all);
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    highlight(-1);
  };

  input.addEventListener("focus", () => {
    loadIndex().catch(() => undefined);
    if (input.value.trim()) void render();
  });
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = window.setTimeout(render, 60);
  });
  input.addEventListener("keydown", (event) => {
    const links = items();
    if (event.key === "ArrowDown" && links.length) {
      event.preventDefault();
      highlight(Math.min(active + 1, links.length - 1));
    } else if (event.key === "ArrowUp" && links.length) {
      event.preventDefault();
      highlight(Math.max(active - 1, -1));
    } else if (event.key === "Escape") {
      if (!list.hidden) close();
      else input.blur();
    } else if (event.key === "Enter" && active >= 0 && links[active]) {
      event.preventDefault();
      location.href = links[active].href;
    }
  });
  // Close when focus leaves the form; links inside still get their click.
  form.addEventListener("focusout", () => {
    window.setTimeout(() => {
      if (!form.contains(document.activeElement)) close();
    }, 150);
  });
  list.addEventListener("mousedown", (event) => event.preventDefault());
}
