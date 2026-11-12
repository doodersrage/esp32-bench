// Wiring diagrams, built from a project's wiring table for one board.
//
// The wiring table stays the source of truth: each row [from, to, note] becomes
// one or more wires between a part pin and a board pad (or another part), or,
// when it cannot be drawn honestly, an entry in the diagram's "also" list.
// No row is ever dropped. Pure functions, no data imports, so the node test
// (tests/wiring-diagram.test.ts) can run them over every project and board.

export type WiringRow = readonly [string, string, string];

export interface Header {
  left: string[];
  right: string[];
  gpioOf?: Record<string, number>;
  silk?: Record<string, string>;
}

export type PadKind = "3v3" | "5v" | "gnd" | "gpio";

export interface Pad {
  /** The label as printed on the header, e.g. "21", "3V3", "VP" */
  header: string;
  kind: PadKind;
  /** What the diagram prints, e.g. "GPIO 21" */
  label: string;
  /** Silkscreen or alternative name, e.g. "D0" or "VP" */
  alias?: string;
  side: "left" | "right";
  /** Position on its header side, counting from the top, 1-based */
  position: number;
  /** Order down the diagram: left side first, then right */
  order: number;
}

export interface PartPin {
  label: string;
  /** Pins wired to the board sit on the part's left edge; part-to-part pins on its right edge */
  edge: "board" | "part";
}

export interface Part {
  name: string;
  pins: PartPin[];
  /** Short extras worth drawing on the part, e.g. "100 µF capacitor" */
  extras: string[];
}

export interface Wire {
  /** Index of the wiring row this wire comes from */
  row: number;
  part: string;
  pin: string;
  /** Board pad (header label) or another part's pin */
  to: { pad: string } | { part: string; pin: string };
  /** CSS class for the colour: w-3v3, w-5v, w-gnd or w-s0..w-s7 */
  color: string;
  /** Series resistor drawn on the wire, e.g. "220 Ω" */
  resistor?: string;
  /** Pull-up or pull-down written next to the wire, e.g. "4.7 kΩ pull-up" */
  pull?: string;
  /** Another valid destination, e.g. "or 3V3" */
  alt?: string;
  optional?: boolean;
}

export interface Listed {
  row: number;
  text: string;
  why: "on-board" | "other-board" | "not-wired" | "no-pad";
}

export interface Step {
  row: number;
  /** Instruction text for build mode */
  text: string;
  /** Note from the wiring table */
  note: string;
  drawn: boolean;
  /** Board pads this step touches, for highlighting */
  pads: string[];
}

export interface Model {
  pads: Pad[];
  parts: Part[];
  wires: Wire[];
  listed: Listed[];
  steps: Step[];
  /** Name of the other board in rows like "Uno 3.3V", when there is one */
  otherBoard?: string;
}

const SIGNALS = 8;

// Words that start the pin part of a "Part pin" label, e.g. "DHT22 VCC".
const PIN_WORDS = new Set(
  [
    "vcc", "vdd", "vin", "gnd", "vss", "sda", "scl", "sdi", "sck", "clk", "din", "mosi", "miso", "cs", "csn", "ce",
    "dc", "rst", "busy", "data", "trig", "echo", "out", "aout", "vo", "v0", "vrx", "vry", "sw", "tx", "rx", "in",
    "sig", "do", "so", "anode", "cathode", "signal", "red", "brown", "black", "orange", "yellow", "white", "+", "-",
    "a", "b", "e", "k", "rs", "rw", "collector", "emitter", "base", "wiper", "middle", "+5v", "5v", "common", "side",
    "wire", "push", "output", "ground", "ser", "srclk", "rclk", "oe", "mr", "segments", "decimal", "contact",
  ].map((w) => w.toLowerCase()),
);
const PIN_PATTERN = /^(q\d|d\d)$/i;

/** Split "DHT22 VCC" into ["DHT22", "VCC"]; a label with no pin word is a one-pin part. */
export function splitPart(raw: string): [string, string] {
  const words = raw.trim().split(/\s+/);
  for (let i = 1; i < words.length; i++) {
    const w = words[i].replace(/[,()]/g, "").toLowerCase();
    if (PIN_WORDS.has(w) || PIN_PATTERN.test(w)) {
      let name = words.slice(0, i).join(" ").replace(/,$/, "");
      let pin = words.slice(i).join(" ");
      // "LCD 4 RS": the number belongs to the pin, not the part.
      const numbered = /^(.*\S)\s+(\d{1,2})$/.exec(name);
      if (numbered) {
        name = numbered[1];
        pin = `${numbered[2]} ${pin}`;
      }
      name = name.replace(/^ESP32 /, "");
      return [ALIASES[name] ?? name, pin];
    }
  }
  return [raw.trim().replace(/,$/, ""), ""];
}

/** Boards that carry a part, drawn as that part. */
const ALIASES: Record<string, string> = { "KY-040 board": "Encoder" };

const OHMS = String.raw`\d[\d.]*\s?[kM]?Ω`;

function padKind(label: string): PadKind {
  if (label === "3V3") return "3v3";
  if (label === "5V") return "5v";
  if (label === "GND") return "gnd";
  return "gpio";
}

/** Find a header pad: "GPIO 21", "3V3", "5V", "GND", or "U0R (GPIO 3)". */
export function findPad(target: string, header: Header): Pad | null {
  const t = target.trim();
  const all = [
    ...header.left.map((h, i) => ({ h, side: "left" as const, position: i + 1, order: i })),
    ...header.right.map((h, i) => ({ h, side: "right" as const, position: i + 1, order: header.left.length + i })),
  ];
  let hit: (typeof all)[number] | undefined;
  const gpio = /GPIO\s*(\d+)/.exec(t);
  if (/^(3V3|3\.3 ?V)$/i.test(t)) hit = all.find((p) => p.h === "3V3");
  else if (/^5 ?V$/i.test(t)) hit = all.find((p) => p.h === "5V");
  else if (/^GND$/i.test(t)) hit = all.find((p) => p.h === "GND");
  else if (gpio) {
    const n = Number(gpio[1]);
    hit = all.find((p) => p.h === String(n)) ?? all.find((p) => header.gpioOf?.[p.h] === n);
  }
  if (!hit) return null;
  const kind = padKind(hit.h);
  const n = /^\d+$/.test(hit.h) ? Number(hit.h) : header.gpioOf?.[hit.h];
  const label = kind === "gpio" ? `GPIO ${n}` : hit.h;
  const alias = /^\d+$/.test(hit.h) ? header.silk?.[hit.h] : kind === "gpio" ? hit.h : undefined;
  return { header: hit.h, kind, label, ...(alias ? { alias } : {}), side: hit.side, position: hit.position, order: hit.order };
}

/** Two pads in one cell: "3V3 to GPIO 34", "GPIO 34 to GND". */
function padPair(to: string, header: Header): [Pad, Pad] | null {
  const m = /^(.+?)\s+to\s+(.+)$/.exec(to.trim());
  if (!m) return null;
  const a = findPad(m[1], header);
  const b = findPad(m[2], header);
  return a && b ? [a, b] : null;
}

/** Build the diagram model for one board's filled-in wiring rows. */
export function parseWiring(rows: readonly WiringRow[], header: Header): Model {
  const pads = new Map<string, Pad>();
  const parts = new Map<string, Part>();
  const wires: Wire[] = [];
  const listed: Listed[] = [];
  const stepPads = new Map<number, string[]>();
  let otherBoard: string | undefined;

  const usePad = (p: Pad) => {
    if (!pads.has(p.header)) pads.set(p.header, p);
    return p.header;
  };
  const part = (name: string) => {
    let p = parts.get(name);
    if (!p) {
      p = { name, pins: [], extras: [] };
      parts.set(name, p);
    }
    return p;
  };
  const pin = (partName: string, label: string, edge: PartPin["edge"]) => {
    const p = part(partName);
    const l = label || "pin";
    if (!p.pins.some((x) => x.label === l && x.edge === edge)) p.pins.push({ label: l, edge });
    return l;
  };
  const touch = (row: number, pad: string) => stepPads.set(row, [...(stepPads.get(row) ?? []), pad]);

  rows.forEach(([rawFrom, rawTo, note], row) => {
    const text = `${rawFrom} → ${rawTo}`;
    if (/^Already on the board/i.test(note)) return listed.push({ row, text, why: "on-board" });
    if (/^Not wired\b/i.test(rawTo)) return listed.push({ row, text, why: "not-wired" });
    const other = /^(Uno)\b/.exec(rawTo);
    if (other) {
      otherBoard = other[1];
      return listed.push({ row, text, why: "other-board" });
    }

    let from = rawFrom.trim();
    const optional = /^Optional\s+/i.test(from);
    from = from.replace(/^Optional\s+/i, "");
    let resistor: string | undefined;
    const through = new RegExp(String.raw`,?\s+through\s+(${OHMS})\s*$`).exec(from);
    if (through) {
      resistor = through[1];
      from = from.slice(0, through.index);
    }
    const noteThrough = new RegExp(String.raw`^(?:Each\s+)?through\s+(?:its own\s+)?(${OHMS})`, "i").exec(note);
    if (!resistor && noteThrough) resistor = noteThrough[1];
    const pullM = new RegExp(String.raw`(${OHMS})\s+pull-(up|down)`, "i").exec(note);
    const addM = new RegExp(String.raw`Add\s+(${OHMS})\s+from\s+GPIO\s*\d+\s+to\s+GND`, "i").exec(note);
    const pull = pullM ? `${pullM[1]} pull-${pullM[2].toLowerCase()}` : addM ? `${addM[1]} to GND` : undefined;
    const cap = /(\d[\d.]*\s?[µu]F)\s+capacitor/i.exec(note) ?? /capacitor\s+\((\d[\d.]*\s?[µu]F)\)/i.exec(note);

    // A diode or similar placed across another part: "Stripe to motor +, other end to motor -".
    const across = /^Stripe to (.+?),\s*other end to (.+)$/i.exec(rawTo.trim());
    if (across) {
      const name = splitPart(from.replace(/\s+across\b.*$/i, ""))[0];
      const ends: [string, string][] = [
        ["stripe", across[1]],
        ["other end", across[2]],
      ];
      for (const [label, target] of ends) {
        const [tp, tpin] = splitPart(target.replace(/^the\s+/i, ""));
        const tPart = [...parts.keys()].find((k) => k.toLowerCase() === tp.toLowerCase()) ?? tp;
        const p1 = pin(name, label, "part");
        const p2 = pin(tPart, tpin, "part");
        wires.push({ row, part: name, pin: p1, to: { part: tPart, pin: p2 }, color: "" });
      }
      return;
    }

    // Two pads in one cell, for two-legged parts: "3V3 to GPIO 34", "GPIO 34 to GND".
    const pair = padPair(rawTo, header);
    if (pair) {
      const name = from.replace(/\s+from\s+GPIO\s*\d+$/i, "");
      pair.forEach((pad, i) => {
        const h = usePad(pad);
        touch(row, h);
        const pl = pin(name, `leg ${i + 1}`, "board");
        wires.push({ row, part: name, pin: pl, to: { pad: h }, color: "", ...(resistor ? { resistor } : {}), ...(optional ? { optional } : {}) });
      });
      if (cap) part(name).extras.push(`${cap[1].replace("uF", "µF")} capacitor`);
      return;
    }
    // "100 kΩ from GPIO 35" → "GND": a resistor between two pads.
    const fromPad = /^(.*?)\s+from\s+(GPIO\s*\d+)$/i.exec(from);
    if (fromPad) {
      const a = findPad(fromPad[2], header);
      const b = findPad(rawTo, header);
      if (a && b) {
        const name = `${fromPad[1]} resistor`;
        [a, b].forEach((pad, i) => {
          const h = usePad(pad);
          touch(row, h);
          wires.push({ row, part: name, pin: pin(name, `leg ${i + 1}`, "board"), to: { pad: h }, color: "" });
        });
        return;
      }
    }

    const [name, pinLabel] = splitPart(from);
    // "GND or 3V3", "GND, or the transistor": draw the first, mention the rest.
    const choice = /^(.+?),?\s+(or\s+.+)$/.exec(rawTo.trim());
    const target = choice && findPad(choice[1], header) ? choice[1] : rawTo.trim();
    const alt = choice && target === choice[1] ? choice[2] : undefined;

    // "GPIO 21 and 22" with "SDA and SCL": two wires.
    const twoGpio = /^GPIO\s*(\d+)\s+and\s+(\d+)$/i.exec(target);
    if (twoGpio) {
      const pinNames = pinLabel.split(/\s+and\s+/);
      [twoGpio[1], twoGpio[2]].forEach((n, i) => {
        const pad = findPad(`GPIO ${n}`, header);
        if (!pad) return listed.push({ row, text, why: "no-pad" });
        const h = usePad(pad);
        touch(row, h);
        const pl = pin(name, pinNames[i] ?? `${pinLabel} ${i + 1}`, "board");
        wires.push({ row, part: name, pin: pl, to: { pad: h }, color: "", ...(optional ? { optional } : {}) });
      });
      return;
    }

    const pad = findPad(target, header);
    if (pad) {
      const h = usePad(pad);
      touch(row, h);
      const pl = pin(name, pinLabel + (alt ? ` (${alt})` : ""), "board");
      wires.push({
        row, part: name, pin: pl, to: { pad: h }, color: "",
        ...(resistor ? { resistor } : {}), ...(pull ? { pull } : {}), ...(alt ? { alt } : {}), ...(optional ? { optional } : {}),
      });
      if (cap) part(name).extras.push(`${cap[1].replace("uF", "µF")} capacitor`);
      return;
    }
    if (/GPIO\s*\d+/.test(target)) return listed.push({ row, text, why: "no-pad" });

    // Part to part: "Transistor collector", "Trimmer wiper", "Digit segments a to g", "5 V supply +".
    const [tName, tPin] = splitPart(target);
    const p1 = pin(name, pinLabel, "part");
    const p2 = pin(tName, tPin, "part");
    wires.push({ row, part: name, pin: p1, to: { part: tName, pin: p2 }, color: "", ...(resistor ? { resistor } : {}), ...(optional ? { optional } : {}) });
  });

  // Colours: power and ground by pad; each signal pad, and each part-to-part link, its own colour.
  const signalOf = new Map<string, number>();
  let next = 0;
  for (const w of wires) {
    if ("pad" in w.to) {
      const kind = pads.get(w.to.pad)!.kind;
      if (kind !== "gpio") {
        w.color = `w-${kind}`;
        continue;
      }
    }
    const key = "pad" in w.to ? `pad:${w.to.pad}` : `row:${w.row}`;
    if (!signalOf.has(key)) signalOf.set(key, next++ % SIGNALS);
    w.color = `w-s${signalOf.get(key)}`;
  }

  // Build order: power and ground first, so nothing is half-powered, then the
  // signals in the table's order, then whatever was not drawn.
  const isPower = (row: number) =>
    wires.some((w) => w.row === row && "pad" in w.to && pads.get(w.to.pad)!.kind !== "gpio") &&
    wires.filter((w) => w.row === row).every((w) => "pad" in w.to && pads.get(w.to.pad)!.kind !== "gpio");
  const drawnRows = [...new Set(wires.map((w) => w.row))];
  const order = [
    ...drawnRows.filter(isPower).sort((a, b) => a - b),
    ...drawnRows.filter((r) => !isPower(r)).sort((a, b) => a - b),
    ...listed.map((l) => l.row),
  ];
  const steps: Step[] = [...new Set(order)].map((row) => {
    const [from, to, note] = rows[row];
    const drawn = drawnRows.includes(row);
    return { row, text: `Connect ${from} to ${to}.`, note, drawn, pads: stepPads.get(row) ?? [] };
  });

  const padList = [...pads.values()].sort((a, b) => a.order - b.order);
  return { pads: padList, parts: [...parts.values()], wires, listed, steps, ...(otherBoard ? { otherBoard } : {}) };
}

// ---- Layout -------------------------------------------------------------

export interface Layout {
  width: number;
  height: number;
  board: { x: number; y: number; w: number; h: number };
  pads: { pad: Pad; x: number; y: number }[];
  parts: { part: Part; x: number; y: number; w: number; h: number; pins: { pin: PartPin; x: number; y: number }[] }[];
  wires: {
    wire: Wire;
    d: string;
    resistorAt?: { x: number; y: number };
    end: { x: number; y: number };
    /** Where the step number sits */
    badge: { x: number; y: number };
  }[];
}

const ROW = 26;
const TOP = 10;
/** Room for the board's name above its first pad */
const BOARD_HEAD = 40;
const LANE = 11;
const BOARD_W = 150;
const PART_W = 200;

/** A part with one unnamed pin is drawn as a slim box with the pin on its name line. */
const slim = (part: Part) => part.pins.length === 1 && part.pins[0].label === "pin" && part.extras.length === 0;

export function layout(model: Model): Layout {
  const pads = model.pads.map((pad, i) => ({ pad, x: 10 + BOARD_W, y: TOP + BOARD_HEAD + i * ROW }));
  const padY = new Map(pads.map((p) => [p.pad.header, p.y]));

  // Parts nearest their pads come first, so wires run mostly straight across.
  const meanY = (name: string): number => {
    const ys = model.wires.filter((w) => w.part === name && "pad" in w.to).map((w) => padY.get((w.to as { pad: string }).pad)!);
    if (ys.length) return ys.reduce((a, b) => a + b, 0) / ys.length;
    // A part only linked to other parts sits after the part it connects to.
    const linked = model.wires.find((w) => "part" in w.to && (w.part === name || (w.to as { part: string }).part === name));
    const otherName = linked ? (linked.part === name ? (linked.to as { part: string }).part : linked.part) : "";
    const otherYs = model.wires.filter((w) => w.part === otherName && "pad" in w.to).map((w) => padY.get((w.to as { pad: string }).pad)!);
    return otherYs.length ? otherYs.reduce((a, b) => a + b, 0) / otherYs.length + 0.5 : 1e6;
  };
  const partOrder = [...model.parts].sort((a, b) => meanY(a.name) - meanY(b.name));

  // Lanes for wires to the board: one vertical run each, packed so runs never overlap.
  const boardWires = model.wires.filter((w) => "pad" in w.to);
  // Pin y positions depend on part placement, which depends on lane count (x only), so place parts first.
  const pinOrderY = (part: Part) => {
    const boardPins = part.pins.filter((p) => p.edge === "board");
    const avg = (p: PartPin) => {
      const ys = boardWires.filter((w) => w.part === part.name && w.pin === p.label).map((w) => padY.get((w.to as { pad: string }).pad)!);
      return ys.length ? Math.min(...ys) : 0;
    };
    return [...boardPins].sort((a, b) => avg(a) - avg(b));
  };

  let y = TOP;
  const placed = partOrder.map((part) => {
    const left = pinOrderY(part);
    const right = part.pins.filter((p) => p.edge === "part");
    const isSlim = slim(part);
    const rowsN = Math.max(left.length, right.length, 1);
    const head = isSlim ? 0 : 26;
    const h = isSlim ? 30 : head + rowsN * ROW + part.extras.length * 16 + 6;
    // Pull a part down level with its first pad when there is room, to shorten wires.
    const firstPad = Math.min(...boardWires.filter((w) => w.part === part.name).map((w) => padY.get((w.to as { pad: string }).pad)!), Infinity);
    const want = Number.isFinite(firstPad) ? firstPad - (isSlim ? 15 : head + ROW / 2) : y;
    const top = Math.max(y, want);
    y = top + h + 12;
    return { part, left, right, top, h, head, isSlim };
  });

  const pinYOf = new Map<string, number>();
  for (const p of placed) {
    const at = (i: number) => (p.isSlim ? p.top + 15 : p.top + p.head + i * ROW + ROW / 2);
    p.left.forEach((pin, i) => pinYOf.set(`${p.part.name}|board|${pin.label}`, at(i)));
    p.right.forEach((pin, i) => pinYOf.set(`${p.part.name}|part|${pin.label}`, at(i)));
  }
  const spans = boardWires.map((w) => {
    const a = padY.get((w.to as { pad: string }).pad)!;
    const b = pinYOf.get(`${w.part}|board|${w.pin}`)!;
    return { w, a, b };
  });
  // One vertical lane per wire, so no two wires ever share a run. Wires heading
  // down are ordered lowest-first from the board side and wires heading up
  // highest-first: with pins sorted in pad order, neither group crosses itself.
  const up = spans.filter((s) => s.b < s.a).sort((s, t) => s.b - t.b || s.a - t.a);
  const down = spans.filter((s) => s.b >= s.a).sort((s, t) => t.b - s.b || t.a - s.a);
  const laneOf = new Map<Wire, number>();
  [...up, ...down].forEach((s, i) => laneOf.set(s.w, i));
  const lanes = Math.max(spans.length, 1);
  const laneX0 = 10 + BOARD_W + 16;
  const partX = laneX0 + lanes * LANE + 70;

  // Every part box is as wide as the widest needs: name, or left and right pin labels side by side.
  const CHAR = 6.4;
  const textW = (s: string) => (s === "pin" ? 0 : s.length * CHAR);
  const needed = placed.map((p) => {
    const rowsN = Math.max(p.left.length, p.right.length);
    let w = p.part.name.length * 8 + 24;
    for (let i = 0; i < rowsN; i++) w = Math.max(w, 30 + textW(p.left[i]?.label ?? "") + textW(p.right[i]?.label ?? "") + (p.left[i] && p.right[i] ? 18 : 0));
    for (const e of p.part.extras) w = Math.max(w, 24 + (e.length + 2) * 6);
    return w;
  });
  const partW = Math.ceil(Math.max(PART_W, ...needed));

  const partsOut = placed.map((p) => ({
    part: p.part,
    x: partX,
    y: p.top,
    w: partW,
    h: p.h,
    pins: [
      ...p.left.map((pin) => ({ pin, x: partX, y: pinYOf.get(`${p.part.name}|board|${pin.label}`)! })),
      ...p.right.map((pin) => ({ pin, x: partX + partW, y: pinYOf.get(`${p.part.name}|part|${pin.label}`)! })),
    ],
  }));

  const wiresOut: Layout["wires"] = spans.map(({ w, a, b }) => {
    const lx = laneX0 + laneOf.get(w)! * LANE;
    const startX = 10 + BOARD_W;
    const d = `M${startX} ${a}H${lx}V${b}H${partX}`;
    const segMid = (lx + partX) / 2 - 6;
    return { wire: w, d, resistorAt: w.resistor ? { x: segMid, y: b } : undefined, end: { x: partX, y: b }, badge: { x: partX - 10, y: b } };
  });

  // Part-to-part links run in lanes to the right of the parts.
  const partLinks = model.wires.filter((w) => "part" in w.to);
  // A series resistor sits on the stub leaving the first part, so the lanes stay clear.
  const linkStub = partLinks.some((w) => w.resistor) ? 64 : 26;
  partLinks.forEach((w, i) => {
    const to = w.to as { part: string; pin: string };
    const ya = pinYOf.get(`${w.part}|part|${w.pin}`)!;
    const yb = pinYOf.get(`${to.part}|part|${to.pin}`)!;
    const x0 = partX + partW;
    const lx = x0 + linkStub + i * LANE;
    wiresOut.push({
      wire: w,
      d: `M${x0} ${ya}H${lx}V${yb}H${x0}`,
      resistorAt: w.resistor ? { x: x0 + 42, y: ya } : undefined,
      end: { x: x0, y: yb },
      badge: { x: x0 + 12, y: ya },
    });
  });

  const boardH = Math.max(BOARD_HEAD + pads.length * ROW - ROW / 2 + 8, 60);
  const height = Math.max(TOP + boardH, y) + 10;
  const width = partX + partW + (partLinks.length ? linkStub + 14 + partLinks.length * LANE : 12);
  return { width, height, board: { x: 10, y: TOP, w: BOARD_W, h: boardH }, pads, parts: partsOut, wires: wiresOut };
}
