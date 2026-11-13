// The settings block that goes into every sketch with user settings, and the
// type the project page uses to build its settings form.
import block from "../sketches/bench-settings.inc?raw";

export interface Setting {
  /** Short snake_case key, exactly as the sketch's BENCH_KEYS lists it */
  key: string;
  label: string;
  kind: "text" | "password" | "url" | "number";
  hint?: string;
  required?: boolean;
}

/** The settings block for a sketch, with its keys filled in. Keys must match the project's `settings`. */
export function benchSettings(keys: string[]): string {
  return block.replace("%BENCH_KEYS%", keys.map((k) => `"${k}"`).join(", ")).trimEnd();
}

export const WIFI: Setting[] = [
  { key: "wifi_ssid", label: "Wi-Fi network name", kind: "text", hint: "2.4 GHz only.", required: true },
  { key: "wifi_pass", label: "Wi-Fi password", kind: "password" },
];
