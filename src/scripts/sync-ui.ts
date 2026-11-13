// The "Use this log on another device" panel on the home page.
import { check, create, deleteCloud, link, loadState, unlink } from "./sync";

interface Turnstile {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  reset(id: string): void;
}

const box = document.getElementById("sync") as HTMLDetailsElement | null;
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
  if (s && shown) shown.textContent = s.code;
  if (s && when) when.textContent = `Last synced ${new Date(s.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}.`;
}

/** A link that opens this panel with the code filled in. The code rides in the #fragment, which is never sent to a server. */
const shareLink = (code: string) => `${location.origin}${location.pathname}#sync=${code}`;

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    say(done);
  } catch {
    say(`Copy this: ${text}`);
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
  say("One quick human check, then your code appears.");
  try {
    const t = await loadTurnstile();
    widget = t.render(human, {
      sitekey: box?.dataset.sitekey ?? "",
      action: "sync",
      theme: "auto",
      callback: async (token: string) => {
        say("Making your code…");
        try {
          const code = await create(token);
          say(`Your sync code is ${code}. Write it down or copy the link, then enter it on your other devices.`);
          human.replaceChildren();
          widget = null;
          make.disabled = false;
          render();
        } catch (e) {
          say((e as Error).message);
          if (widget !== null) t.reset(widget);
        }
      },
    });
  } catch {
    say("The human check could not load. Check your connection or turn off blockers for this page.");
    make.disabled = false;
  }
});

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!input) return;
  const button = form.querySelector("button");
  if (button) button.disabled = true;
  say("Linking…");
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
  if (s) void copy(s.code, "Code copied.");
});
$("sync-copylink")?.addEventListener("click", () => {
  const s = loadState();
  if (s) void copy(shareLink(s.code), "Link copied. Open it on the other device and press Link this browser.");
});
$("sync-unlink")?.addEventListener("click", () => {
  unlink();
  say("This browser no longer syncs. Its log stays here, and the cloud copy stays for your other devices.");
});
$("sync-delete")?.addEventListener("click", async () => {
  if (!confirm("Delete the cloud copy? Every browser using this code stops syncing. The log in each browser stays.")) return;
  try {
    await deleteCloud();
    say("The cloud copy is deleted. Your log in this browser is unchanged.");
  } catch (e) {
    say((e as Error).message);
  }
});

// A link from another device: open the panel with the code filled in, but link only when asked.
const fromLink = /^#sync=([0-9A-Za-z-]{16,24})$/.exec(location.hash);
if (fromLink && box && input && !loadState()) {
  input.value = fromLink[1];
  box.open = true;
  history.replaceState(null, "", location.pathname + location.search + "#log");
  box.scrollIntoView({ block: "center" });
  say("Press Link this browser to combine this browser's log with the one behind the code.");
}

window.addEventListener("bench:sync", render);
render();
if (box && loadState()) box.addEventListener("toggle", () => box.open && void check().then(render), { once: true });
