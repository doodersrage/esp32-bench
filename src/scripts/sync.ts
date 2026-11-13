// Sync codes in the browser: keeps the bench log, shopping list, parts drawer
// and board the same in every browser linked to one code (api/src/sync.ts).
// Loaded on every page; does nothing until this browser is linked.
import { SITE } from "../lib/site";
import { SYNC_KEYS, fingerprint, mergeSync, normaliseCode, plan, type SyncData } from "../lib/sync-merge";

const STATE_KEY = "bench.sync";
const api = SITE.syncApi;

export interface SyncState {
  code: string;
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
      toast("The sync code this browser used was deleted, so it no longer syncs. Your log here is unchanged.");
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
  if (res.status !== 200 || typeof res.json.code !== "string") throw new Error(String(res.json.error ?? "The code could not be made. Please try again."));
  saveState({ code: res.json.code, agreed: fingerprint(data), at: Date.now() });
  return res.json.code;
}

/** Link this browser to an existing code, combining both copies. */
export async function link(typed: string): Promise<void> {
  const code = normaliseCode(typed);
  if (!code) throw new Error("That does not look like a sync code: 16 letters and digits, like 7KQ4-M2XD-9PQA-R3TW.");
  const got = await call("GET", code);
  if (got.status === 404) throw new Error("No data for that sync code. Check it, or make a new one.");
  if (got.status !== 200) throw new Error("Could not reach the sync service. Please try again.");
  const both = mergeSync((got.json.data ?? {}) as SyncData, snapshot());
  const put = await call("PUT", code, { data: both });
  if (put.status !== 200) throw new Error("Could not save to the sync service. Please try again.");
  apply(both);
  saveState({ code, agreed: fingerprint(both), at: Date.now() });
}

/** Stop syncing here; the cloud copy and this browser's log both stay. */
export function unlink() {
  saveState(null);
}

/** Delete the cloud copy. Other linked browsers stop syncing at their next check. */
export async function deleteCloud(): Promise<void> {
  const s = loadState();
  if (!s) return;
  const res = await call("DELETE", s.code);
  if (res.status !== 200) throw new Error("Could not delete the cloud copy. Please try again.");
  saveState(null);
}

function pulled() {
  toast("Your bench log changed on another device.", "Reload to see it");
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
  close.setAttribute("aria-label", "Dismiss");
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
