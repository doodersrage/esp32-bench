// The settings protocol between the project page and a board running one of the
// library sketches (the "ESP32 Bench settings block" in the sketch). Pure functions.
//
// Page -> board, one line each, fields separated by tabs:
//   SETTINGS?              ask which keys the sketch knows and whether each is stored
//   SET\t<key>\t<value>    store a value (spaces allowed, tabs and newlines never)
//   UNSET\t<key>           forget a value, so the sketch's own default applies again
//   SAVE                   the board answers SAVED and restarts
// Board -> page:
//   SETTINGS\t<key>=set|unset\t...   at boot and after SETTINGS?
//   SETUP\twaiting                    repeated during the boot window
//   OK\t<key>  |  ERR\t<message>[\t<key>]  |  SAVED

import type { Setting } from "../data/bench-settings";

export const KEY_RE = /^[a-z][a-z0-9_]{0,23}$/;
export const MAX_VALUE = 240;

export type BoardLine =
  | { type: "settings"; stored: Record<string, boolean> }
  | { type: "waiting" }
  | { type: "ok"; key: string }
  | { type: "err"; message: string; key?: string }
  | { type: "saved" };

/** Parse one line from the board. Lines that are not part of the protocol give null. */
export function parseBoardLine(raw: string): BoardLine | null {
  const line = raw.replace(/\r$/, "");
  const f = line.split("\t");
  switch (f[0]) {
    case "SETTINGS": {
      const stored: Record<string, boolean> = {};
      for (const item of f.slice(1)) {
        const m = /^([a-z][a-z0-9_]*)=(set|unset)$/.exec(item);
        if (m) stored[m[1]] = m[2] === "set";
      }
      return { type: "settings", stored };
    }
    case "SETUP":
      return f[1] === "waiting" ? { type: "waiting" } : null;
    case "OK":
      return f[1] && KEY_RE.test(f[1]) ? { type: "ok", key: f[1] } : null;
    case "ERR":
      return { type: "err", message: f[1] ?? "error", ...(f[2] ? { key: f[2] } : {}) };
    case "SAVED":
      return f.length === 1 ? { type: "saved" } : null;
    default:
      return null;
  }
}

export type Encoded = { ok: true; line: string } | { ok: false; error: string };

/** The SET line for a value, or why it cannot be sent. */
export function encodeSet(key: string, value: string): Encoded {
  if (!KEY_RE.test(key)) return { ok: false, error: `"${key}" is not a valid setting name.` };
  if (/[\t\r\n]/.test(value)) return { ok: false, error: "A value cannot contain tabs or line breaks." };
  if (value.length > MAX_VALUE) return { ok: false, error: `A value can be at most ${MAX_VALUE} characters.` };
  return { ok: true, line: `SET\t${key}\t${value}\n` };
}

export function encodeUnset(key: string): Encoded {
  if (!KEY_RE.test(key)) return { ok: false, error: `"${key}" is not a valid setting name.` };
  return { ok: true, line: `UNSET\t${key}\n` };
}

export const QUERY_LINE = "SETTINGS?\n";
export const SAVE_LINE = "SAVE\n";

/**
 * Required settings that would still be missing after sending `values`:
 * neither filled in on the form nor already stored on the board.
 */
export function missingRequired(settings: Setting[], values: Record<string, string>, stored: Record<string, boolean>): Setting[] {
  return settings.filter((s) => s.required && !(values[s.key] ?? "").trim() && !stored[s.key]);
}

/** The lines to send for a filled-in form, in order. Empty fields are left alone (the stored or default value stays). */
export function planSends(settings: Setting[], values: Record<string, string>): Encoded[] {
  return settings
    .filter((s) => (values[s.key] ?? "") !== "")
    .map((s) => encodeSet(s.key, s.kind === "password" ? values[s.key] : values[s.key].trim()));
}
