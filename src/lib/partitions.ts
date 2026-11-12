// ESP32 partition tables: presets from Arduino-ESP32 core 3.3, parsing,
// automatic offsets, checks and CSV output. Pure functions shared by the
// partition builder page and its tests.

export type PartType = "app" | "data";

export interface Partition {
  name: string;
  type: PartType;
  subtype: string;
  /** Byte offset; recomputed when automatic offsets are on */
  offset: number;
  size: number;
  flags: string;
}

export interface Preset {
  id: string;
  label: string;
  flashMB: number;
  /** What the Arduino IDE calls it under Tools, Partition Scheme */
  arduino: string;
  rows: Partition[];
}

export const KB = 1024;
export const MB = 1024 * 1024;
/** The partition table itself lives at 0x8000 and takes 0xC00 bytes; partitions start after it. */
export const TABLE_OFFSET = 0x8000;
export const FIRST_OFFSET = 0x9000;

export const SUBTYPES: Record<PartType, string[]> = {
  app: ["factory", ...Array.from({ length: 16 }, (_, i) => `ota_${i}`), "test"],
  data: ["nvs", "ota", "phy", "coredump", "nvs_keys", "efuse", "spiffs", "littlefs", "fat", "undefined"],
};

const p = (name: string, type: PartType, subtype: string, offset: number, size: number): Partition => ({
  name,
  type,
  subtype,
  offset,
  size,
  flags: "",
});

// Copied from tools/partitions/*.csv in Arduino-ESP32 core 3.3.12.
export const PRESETS: Preset[] = [
  {
    id: "default",
    label: "Default 4 MB with spiffs",
    flashMB: 4,
    arduino: "Default 4MB with spiffs (1.2MB APP/1.5MB SPIFFS)",
    rows: [
      p("nvs", "data", "nvs", 0x9000, 0x5000),
      p("otadata", "data", "ota", 0xe000, 0x2000),
      p("app0", "app", "ota_0", 0x10000, 0x140000),
      p("app1", "app", "ota_1", 0x150000, 0x140000),
      p("spiffs", "data", "spiffs", 0x290000, 0x160000),
      p("coredump", "data", "coredump", 0x3f0000, 0x10000),
    ],
  },
  {
    id: "huge_app",
    label: "Huge app, no OTA",
    flashMB: 4,
    arduino: "Huge APP (3MB No OTA/1MB SPIFFS)",
    rows: [
      p("nvs", "data", "nvs", 0x9000, 0x5000),
      p("otadata", "data", "ota", 0xe000, 0x2000),
      p("app0", "app", "ota_0", 0x10000, 0x300000),
      p("spiffs", "data", "spiffs", 0x310000, 0xe0000),
      p("coredump", "data", "coredump", 0x3f0000, 0x10000),
    ],
  },
  {
    id: "min_spiffs",
    label: "Minimal spiffs, two big apps",
    flashMB: 4,
    arduino: "Minimal SPIFFS (1.9MB APP with OTA/190KB SPIFFS)",
    rows: [
      p("nvs", "data", "nvs", 0x9000, 0x5000),
      p("otadata", "data", "ota", 0xe000, 0x2000),
      p("app0", "app", "ota_0", 0x10000, 0x1e0000),
      p("app1", "app", "ota_1", 0x1f0000, 0x1e0000),
      p("spiffs", "data", "spiffs", 0x3d0000, 0x20000),
      p("coredump", "data", "coredump", 0x3f0000, 0x10000),
    ],
  },
  {
    id: "no_ota",
    label: "No OTA, 2 MB app",
    flashMB: 4,
    arduino: "No OTA (2MB APP/2MB SPIFFS)",
    rows: [
      p("nvs", "data", "nvs", 0x9000, 0x5000),
      p("otadata", "data", "ota", 0xe000, 0x2000),
      p("app0", "app", "ota_0", 0x10000, 0x200000),
      p("spiffs", "data", "spiffs", 0x210000, 0x1e0000),
      p("coredump", "data", "coredump", 0x3f0000, 0x10000),
    ],
  },
  {
    id: "default_8MB",
    label: "Default 8 MB",
    flashMB: 8,
    arduino: "8M with spiffs (3MB APP/1.5MB SPIFFS)",
    rows: [
      p("nvs", "data", "nvs", 0x9000, 0x5000),
      p("otadata", "data", "ota", 0xe000, 0x2000),
      p("app0", "app", "ota_0", 0x10000, 0x330000),
      p("app1", "app", "ota_1", 0x340000, 0x330000),
      p("spiffs", "data", "spiffs", 0x670000, 0x180000),
      p("coredump", "data", "coredump", 0x7f0000, 0x10000),
    ],
  },
  {
    id: "default_16MB",
    label: "Default 16 MB",
    flashMB: 16,
    arduino: "16M Flash (6.25MB APP/3.43MB SPIFFS)",
    rows: [
      p("nvs", "data", "nvs", 0x9000, 0x5000),
      p("otadata", "data", "ota", 0xe000, 0x2000),
      p("app0", "app", "ota_0", 0x10000, 0x640000),
      p("app1", "app", "ota_1", 0x650000, 0x640000),
      p("spiffs", "data", "spiffs", 0xc90000, 0x360000),
      p("coredump", "data", "coredump", 0xff0000, 0x10000),
    ],
  },
];

/** App partitions must start on a 64 KB boundary, everything else on 4 KB. */
export const alignmentOf = (part: Pick<Partition, "type">): number => (part.type === "app" ? 0x10000 : 0x1000);

const alignUp = (n: number, a: number) => Math.ceil(n / a) * a;

/** Parse "0x140000", "1280K", "1.25M", "1310720". Returns NaN when unreadable. */
export function parseSize(text: string): number {
  const t = text.trim().replace(/_/g, "");
  if (/^0x[0-9a-f]+$/i.test(t)) return parseInt(t, 16);
  const m = /^(\d+(?:\.\d+)?)\s*([kKmM])?[bB]?$/.exec(t);
  if (!m) return NaN;
  const n = Number(m[1]);
  const mult = m[2] ? (m[2].toLowerCase() === "k" ? KB : MB) : 1;
  return Math.round(n * mult);
}

export const toHex = (n: number) => `0x${n.toString(16).toUpperCase()}`.replace("0X", "0x");

/** Human size: 1.25 MB, 20 KB, 512 bytes. */
export function humanSize(n: number): string {
  if (n >= MB && n % (MB / 100) === 0) return `${+(n / MB).toFixed(2)} MB`;
  if (n >= MB) return `${(n / MB).toFixed(2)} MB`;
  if (n >= KB) return `${+(n / KB).toFixed(1)} KB`;
  return `${n} bytes`;
}

/** Lay partitions end to end from 0x9000, each on its required boundary. */
export function autoOffsets(rows: Partition[]): Partition[] {
  let at = FIRST_OFFSET;
  return rows.map((r) => {
    const offset = alignUp(at, alignmentOf(r));
    at = offset + r.size;
    return { ...r, offset };
  });
}

export interface Problem {
  level: "error" | "warning";
  text: string;
  /** Index of the row the problem is about, if any */
  row?: number;
}

export function check(rows: Partition[], flashBytes: number): Problem[] {
  const problems: Problem[] = [];
  const names = new Set<string>();
  rows.forEach((r, i) => {
    const label = r.name || `Row ${i + 1}`;
    if (!/^[A-Za-z0-9_]{1,16}$/.test(r.name)) problems.push({ level: "error", row: i, text: `${label}: names are 1 to 16 letters, digits or underscores.` });
    if (names.has(r.name)) problems.push({ level: "error", row: i, text: `${label}: the name is used twice.` });
    names.add(r.name);
    if (!Number.isFinite(r.size) || r.size <= 0) problems.push({ level: "error", row: i, text: `${label}: the size is missing or not a number.` });
    else if (r.size % 0x1000 !== 0) problems.push({ level: "error", row: i, text: `${label}: the size must be a multiple of 4 KB (0x1000).` });
    if (!Number.isFinite(r.offset)) problems.push({ level: "error", row: i, text: `${label}: the offset is not a number.` });
    else {
      if (r.offset % alignmentOf(r) !== 0)
        problems.push({ level: "error", row: i, text: `${label}: ${r.type} partitions must start on a ${r.type === "app" ? "64 KB (0x10000)" : "4 KB (0x1000)"} boundary.` });
      if (r.offset < FIRST_OFFSET) problems.push({ level: "error", row: i, text: `${label}: starts inside the bootloader or the partition table; the first partition can start at 0x9000.` });
      if (r.offset + r.size > flashBytes)
        problems.push({ level: "error", row: i, text: `${label}: ends at ${toHex(r.offset + r.size)}, past the end of ${humanSize(flashBytes)} of flash.` });
    }
    if (!SUBTYPES[r.type]?.includes(r.subtype)) problems.push({ level: "error", row: i, text: `${label}: ${r.subtype} is not a ${r.type} subtype.` });
  });

  const sorted = rows.map((r, i) => ({ ...r, i })).filter((r) => Number.isFinite(r.offset) && Number.isFinite(r.size)).sort((a, b) => a.offset - b.offset);
  for (let k = 1; k < sorted.length; k++) {
    const prev = sorted[k - 1];
    const cur = sorted[k];
    if (cur.offset < prev.offset + prev.size)
      problems.push({ level: "error", row: cur.i, text: `${cur.name} overlaps ${prev.name} (${prev.name} ends at ${toHex(prev.offset + prev.size)}).` });
  }

  const apps = rows.filter((r) => r.type === "app");
  const otaApps = apps.filter((r) => r.subtype.startsWith("ota_"));
  const otadata = rows.filter((r) => r.type === "data" && r.subtype === "ota");
  if (apps.length === 0) problems.push({ level: "error", text: "There is no app partition, so there is nowhere for the firmware to go." });
  if (otaApps.length > 0 && otadata.length !== 1) problems.push({ level: "error", text: "OTA app partitions need exactly one otadata partition (data, ota)." });
  if (otadata.length > 0 && otadata[0].size !== 0x2000) problems.push({ level: "warning", text: "The otadata partition is normally 0x2000 (8 KB)." });
  if (!rows.some((r) => r.type === "data" && r.subtype === "nvs"))
    problems.push({ level: "warning", text: "No nvs partition. Wi-Fi, Bluetooth and Preferences all store settings in nvs." });
  const otaSizes = new Set(otaApps.map((r) => r.size));
  if (otaSizes.size > 1) problems.push({ level: "warning", text: "OTA app slots differ in size; the smaller one limits how big the firmware can grow." });
  return problems;
}

/** The biggest firmware that fits: what the Arduino IDE reports as maximum program storage. */
export function maxApp(rows: Partition[]): number {
  const apps = rows.filter((r) => r.type === "app");
  const ota = apps.filter((r) => r.subtype.startsWith("ota_"));
  // With OTA, a new image must fit the smallest slot it may be written to.
  if (ota.length >= 2) return Math.min(...ota.map((r) => r.size));
  return apps.reduce((m, r) => Math.max(m, r.size), 0);
}

export function toCsv(rows: Partition[]): string {
  const cells = rows.map((r) => [`${r.name},`, `${r.type},`, `${r.subtype},`, `${toHex(r.offset)},`, `${toHex(r.size)},`, r.flags]);
  const head = ["# Name,", "Type,", "SubType,", "Offset,", "Size,", "Flags"];
  const widths = head.map((h, c) => Math.max(h.length, ...cells.map((row) => row[c].length)) + 1);
  const line = (row: string[]) => row.map((cell, c) => (c === row.length - 1 ? cell : cell.padEnd(widths[c]))).join("").trimEnd();
  return [line(head), ...cells.map(line)].join("\n") + "\n";
}

/** Read a partitions.csv. Offsets may be blank, as ESP-IDF allows; they are filled in automatically. */
export function parseCsv(text: string): { rows: Partition[]; blankOffsets: boolean } {
  const rows: Partition[] = [];
  let blankOffsets = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const [name = "", type = "", subtype = "", offset = "", size = "", flags = ""] = line.split(",").map((c) => c.trim());
    const t = (type === "0" || type === "0x00" ? "app" : type === "1" || type === "0x01" ? "data" : type) as PartType;
    if (t !== "app" && t !== "data") throw new Error(`Unknown partition type "${type}" in: ${raw.trim()}`);
    if (!offset) blankOffsets = true;
    rows.push({ name, type: t, subtype, offset: offset ? parseSize(offset) : NaN, size: parseSize(size), flags });
  }
  return { rows: blankOffsets ? autoOffsets(rows) : rows, blankOffsets };
}
