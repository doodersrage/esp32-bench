// Explains each header pad of a board: its GPIO, what the chip can do on it,
// and whether it is safe to use. Pure functions shared by the board pages.
import { gpioOfPad, type Board, type PadRule } from "../data/boards";
import { CHIPS, describeCaps, type PinCaps } from "../data/chips";

export type VerdictLevel = "safe" | "care" | "avoid" | "power";

export interface Verdict {
  level: VerdictLevel;
  label: string;
  why: string;
}

export interface PadRow {
  label: string;
  silk?: string;
  side: "Left" | "Right";
  /** Position from the top, with the USB connector at the bottom */
  position: number;
  gpio: number | null;
  functions: string[];
  verdict: Verdict;
}

const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function verdictFor(board: Board, label: string, gpio: number | null, caps: PinCaps | undefined): Verdict {
  const rule = board.special[label] as PadRule | undefined;
  const job = gpio === null ? undefined : board.wired?.find((w) => w.gpio === gpio)?.job;
  switch (rule?.kind) {
    case "3v3":
    case "5v":
    case "gnd":
      return { level: "power", label: "Power", why: sentence(rule.why) };
    case "reset":
      return { level: "power", label: "Reset", why: sentence(rule.why) };
    case "nc":
      return { level: "power", label: "Unused", why: sentence(rule.why) };
    case "flash":
      return { level: "avoid", label: "Avoid", why: sentence(rule.why) };
    case "usb":
      return { level: "avoid", label: "Avoid", why: `${sentence(rule.why)} Using it breaks USB flashing and serial.` };
    case "input-only":
      return { level: "care", label: "Input only", why: sentence(rule.why) };
    case "strap":
      return { level: "care", label: "Boot pin", why: sentence(rule.why) };
    case "uart":
      return { level: "care", label: "Serial", why: sentence(rule.why) };
    case "caution":
      return { level: "care", label: "Care", why: sentence(rule.why) };
  }
  if (gpio === null) return { level: "power", label: "Other", why: "Not a GPIO." };
  if (job) return { level: "avoid", label: "In use", why: `${job}.` };
  if (caps?.memory && /modules|WROVER/.test(caps.memory))
    return { level: "care", label: "Care", why: `Used for ${caps.memory}. Free otherwise.` };
  if (caps?.memory) return { level: "avoid", label: "Avoid", why: `Wired to the ${caps.memory}.` };
  if (caps?.inputOnly) return { level: "care", label: "Input only", why: "Can only read: no output driver and no pull-ups." };
  if (caps?.strap) return { level: "care", label: "Boot pin", why: `${caps.strap}.` };
  return { level: "safe", label: "Safe", why: "A general-purpose pin with no boot, flash or USB duty." };
}

/** One row per header pad, left column first, top to bottom. */
export function padRows(board: Board): PadRow[] {
  const chip = CHIPS[board.chip];
  const row = (label: string, side: "Left" | "Right", i: number): PadRow => {
    const gpio = gpioOfPad(board, label);
    const caps = gpio === null ? undefined : chip.pins[gpio];
    return {
      label,
      silk: board.silk?.[label],
      side,
      position: i + 1,
      gpio,
      functions: describeCaps(caps),
      verdict: verdictFor(board, label, gpio, caps),
    };
  };
  return [...board.left.map((l, i) => row(l, "Left", i)), ...board.right.map((r, i) => row(r, "Right", i))];
}

/** Rows for a board with no documented header: the GPIOs it wires to on-board parts. */
export function wiredRows(board: Board) {
  const chip = CHIPS[board.chip];
  return (board.wired ?? []).map((w) => ({ gpio: w.gpio, job: w.job, functions: describeCaps(chip.pins[w.gpio]) }));
}
