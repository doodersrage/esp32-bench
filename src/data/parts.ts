// Parts the wiring pad knows how to connect. Ids match DRAWER in projects.ts,
// so a project's `needs` can be loaded straight onto the pad.
import type { DrawerPart } from "./projects";

/**
 * How a part pin behaves:
 * power3 / power5  needs that supply
 * gnd              ground
 * in               the board drives it (board output)
 * out              the part drives it (board input)
 * bidir            both directions, such as a one-wire or I2C data line
 */
export type PinKind = "power3" | "power5" | "gnd" | "in" | "out" | "bidir";

export interface PartPin {
  name: string;
  kind: PinKind;
  /** I2C role. Bus pins from several parts share the same two pads. */
  bus?: "sda" | "scl";
  /** The part drives this pin at 5 V */
  level5?: boolean;
  /** Extra component or caution for this pin */
  note?: string;
}

export interface Part {
  id: DrawerPart | "led";
  name: string;
  pins: PartPin[];
}

export const PARTS: Part[] = [
  {
    id: "dht22", name: "DHT22",
    pins: [
      { name: "VCC", kind: "power3" },
      { name: "DATA", kind: "bidir", note: "10 kΩ pull-up to 3V3 on a bare sensor. Breakout boards include it." },
      { name: "GND", kind: "gnd" },
    ],
  },
  {
    id: "ds18b20", name: "DS18B20 probe",
    pins: [
      { name: "VDD", kind: "power3" },
      { name: "DATA", kind: "bidir", note: "4.7 kΩ pull-up from DATA to 3V3." },
      { name: "GND", kind: "gnd" },
    ],
  },
  {
    id: "i2c", name: "I2C sensor module",
    pins: [
      { name: "VIN", kind: "power3" },
      { name: "GND", kind: "gnd" },
      { name: "SDA", kind: "bidir", bus: "sda" },
      { name: "SCL", kind: "in", bus: "scl" },
    ],
  },
  {
    id: "oled", name: "SSD1306 OLED",
    pins: [
      { name: "VCC", kind: "power3" },
      { name: "GND", kind: "gnd" },
      { name: "SDA", kind: "bidir", bus: "sda" },
      { name: "SCL", kind: "in", bus: "scl" },
    ],
  },
  {
    id: "hcsr04", name: "HC-SR04",
    pins: [
      { name: "VCC", kind: "power5" },
      { name: "TRIG", kind: "in" },
      { name: "ECHO", kind: "out", level5: true, note: "Put 1 kΩ in series and 2 kΩ from the GPIO to GND." },
      { name: "GND", kind: "gnd" },
    ],
  },
  {
    id: "button", name: "Push button",
    pins: [
      { name: "A", kind: "out", note: "Uses the internal pull-up: pinMode(pin, INPUT_PULLUP). Pressed reads LOW." },
      { name: "B", kind: "gnd" },
    ],
  },
  {
    id: "reed", name: "Reed switch",
    pins: [
      { name: "A", kind: "out", note: "Uses the internal pull-up. Magnet near reads LOW." },
      { name: "B", kind: "gnd" },
    ],
  },
  {
    id: "wires", name: "Leak contacts",
    pins: [
      { name: "A", kind: "out", note: "Uses the internal pull-up. Water across the contacts reads LOW." },
      { name: "B", kind: "gnd" },
    ],
  },
  {
    id: "powersense", name: "Power sense module",
    pins: [
      { name: "OUT", kind: "out", note: "Use a module with an isolated output. Never connect mains to the board." },
      { name: "GND", kind: "gnd" },
    ],
  },
  {
    id: "max31855", name: "MAX31855 thermocouple amp",
    pins: [
      { name: "VIN", kind: "power3" },
      { name: "GND", kind: "gnd" },
      { name: "CS", kind: "in" },
      { name: "CLK", kind: "in" },
      { name: "DO", kind: "out" },
    ],
  },
  {
    id: "max6675", name: "MAX6675 module",
    pins: [
      { name: "VCC", kind: "power3" },
      { name: "GND", kind: "gnd" },
      { name: "CS", kind: "in" },
      { name: "SCK", kind: "in" },
      { name: "SO", kind: "out" },
    ],
  },
  {
    id: "led", name: "LED",
    pins: [
      { name: "ANODE", kind: "in", note: "220 Ω resistor in series." },
      { name: "CATHODE", kind: "gnd" },
    ],
  },
];

export const partById = (id: string): Part | undefined => PARTS.find((p) => p.id === id);
