// Wiring rules for the wiring pad. Pure functions: given a board, some parts
// and a set of connections, say what is wrong, and propose a safe wiring.
import type { Board } from "../data/boards";
import type { Part, PartPin } from "../data/parts";

/** One wire: a part's pin to a header pad, by label. */
export interface Connection {
  part: string;
  pin: string;
  pad: string;
}

export interface Finding {
  level: "error" | "warn" | "note";
  text: string;
}

const isGpio = (board: Board, pad: string) => {
  const kind = board.special[pad]?.kind;
  return kind === undefined || kind === "strap" || kind === "usb" || kind === "uart" || kind === "caution" || kind === "input-only";
};

const gpioName = (pad: string) => (/^\d+$/.test(pad) ? `GPIO ${pad}` : pad);

/** Problems with putting one part pin on one pad. */
export function checkConnection(board: Board, part: Part, pin: PartPin, pad: string): Finding[] {
  const rule = board.special[pad];
  const where = `${part.name} ${pin.name} on ${gpioName(pad)}`;
  const found: Finding[] = [];

  if (pin.kind === "power3" || pin.kind === "power5" || pin.kind === "gnd") {
    const wanted = pin.kind === "power3" ? "3v3" : pin.kind === "power5" ? "5v" : "gnd";
    const wantedLabel = pin.kind === "power3" ? "3V3" : pin.kind === "power5" ? "5V" : "GND";
    if (rule?.kind !== wanted) {
      const danger = pin.kind === "power3" && rule?.kind === "5v";
      found.push({
        level: "error",
        text: danger
          ? `${where}: this part runs on 3.3 V. 5 V can damage it and will put 5 V on its signal pins. Use 3V3.`
          : `${where}: ${pin.name} belongs on ${wantedLabel}.`,
      });
    }
    return found;
  }

  // Signal pins from here on.
  if (!isGpio(board, pad)) {
    found.push({ level: "error", text: `${where}: that pad is ${rule?.why ?? "not a GPIO."} Pick a numbered GPIO.` });
    return found;
  }
  if (rule?.kind === "input-only" && pin.kind !== "out") {
    found.push({ level: "error", text: `${where}: ${rule.why} ${pin.name} needs a pin the board can drive.` });
  }
  if (rule?.kind === "input-only" && pin.kind === "out" && /pull-up/i.test(pin.note ?? "")) {
    found.push({ level: "error", text: `${where}: ${rule.why} This part relies on the internal pull-up, so add an external 10 kΩ to 3V3 or pick another pin.` });
  }
  if (rule?.kind === "strap") found.push({ level: "warn", text: `${where}: ${gpioName(pad)} is ${rule.why}` });
  if (rule?.kind === "usb") found.push({ level: "warn", text: `${where}: ${gpioName(pad)} is ${rule.why} Using it breaks flashing and the bench over that port.` });
  if (rule?.kind === "uart") found.push({ level: "warn", text: `${where}: ${pad} ${rule.why}` });
  if (rule?.kind === "caution") found.push({ level: "warn", text: `${where}: ${gpioName(pad)} is ${rule.why}` });
  if (pin.level5) found.push({ level: "warn", text: `${part.name} ${pin.name} outputs 5 V and ESP32 pins take 3.3 V. ${pin.note ?? "Add a voltage divider."}` });
  else if (pin.note) found.push({ level: "note", text: `${part.name} ${pin.name}: ${pin.note}` });
  return found;
}

/** Everything wrong with a whole wiring, including pads used twice and pins left open. */
export function checkWiring(board: Board, parts: Part[], connections: Connection[]): Finding[] {
  const found: Finding[] = [];
  const signalUse = new Map<string, { part: Part; pin: PartPin }[]>();

  for (const part of parts) {
    for (const pin of part.pins) {
      const c = connections.find((x) => x.part === part.id && x.pin === pin.name);
      if (!c) {
        found.push({ level: "note", text: `${part.name} ${pin.name} is not connected yet.` });
        continue;
      }
      found.push(...checkConnection(board, part, pin, c.pad));
      if (pin.kind === "in" || pin.kind === "out" || pin.kind === "bidir") {
        signalUse.set(c.pad, [...(signalUse.get(c.pad) ?? []), { part, pin }]);
      }
    }
  }

  for (const [pad, users] of signalUse) {
    if (users.length < 2) continue;
    // Several parts may share a pad only as the same I2C line.
    const shared = users.every((u) => u.pin.bus !== undefined && u.pin.bus === users[0].pin.bus);
    if (!shared) {
      found.push({
        level: "error",
        text: `${gpioName(pad)} is used twice: ${users.map((u) => `${u.part.name} ${u.pin.name}`).join(" and ")}. Give each its own pin.`,
      });
    }
  }

  const buses = parts.filter((p) => p.pins.some((pin) => pin.bus)).length;
  if (buses > 1) found.push({ level: "note", text: "I2C parts share SDA and SCL. Each needs its own address, or one will hide the other." });

  const order = { error: 0, warn: 1, note: 2 };
  // The same note can come from two parts; show it once.
  const unique = found.filter((f, i) => found.findIndex((g) => g.text === f.text) === i);
  return unique.sort((a, b) => order[a.level] - order[b.level]);
}

/** A conflict-free wiring using the board's supply pads, tested I2C pins and safe GPIOs. */
export function autoWire(board: Board, parts: Part[]): Connection[] {
  const connections: Connection[] = [];
  const taken = new Set<string>();
  const [sda, scl] = board.i2cPins;
  const usesI2c = parts.some((p) => p.pins.some((pin) => pin.bus));
  if (usesI2c) {
    taken.add(sda);
    taken.add(scl);
  }
  const free = board.safe.filter((pad) => !taken.has(pad));

  for (const part of parts) {
    for (const pin of part.pins) {
      let pad: string | undefined;
      if (pin.kind === "power3") pad = "3V3";
      else if (pin.kind === "power5") pad = "5V";
      else if (pin.kind === "gnd") pad = "GND";
      else if (pin.bus === "sda") pad = sda;
      else if (pin.bus === "scl") pad = scl;
      else pad = free.shift();
      if (pad) connections.push({ part: part.id, pin: pin.name, pad });
    }
  }
  return connections;
}

/** C constants for the signal pins, ready to paste at the top of a sketch. */
export function pinConstants(parts: Part[], connections: Connection[]): string {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    for (const pin of part.pins) {
      if (pin.kind === "power3" || pin.kind === "power5" || pin.kind === "gnd") continue;
      const c = connections.find((x) => x.part === part.id && x.pin === pin.name);
      if (!c || !/^\d+$/.test(c.pad)) continue;
      const name = pin.bus ? `I2C_${pin.bus.toUpperCase()}` : `${part.id.toUpperCase()}_${pin.name}`;
      if (seen.has(name)) continue;
      seen.add(name);
      lines.push(`const int ${name} = ${c.pad};`);
    }
  }
  return lines.join("\n");
}
