// Parser for the pin detective firmware's serial lines, and the board passport
// built from them. The protocol is described in firmware/pin-detective/src/main.cpp.
import type { BoardId } from "../data/boards";
import type { ChipId } from "../data/chips";

export interface Passport {
  board: BoardId;
  firmware: string;
  chip: string;
  revision: string;
  cores: number;
  mhz: number;
  /** Flash size in bytes, as detected from the flash chip */
  flash: number;
  /** PSRAM size in bytes; 0 when there is none */
  psram: number;
  mac: string;
  sdk: string;
}

export type DetectiveEvent =
  | { type: "hello"; chip: ChipId; firmware: string }
  | { type: "id"; fields: Record<string, string> }
  | { type: "pins"; pins: string[] }
  | { type: "low"; pins: string[] }
  | { type: "change"; pin: string; low: boolean };

/** Chips the firmware is built for. Its hello line names the chip ("board=esp32s3"). */
export const DETECTIVE_CHIPS: ChipId[] = ["esp32", "esp32s2", "esp32s3", "esp32c3", "esp32c6"];

const fields = (text: string): Record<string, string> =>
  Object.fromEntries(
    text
      .split(/\s+/)
      .map((pair) => pair.split("="))
      .filter((pair) => pair.length === 2 && pair[0] !== ""),
  );

const list = (text: string): string[] => (text.trim() === "-" ? [] : text.split(",").map((x) => x.trim()).filter((x) => /^\d+$/.test(x)));

/** Turn one serial line into an event, or null for anything that is not a PD line. */
export function parseLine(raw: string): DetectiveEvent | null {
  const line = raw.trim();
  if (!line.startsWith("PD ")) return null;
  const rest = line.slice(3);

  const change = /^(\d+) ([01])$/.exec(rest);
  if (change) return { type: "change", pin: change[1], low: change[2] === "0" };

  if (rest.startsWith("hello ")) {
    const f = fields(rest.slice(6));
    const chip = DETECTIVE_CHIPS.find((id) => id === f.board);
    return chip ? { type: "hello", chip, firmware: f.fw ?? "" } : null;
  }
  if (rest.startsWith("id ")) return { type: "id", fields: fields(rest.slice(3)) };
  if (rest.startsWith("pins ")) return { type: "pins", pins: list(rest.slice(5)) };
  if (rest.startsWith("low ")) return { type: "low", pins: list(rest.slice(4)) };
  return null;
}

export function toPassport(board: BoardId, firmware: string, f: Record<string, string>): Passport {
  const number = (value: string | undefined) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    board,
    firmware,
    chip: f.chip ?? "Unknown chip",
    revision: f.rev ?? "?",
    cores: number(f.cores),
    mhz: number(f.mhz),
    flash: number(f.flash),
    psram: number(f.psram),
    mac: (f.mac ?? "").toUpperCase(),
    sdk: f.sdk ?? "",
  };
}

/** 4194304 becomes "4 MB". */
export function megabytes(bytes: number): string {
  if (bytes <= 0) return "none";
  const mb = bytes / (1024 * 1024);
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
}
