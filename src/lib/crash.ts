// Plain-language explanations for ESP32 boot, reset and crash lines.
// Pure functions, so the bench and the paste box can share them.

export interface Explanation {
  /** Stable id, used to avoid repeating the same hint */
  key: string;
  text: string;
}

const PANICS: [RegExp, string, string][] = [
  [/LoadProhibited|Load access fault/, "load", "The code read from an address it may not touch. Usually a null or dangling pointer, or an object used before it was set up."],
  [/StoreProhibited|Store access fault/, "store", "The code wrote to an address it may not touch. Usually a null pointer, or writing past the end of an array."],
  [/InstrFetchProhibited|Instruction access fault/, "fetch", "The CPU jumped to an address with no code. Usually a corrupted function pointer or a stack that was overwritten."],
  [/IllegalInstruction|Illegal instruction/, "illegal", "The CPU hit bytes that are not an instruction. Often a function that ran off its end without returning a value, or memory corruption."],
  [/IntegerDivideByZero/, "div0", "An integer was divided by zero. Check divisors that come from sensor readings or sizes."],
  [/Stack canary watchpoint|Unhandled debug exception/, "stack", "A task ran out of stack. Move large local arrays to the heap or make them static, or give the task a bigger stack."],
  [/Interrupt wdt timeout/, "intwdt", "Interrupts were blocked for too long. Look for long work inside an interrupt handler or a critical section."],
  [/Cache disabled but cached memory region accessed/, "cache", "An interrupt handler touched code or data in flash while flash was busy. Mark the handler and what it uses IRAM_ATTR."],
];

const LINES: [RegExp, string, string][] = [
  [/Task watchdog got triggered/, "taskwdt", "A task ran too long without yielding. Add a delay() or yield() inside long loops."],
  [/Brownout detector was triggered/, "brownout", "The supply voltage dipped below the safe level. Try a shorter USB cable, a powered hub, or a capacitor across 3V3 and GND. Wi-Fi start-up is the usual trigger."],
  [/abort\(\) was called/, "abort", "The firmware stopped itself on purpose, usually from a failed check in a library. The line just above the abort normally says which."],
  [/Stack smashing protect failure/, "smash", "A function wrote past the end of a local buffer. Check sprintf, strcpy and array indexes in the function named in the backtrace."],
  [/CORRUPT HEAP/, "heap", "Heap bookkeeping was overwritten. Something wrote past the end of an allocated block, or used memory after freeing it."],
  [/assert failed/, "assert", "A sanity check in the firmware or a library failed. The text after 'assert failed' names the file, line and condition."],
  [/waiting for download/i, "download", "The board is in download mode, waiting for new firmware. Press EN or RST to run what is already flashed."],
  [/invalid header: 0x/, "header", "The bootloader found no valid firmware. The flash is empty or was written at the wrong offset. Flash again."],
  [/flash read err/, "flashread", "The bootloader could not read the flash chip. Check the flash mode and size settings, then flash again."],
  [/TT post -5/, "tt-5", "ProbeHarbor: -5 means the reply was lost, not the reading. The server usually has it."],
  [/TT sensor problem/, "tt-sensor", "ProbeHarbor: a sensor that is found but will not read usually has a loose power or ground wire."],
  [/TT no probe/, "tt-noprobe", "ProbeHarbor: no sensor answered. Check the data wire is on the pad marked 4 and the pull-up is fitted."],
  [/TT setup:/, "tt-setup", "ProbeHarbor: the probe has no settings. A fresh flash erases them, so send Wi-Fi and the key again."],
];

const RESETS: Record<string, string> = {
  POWERON_RESET: "Normal start after power-up or the EN button.",
  SW_CPU_RESET: "The firmware restarted itself, either with ESP.restart() or after a crash. Look just above for a panic.",
  SW_RESET: "The firmware restarted itself.",
  DEEPSLEEP_RESET: "Woke from deep sleep. That is a full restart, so setup() runs again.",
  TG0WDT_SYS_RESET: "A watchdog reset: the main loop or a task stopped responding.",
  TG1WDT_SYS_RESET: "A watchdog reset: interrupts were blocked for too long.",
  RTCWDT_RTC_RESET: "The low-level watchdog reset the chip. Often a boot loop, bad flash contents or unstable power.",
  RTCWDT_BROWN_OUT_RESET: "Reset because the supply voltage dipped.",
  USB_UART_CHIP_RESET: "Reset caused by opening the native USB port. Normal on the ESP32-S3 and C3.",
  EXT_CPU_RESET: "Reset through the EN or RST pin.",
};

/** Program counter addresses from a "Backtrace:" line, e.g. 0x400d1234 */
export function backtraceAddresses(line: string): string[] {
  if (!/^\s*Backtrace:/.test(line)) return [];
  return [...line.matchAll(/(0x[0-9a-fA-F]{8}):0x[0-9a-fA-F]{8}/g)].map((m) => m[1]);
}

export function explainLine(line: string): Explanation | null {
  const panic = /Guru Meditation Error: Core\s+(\d) panic'ed \(([^)]+)\)/.exec(line);
  if (panic) {
    const hit = PANICS.find(([pattern]) => pattern.test(panic[2]));
    return {
      key: `panic-${hit ? hit[1] : "other"}`,
      text: `Crash on core ${panic[1]}: ${panic[2]}. ${hit ? hit[2] : "The firmware hit a fault it could not recover from."}`,
    };
  }

  const reset = /rst:0x[0-9a-fA-F]+ \(([A-Z0-9_]+)\)/.exec(line);
  if (reset && RESETS[reset[1]]) return { key: `rst-${reset[1]}`, text: `${reset[1]}: ${RESETS[reset[1]]}` };

  const addresses = backtraceAddresses(line);
  if (addresses.length > 0) {
    return {
      key: "backtrace",
      text: `Backtrace: these addresses name the functions that were running. To turn them into file and line numbers you need the firmware's .elf file: addr2line -pfiaC -e firmware.elf ${addresses.slice(0, 6).join(" ")}`,
    };
  }

  const hit = LINES.find(([pattern]) => pattern.test(line));
  return hit ? { key: hit[1], text: hit[2] } : null;
}

/** Explain a pasted log: one entry per distinct finding, in order. */
export function explainLog(log: string): Explanation[] {
  const seen = new Set<string>();
  const found: Explanation[] = [];
  for (const line of log.split(/\r?\n/)) {
    const e = explainLine(line);
    if (e && !seen.has(e.key)) {
      seen.add(e.key);
      found.push(e);
    }
  }
  return found;
}
