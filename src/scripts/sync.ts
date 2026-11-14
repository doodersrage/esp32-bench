// Sync codes in the browser: keeps the bench log, shopping list, parts drawer
// and board the same in every browser linked to one code (api/src/sync.ts).
// Loaded on every page; does nothing until this browser is linked.
import { SITE } from "../lib/site";
import { SHELL } from "../i18n/strings/shell";
import { pageLocale, translator } from "../i18n/t";
import { SYNC_KEYS, fingerprint, mergeSync, normaliseCode, plan, type SyncData } from "../lib/sync-merge";

const STATE_KEY = "bench.sync";
const api = SITE.syncApi;
const tr = translator(SHELL, pageLocale());

export interface SyncState {
  /** The sync code, or the sign-in key (gh_…) of a browser signed in with GitHub */
  code: string;
  /** How this browser is linked: a code (the default) or GitHub */
  via?: "github";
  /** Fingerprint of the copy this browser and the cloud last agreed on */
  agreed: string;
  /** When they last agreed (ms) */
  at: number;
}

export function loadState(): SyncState | null {
  try {
    const s = JSON.parse(localStorage.getItem(STATE_KEY) ?? "null") as SyncState | null;
    return s && typeof s.code === "string" && typeof s.agreed === "string" ? s : null;
  } catch {
    return null;
  }
}

function saveState(s: SyncState | null) {
  try {
    if (s) localStorage.setItem(STATE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STATE_KEY);
  } catch {
    // Without storage there is nothing to sync.
  }
  window.dispatchEvent(new CustomEvent("bench:sync"));
}

function snapshot(): SyncData {
  const d: SyncData = {};
  for (const k of SYNC_KEYS) {
    const v = localStorage.getItem(`bench.${k}`);
    if (v !== null) d[k] = v;
  }
  return d;
}

/** Write a copy into this browser; true when anything changed. */
function apply(d: SyncData): boolean {
  let changed = false;
  for (const k of SYNC_KEYS) {
    const now = localStorage.getItem(`bench.${k}`);
    const want = d[k] ?? null;
    if (now === want) continue;
    changed = true;
    if (want === null) localStorage.removeItem(`bench.${k}`);
    else localStorage.setItem(`bench.${k}`, want);
  }
  return changed;
}

async function call(method: string, code: string | null, body?: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(api, {
    method,
    headers: { ...(code ? { Authorization: `Bearer ${code}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    keepalive: method === "PUT",
    signal: AbortSignal.timeout(15_000),
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

let busy: Promise<unknown> | null = null;

/** Compare with the cloud copy and settle any difference. */
export function check(): Promise<string> {
  // One check at a time; a second caller waits for the first.
  const run = async (): Promise<string> => {
    const s = loadState();
    if (!s) return "unlinked";
    let got;
    try {
      got = await call("GET", s.code);
    } catch {
      return "offline";
    }
    // Only the sync API's own answer means the code is gone; any other 404 (a deploy in progress, a proxy) is just "offline".
    if (got.status === 404 && /sync code/.test(String(got.json.error ?? ""))) {
      saveState(null);
      toast(tr("syncGone"));
      return "gone";
    }
    if (got.status !== 200) return "offline";
    const cloud = (got.json.data ?? {}) as SyncData;
    const local = snapshot();
    const step = plan(cloud, local, s.agreed);
    let agreed = fingerprint(local);
    if (step === "pull") {
      agreed = fingerprint(cloud);
      if (apply(cloud)) pulled();
    } else if (step === "push" || step === "merge") {
      const send = step === "merge" ? mergeSync(cloud, local) : local;
      const put = await call("PUT", s.code, { data: send }).catch(() => null);
      if (!put || put.status !== 200) return "offline";
      agreed = fingerprint(send);
      if (step === "merge" && apply(send)) pulled();
    }
    saveState({ ...s, agreed, at: Date.now() });
    return step;
  };
  const next = (busy ?? Promise.resolve()).then(run, run);
  busy = next;
  return next;
}

/** Make a new code holding this browser's copy. */
export async function create(turnstile: string): Promise<string> {
  const data = snapshot();
  const res = await call("POST", null, { turnstile, data });
  // The API explains itself in English; other languages get a translated message instead.
  if (res.status !== 200 || typeof res.json.code !== "string")
    throw new Error(res.json.error && pageLocale() === "en" ? String(res.json.error) : tr("syncMakeFailed"));
  saveState({ code: res.json.code, agreed: fingerprint(data), at: Date.now() });
  return res.json.code;
}

/** Sign in with GitHub: the API sends the browser to GitHub and back to this page with #sync-session=<key>. */
export function startGithub() {
  const back = location.origin + location.pathname + location.search;
  location.href = `${new URL(api).origin}/auth/github/start?return=${encodeURIComponent(back)}`;
}

/** Back from GitHub with a sign-in key: combine this browser's log with the account's. */
export async function finishGithub(key: string): Promise<void> {
  const got = await call("GET", key);
  if (got.status !== 200) throw new Error(tr("syncUnreachable"));
  const both = mergeSync((got.json.data ?? {}) as SyncData, snapshot());
  const put = await call("PUT", key, { data: both });
  if (put.status !== 200) throw new Error(tr("syncSaveFailed"));
  apply(both);
  saveState({ code: key, via: "github", agreed: fingerprint(both), at: Date.now() });
}

/** Link this browser to an existing code, combining both copies. */
export async function link(typed: string): Promise<void> {
  const code = normaliseCode(typed);
  if (!code) throw new Error(tr("syncBadCode"));
  const got = await call("GET", code);
  if (got.status === 404) throw new Error(tr("syncNoData"));
  if (got.status !== 200) throw new Error(tr("syncUnreachable"));
  const both = mergeSync((got.json.data ?? {}) as SyncData, snapshot());
  const put = await call("PUT", code, { data: both });
  if (put.status !== 200) throw new Error(tr("syncSaveFailed"));
  apply(both);
  saveState({ code, agreed: fingerprint(both), at: Date.now() });
}

/** Stop syncing here; the cloud copy and this browser's log both stay. A GitHub sign-in is also ended on the server. */
export function unlink() {
  const s = loadState();
  if (s?.via === "github") {
    void fetch(`${new URL(api).origin}/auth/session`, { method: "DELETE", headers: { Authorization: `Bearer ${s.code}` }, keepalive: true }).catch(() => undefined);
  }
  saveState(null);
}

/** Delete the cloud copy. Other linked browsers stop syncing at their next check. */
export async function deleteCloud(): Promise<void> {
  const s = loadState();
  if (!s) return;
  const res = await call("DELETE", s.code);
  if (res.status !== 200) throw new Error(tr("syncDeleteFailed"));
  saveState(null);
}

function pulled() {
  toast(tr("syncPulled"), tr("syncReload"));
}

function toast(text: string, action?: string) {
  if (document.getElementById("synctoast")) return;
  const box = document.createElement("div");
  box.id = "synctoast";
  box.className = "synctoast";
  box.setAttribute("role", "status");
  box.textContent = `${text} `;
  if (action) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = action;
    b.addEventListener("click", () => location.reload());
    box.append(b);
  }
  const close = document.createElement("button");
  close.type = "button";
  close.className = "x";
  close.setAttribute("aria-label", tr("dismiss"));
  close.textContent = "×";
  close.addEventListener("click", () => box.remove());
  box.append(close);
  document.body.append(box);
}

// Background: check on load, when the tab comes back, and soon after anything changes here.
if (loadState()) void check();
let last = fingerprint(snapshot());
setInterval(() => {
  const s = loadState();
  if (!s) return;
  const now = fingerprint(snapshot());
  if (now !== last && now !== s.agreed) void check();
  last = now;
}, 4000);
document.addEventListener("visibilitychange", () => {
  if (!loadState()) return;
  // Leaving: send what changed. Coming back: pick up the other devices.
  if (document.visibilityState === "hidden" ? fingerprint(snapshot()) !== loadState()?.agreed : true) void check();
});
