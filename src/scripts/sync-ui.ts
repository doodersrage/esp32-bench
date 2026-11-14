// The "Use this log on another device" panel on the home page.
import { create, deleteCloud, link, loadState, unlink, startGithub, finishGithub } from "./sync";
import { pageLocale, translator } from "../i18n/t";
import { HOME } from "../i18n/strings/home";
import { HTML_LANG } from "../i18n/locales";

const t = translator(HOME, pageLocale());
const lang = HTML_LANG[pageLocale()];
const FILE_NAME = "esp32-bench-sync-code.txt";

interface Turnstile {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  reset(id: string): void;
}

const box = document.getElementById("sync");
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
const off = $("sync-off");
const on = $("sync-on");
const status = $("sync-status");
const shown = $("sync-shown");
const when = $("sync-when");
const human = $("sync-human");
const make = $<HTMLButtonElement>("sync-make");
const form = $<HTMLFormElement>("sync-link");
const input = $<HTMLInputElement>("sync-code");

const say = (text: string) => {
  if (status) status.textContent = text;
};

function render() {
  const s = loadState();
  if (off) off.hidden = Boolean(s);
  if (on) on.hidden = !s;
  const github = s?.via === "github";
  if (s && shown && !github) shown.textContent = s.code;
  // A GitHub sign-in has no code to copy or save: show the account line and Sign out instead.
  for (const el of document.querySelectorAll<HTMLElement>("#sync-on [data-sync-code]")) el.hidden = github;
  for (const el of document.querySelectorAll<HTMLElement>("#sync-on [data-sync-github]")) el.hidden = !github;
  const logLink = document.getElementById("loglink");
  if (logLink) logLink.textContent = s ? t("logLinkSynced") : t("logLink");
  if (s && when) when.textContent = t("lastSynced", { when: new Date(s.at).toLocaleString(lang, { dateStyle: "medium", timeStyle: "short" }) });
}

/** A link that opens this panel with the code filled in. The code rides in the #fragment, which is never sent to a server. */
const shareLink = (code: string) => `${location.origin}${location.pathname}#sync=${code}`;

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    say(done);
  } catch {
    say(t("copyThis", { text }));
  }
}

// Turnstile loads only when someone asks for a code, not on every visit to the home page.
let widget: string | null = null;
function loadTurnstile(): Promise<Turnstile> {
  const w = window as unknown as { turnstile?: Turnstile };
  if (w.turnstile) return Promise.resolve(w.turnstile);
  return new Promise((ok, fail) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => (w.turnstile ? ok(w.turnstile) : fail(new Error("no turnstile")));
    s.onerror = () => fail(new Error("blocked"));
    document.head.append(s);
  });
}

make?.addEventListener("click", async () => {
  if (!human || widget !== null) return;
  make.disabled = true;
  say(t("humanCheck"));
  try {
    const ts = await loadTurnstile();
    widget = ts.render(human, {
      sitekey: box?.dataset.sitekey ?? "",
      action: "sync",
      theme: "auto",
      callback: async (token: string) => {
        say(t("making"));
        try {
          const code = await create(token);
          say(t("made", { code }));
          human.replaceChildren();
          widget = null;
          make.disabled = false;
          render();
        } catch (e) {
          say((e as Error).message);
          if (widget !== null) ts.reset(widget);
        }
      },
    });
  } catch {
    say(t("humanFail"));
    make.disabled = false;
  }
});

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!input) return;
  const button = form.querySelector("button");
  if (button) button.disabled = true;
  say(t("linking"));
  try {
    await link(input.value);
    // The library, badges and drawer read storage once at load: start fresh with the combined log.
    history.replaceState(null, "", location.pathname + location.search + "#log");
    location.reload();
  } catch (err) {
    say((err as Error).message);
  } finally {
    if (button) button.disabled = false;
  }
});

$("sync-copy")?.addEventListener("click", () => {
  const s = loadState();
  if (s) void copy(s.code, t("codeCopied"));
});
$("sync-copylink")?.addEventListener("click", () => {
  const s = loadState();
  if (s) void copy(shareLink(s.code), t("linkCopied"));
});
/** A small text file with the code and its link, for safekeeping: there is no way to recover a lost code. */
function saveCode(code: string) {
  const text = [
    t("fileTitle"),
    "",
    t("fileCode", { code }),
    t("fileLink", { link: shareLink(code) }),
    t("fileSaved", { when: new Date().toLocaleString(lang) }),
    "",
    t("fileHow"),
    t("fileKeep"),
    "",
  ].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  a.download = FILE_NAME;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  say(t("saved", { file: FILE_NAME }));
}
$("sync-save")?.addEventListener("click", () => {
  const s = loadState();
  if (s) saveCode(s.code);
});
$("sync-github")?.addEventListener("click", () => {
  say(t("githubSigningIn"));
  startGithub();
});
$("sync-signout")?.addEventListener("click", () => {
  unlink();
  say(t("signedOut"));
});
$("sync-unlink")?.addEventListener("click", () => {
  unlink();
  say(t("unlinked"));
});
$("sync-delete")?.addEventListener("click", async () => {
  if (!confirm(t(loadState()?.via === "github" ? "deleteConfirmGithub" : "deleteConfirm"))) return;
  try {
    await deleteCloud();
    say(t("deleted"));
  } catch (e) {
    say((e as Error).message);
  }
});

// A link from another device: open the panel with the code filled in, but link only when asked.
const fromLink = /^#sync=([0-9A-Za-z-]{16,24})$/.exec(location.hash);
if (fromLink && box && input && !loadState()) {
  input.value = fromLink[1];
  history.replaceState(null, "", location.pathname + location.search + "#log");
  box.scrollIntoView({ block: "center" });
  say(t("fromLink"));
}

if (location.hash === "#sync" && box) box.scrollIntoView({ block: "center" });

// Back from GitHub. The key rides in the #fragment, which is never sent to a server; take it out of the address at once.
const fromGithub = /^#sync-session=(gh_[A-Za-z0-9_-]{43})$/.exec(location.hash);
const githubError = /^#sync-error=(\w+)$/.exec(location.hash);
if (fromGithub || githubError) {
  history.replaceState(null, "", location.pathname + location.search + "#log");
  box?.scrollIntoView({ block: "center" });
}
if (githubError) say(t(githubError[1] === "cancelled" ? "githubCancelled" : "githubFailed"));
if (fromGithub) {
  say(t("githubSigningIn"));
  finishGithub(fromGithub[1]).then(
    () => {
      try {
        sessionStorage.setItem("bench.githubDone", "1");
      } catch {
        // The message is a nicety.
      }
      // The library, badges and drawer read storage once at load: start fresh with the combined log.
      location.reload();
    },
    (e: unknown) => say((e as Error).message || t("githubFailed")),
  );
}
try {
  if (sessionStorage.getItem("bench.githubDone")) {
    sessionStorage.removeItem("bench.githubDone");
    say(t("githubDone"));
  }
} catch {
  // No session storage: no message.
}

window.addEventListener("bench:sync", render);
render();
