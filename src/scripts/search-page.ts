// The /search/ page: reads ?q=, shows ranked results, keeps the address in step
// so a search can be shared, and lets arrow keys move through the results.
import { search, type Prepared } from "../lib/search";
import { loadIndex, resultItem } from "./search-ui";
import { SEARCH } from "../i18n/strings/pages";
import { pageLocale, translator } from "../i18n/t";

const t = translator(SEARCH, pageLocale());

const form = document.querySelector<HTMLFormElement>("#search-form");
const input = document.querySelector<HTMLInputElement>("#search-q");
const list = document.querySelector<HTMLOListElement>("#search-results");
const count = document.querySelector<HTMLElement>("#search-count");
const HINT = t("hint");

if (form && input && list && count) {
  const initial = new URLSearchParams(location.search).get("q") ?? "";
  input.value = initial;
  let timer = 0;

  const show = async () => {
    const q = input.value.trim();
    const url = new URL(location.href);
    if (q) url.searchParams.set("q", q);
    else url.searchParams.delete("q");
    history.replaceState(null, "", url);
    if (!q) {
      list.replaceChildren();
      count.textContent = HINT;
      return;
    }
    let index: Prepared[];
    try {
      index = await loadIndex();
    } catch {
      count.textContent = t("loadFail");
      return;
    }
    if (input.value.trim() !== q) return;
    const hits = search(index, q, 60);
    list.replaceChildren(...hits.map((e) => resultItem(e)));
    count.textContent = hits.length
      ? t(hits.length === 60 ? "top" : hits.length === 1 ? "one" : "many", { n: hits.length, q })
      : t("none", { q });
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void show();
  });
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = window.setTimeout(show, 80);
  });

  // Arrow keys: from the box into the results and between them.
  const links = () => [...list.querySelectorAll<HTMLAnchorElement>("a")];
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" && links()[0]) {
      event.preventDefault();
      links()[0].focus();
    }
  });
  list.addEventListener("keydown", (event) => {
    const all = links();
    const i = all.indexOf(document.activeElement as HTMLAnchorElement);
    if (i < 0) return;
    if (event.key === "ArrowDown" && all[i + 1]) {
      event.preventDefault();
      all[i + 1].focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      (all[i - 1] ?? input).focus();
    }
  });

  if (initial) void show();
}
