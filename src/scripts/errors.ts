// Error reference: search filter on the index, and the paste-a-log box on
// each error page. Both run only when their elements are on the page.
import { explainLog } from "../lib/crash";
import { errorBySlug, errorSlugForKey } from "../data/errors";
import { link } from "../lib/paths";

const search = document.querySelector<HTMLInputElement>("#error-q");
if (search) {
  const items = [...document.querySelectorAll<HTMLElement>("[data-error]")];
  const groups = [...document.querySelectorAll<HTMLElement>("[data-group]")];
  const empty = document.querySelector<HTMLElement>("#error-empty");
  const filter = () => {
    const words = search.value.toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const item of items) {
      const text = item.dataset.error ?? "";
      const hit = words.every((w) => text.includes(w));
      item.hidden = !hit;
      if (hit) shown++;
    }
    for (const g of groups) g.hidden = !g.querySelector("[data-error]:not([hidden])");
    if (empty) empty.hidden = shown > 0;
  };
  search.addEventListener("input", filter);
  const q = new URLSearchParams(location.search).get("q");
  if (q) {
    search.value = q;
    filter();
  }
}

const go = document.querySelector<HTMLButtonElement>("#explain-go");
const box = document.querySelector<HTMLTextAreaElement>("#explain-log");
const out = document.querySelector<HTMLUListElement>("#explain-out");
if (go && box && out) {
  const here = box.dataset.slug;
  go.addEventListener("click", () => {
    const found = explainLog(box.value);
    if (found.length === 0) {
      const li = document.createElement("li");
      li.textContent = "Nothing recognised. Paste the lines around the reset or the Guru Meditation message, including the rst: line and any Backtrace.";
      out.replaceChildren(li);
      return;
    }
    out.replaceChildren(
      ...found.map((e) => {
        const li = document.createElement("li");
        li.textContent = e.text;
        const slug = errorSlugForKey(e.key);
        const entry = slug ? errorBySlug(slug) : undefined;
        if (entry && slug !== here) {
          li.append(" ");
          const a = document.createElement("a");
          a.href = link(`/errors/${slug}/`);
          a.textContent = `More: ${entry.title}`;
          li.append(a);
        }
        return li;
      }),
    );
  });
}
