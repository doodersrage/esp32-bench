// Which .bin goes where in flash. Pure functions, used by the flasher page and its tests.

export type Role = "merged" | "bootloader" | "partitions" | "boot_app0" | "app" | "other";

export interface PlanFile {
  name: string;
  size: number;
  role: Role;
  /** Flash offset, or "auto" for the bootloader: it depends on the chip */
  offset: number | "auto";
}

/** Bootloader offset by chip family: 0x1000 on ESP32 and ESP32-S2, 0x2000 on the C5 and P4, 0x0 on the rest. */
export function bootloaderOffset(chipName: string): number {
  const c = chipName.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (c === "ESP32" || c === "ESP32S2") return 0x1000;
  if (c === "ESP32C5" || c === "ESP32P4") return 0x2000;
  return 0x0;
}

/** Guess a file's role and offset from the names Arduino, PlatformIO and ESP-IDF give their output. */
export function guessRole(name: string): { role: Role; offset: number | "auto" } {
  const n = name.toLowerCase();
  if (/merged|factory|full|combined|flash_image/.test(n)) return { role: "merged", offset: 0x0 };
  if (/bootloader/.test(n)) return { role: "bootloader", offset: "auto" };
  if (/partition/.test(n)) return { role: "partitions", offset: 0x8000 };
  if (/boot_app0|ota_data_initial/.test(n)) return { role: "boot_app0", offset: 0xe000 };
  return { role: "app", offset: 0x10000 };
}

export const ROLE_LABEL: Record<Role, string> = {
  merged: "Merged image",
  bootloader: "Bootloader",
  partitions: "Partition table",
  boot_app0: "OTA data (boot_app0)",
  app: "App",
  other: "Other",
};

export function parseOffset(text: string): number | "auto" | null {
  const t = text.trim().toLowerCase();
  if (t === "auto") return "auto";
  if (/^0x[0-9a-f]+$/.test(t)) return parseInt(t, 16);
  if (/^\d+$/.test(t)) return Number(t);
  return null;
}

export interface PlanProblem {
  level: "error" | "warning";
  text: string;
}

/** Check a set of files with offsets resolved for a chip (or unresolved before connecting). */
export function checkPlan(files: PlanFile[], chipName?: string, flashBytes?: number): PlanProblem[] {
  const out: PlanProblem[] = [];
  if (files.length === 0) return [{ level: "error", text: "Add at least one .bin file." }];
  const placed = files.map((f) => ({ ...f, at: f.offset === "auto" ? (chipName ? bootloaderOffset(chipName) : null) : f.offset }));
  for (const f of placed) {
    if (f.at === null) continue;
    if (f.at % 0x1000 !== 0) out.push({ level: "error", text: `${f.name}: the offset ${hex(f.at)} is not on a 4 KB (0x1000) boundary.` });
    if (flashBytes && f.at + f.size > flashBytes) out.push({ level: "error", text: `${f.name} does not fit: it would end at ${hex(f.at + f.size)}, past the flash.` });
  }
  const known = placed.filter((f) => f.at !== null).sort((a, b) => a.at! - b.at!);
  for (let i = 1; i < known.length; i++) {
    const prev = known[i - 1];
    if (known[i].at! < prev.at! + prev.size) out.push({ level: "error", text: `${known[i].name} overlaps ${prev.name}.` });
  }
  if (files.some((f) => f.role === "merged") && files.length > 1)
    out.push({ level: "warning", text: "A merged image already holds the bootloader, partition table and app. Flash it on its own at 0x0." });
  if (files.some((f) => f.role === "app") && !files.some((f) => f.role === "bootloader" || f.role === "merged"))
    out.push({ level: "warning", text: "Only an app image: fine for updating a board that already runs firmware with the same partition table." });
  return out;
}

export const hex = (n: number) => `0x${n.toString(16).toUpperCase()}`.replace("0X", "0x");
