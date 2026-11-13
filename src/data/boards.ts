import { BOM } from "../lib/shop";
import type { ChipId } from "./chips";

export type BoardId =
  | "esp32"
  | "esp32-doit"
  | "esp32s3"
  | "esp32c3"
  | "esp32c3-supermini"
  | "esp32s2"
  | "esp32c6"
  | "xiao-esp32c3"
  | "xiao-esp32s3"
  | "esp32-cam";

/** What a header pad is, when it is not a plain GPIO. */
export type PadKind = "3v3" | "5v" | "gnd" | "reset" | "flash" | "input-only" | "strap" | "usb" | "uart" | "caution" | "nc";

export interface PadRule {
  kind: PadKind;
  why: string;
}

export interface Board {
  id: BoardId;
  chip: ChipId;
  /** Short label for tags and switches */
  short: string;
  name: string;
  /** Board name to pick in the Arduino IDE */
  arduinoBoard: string;
  /**
   * Header pin labels, top to bottom, with the USB connector at the bottom.
   * Numbered labels are GPIO numbers. Empty when the header layout is not documented.
   */
  left: string[];
  right: string[];
  /** Silkscreen names for pads labelled by GPIO number, e.g. { "2": "D0" } on a XIAO */
  silk?: Record<string, string>;
  /** GPIO numbers for pads with a name instead of a number, e.g. { VP: 36, TX: 1 } */
  gpioOf?: Record<string, number>;
  /** Why there is no header figure, for boards without a documented header layout */
  noHeader?: string;
  /** Pins ProbeHarbor's firmware uses on this board, tested on hardware. Absent for documentation-only boards. */
  tested?: { i2c: string; probe: string; boot: string };
  /** I2C pins to prefer: [SDA, SCL] */
  i2cPins: [string, string];
  /** GPIOs with no boot, flash or USB duties, in the order to hand them out */
  safe: string[];
  /** Pads that are not plain GPIOs, or need care */
  special: Record<string, PadRule>;
  notes: string[];
  buy: { label: string; href: string }[];
  /** Where the header layout comes from */
  source: string;
  /** Further sources for the pin data */
  sources?: { label: string; href: string }[];
  /** Fixed jobs some GPIOs have on this board, e.g. camera or SD card lines */
  wired?: { gpio: number; job: string }[];
  /**
   * Same chip and GPIO numbers as another board. A project for that board also
   * runs on this one, with the same pin numbers, when every pad it uses is on
   * this board's header (see boardsOf in projects.ts).
   */
  variantOf?: BoardId;
  /** The build target the compile service, firmware library and lab use for this board, when it is another board's */
  buildAs?: BoardId;
  /** Header pad labels, for a board whose pad order is not documented (no `left`/`right`) */
  pads?: string[];
}

/** Every pad label on a board's header. */
export const padsOf = (b: Board): string[] => (b.left.length > 0 ? [...b.left, ...b.right] : (b.pads ?? []));

/** The board a project's firmware is built for when it runs on board `id`. */
export const buildTarget = (b: Board): BoardId => b.buildAs ?? b.id;

/** Build targets for a board picker, each named after every board built as it ("ESP32-DevKitC V4, 38 pin or ESP32 DevKit V1 (DOIT), 30 pin"). */
export function buildChoices(boards: Board[]): { id: BoardId; name: string }[] {
  const out: { id: BoardId; name: string }[] = [];
  for (const b of boards) {
    const id = buildTarget(b);
    const seen = out.find((o) => o.id === id);
    if (seen) seen.name += ` or ${b.name}`;
    else out.push({ id, name: b.name });
  }
  return out;
}

export const BOARDS: Board[] = [
  {
    id: "esp32",
    chip: "esp32",
    short: "ESP32",
    name: "ESP32-DevKitC V4, 38 pin",
    arduinoBoard: "ESP32 Dev Module",
    left: ["3V3", "EN", "VP", "VN", "34", "35", "32", "33", "25", "26", "27", "14", "12", "GND", "13", "D2", "D3", "CMD", "5V"],
    right: ["GND", "23", "22", "TX", "RX", "21", "GND", "19", "18", "5", "17", "16", "4", "0", "2", "15", "D1", "D0", "CLK"],
    gpioOf: { VP: 36, VN: 39, TX: 1, RX: 3, CLK: 6, D0: 7, D1: 8, D2: 9, D3: 10, CMD: 11 },
    tested: { i2c: "SDA 21 / SCL 22", probe: "GPIO 4", boot: "GPIO 0" },
    i2cPins: ["21", "22"],
    safe: ["4", "16", "17", "18", "19", "23", "25", "26", "27", "32", "33", "13", "14", "5"],
    special: {
      "3V3": { kind: "3v3", why: "the 3.3 V supply." },
      "5V": { kind: "5v", why: "the 5 V supply from USB." },
      "GND": { kind: "gnd", why: "ground." },
      "EN": { kind: "reset", why: "the reset pin." },
      "VP": { kind: "input-only", why: "GPIO 36 can only read. It has no output driver and no pull-ups." },
      "VN": { kind: "input-only", why: "GPIO 39 can only read. It has no output driver and no pull-ups." },
      "34": { kind: "input-only", why: "GPIO 34 can only read. It has no output driver and no pull-ups." },
      "35": { kind: "input-only", why: "GPIO 35 can only read. It has no output driver and no pull-ups." },
      "0": { kind: "strap", why: "a strapping pin and the BOOT button. Held low at reset, the chip enters download mode." },
      "2": { kind: "strap", why: "a strapping pin. It must be low or floating at reset for flashing to work." },
      "12": { kind: "strap", why: "a strapping pin that sets the flash voltage. Pulled high at reset, the board may not boot." },
      "15": { kind: "strap", why: "a strapping pin. It changes boot messages when low at reset." },
      "D0": { kind: "flash", why: "wired to the flash chip." },
      "D1": { kind: "flash", why: "wired to the flash chip." },
      "D2": { kind: "flash", why: "wired to the flash chip." },
      "D3": { kind: "flash", why: "wired to the flash chip." },
      "CMD": { kind: "flash", why: "wired to the flash chip." },
      "CLK": { kind: "flash", why: "wired to the flash chip." },
      "TX": { kind: "uart", why: "carries the serial console. Anything wired here fights with flashing and the bench." },
      "RX": { kind: "uart", why: "carries the serial console. Anything wired here fights with flashing and the bench." },
    },
    notes: [
      "GPIO 34, 35, VP (36) and VN (39) are input only and have no pull-ups.",
      "GPIO 0, 2, 12 and 15 are strapping pins. Keep loads off them at boot.",
      "D0 to D3, CMD and CLK are wired to the flash chip. Leave them unconnected.",
      "The DevKitC V4 has no user LED. Many 30-pin clones put one on GPIO 2.",
    ],
    buy: [{ label: "ESP32 DevKit", href: BOM.esp32DevKit }],
    source: "https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html",
  },
  // Header order from the widely published DOIT ESP32 DEVKIT V1 pinouts. It is the
  // DevKitC V4 header without the flash pins and GPIO 0, in the same order.
  {
    id: "esp32-doit",
    chip: "esp32",
    short: "DOIT 30",
    name: "ESP32 DevKit V1 (DOIT), 30 pin",
    arduinoBoard: "DOIT ESP32 DEVKIT V1 (or ESP32 Dev Module)",
    left: ["EN", "VP", "VN", "34", "35", "32", "33", "25", "26", "27", "14", "12", "13", "GND", "5V"],
    right: ["23", "22", "TX", "RX", "21", "19", "18", "5", "17", "16", "4", "2", "15", "GND", "3V3"],
    silk: { "5V": "VIN", TX: "TX0", RX: "RX0", "17": "TX2", "16": "RX2" },
    gpioOf: { VP: 36, VN: 39, TX: 1, RX: 3 },
    i2cPins: ["21", "22"],
    safe: ["4", "16", "17", "18", "19", "23", "25", "26", "27", "32", "33", "13", "14", "5"],
    special: {
      "3V3": { kind: "3v3", why: "the 3.3 V supply." },
      "5V": { kind: "5v", why: "printed VIN: the 5 V from USB, or a 5 V input when USB is unplugged." },
      "GND": { kind: "gnd", why: "ground." },
      "EN": { kind: "reset", why: "the reset pin." },
      "VP": { kind: "input-only", why: "GPIO 36 can only read. It has no output driver and no pull-ups." },
      "VN": { kind: "input-only", why: "GPIO 39 can only read. It has no output driver and no pull-ups." },
      "34": { kind: "input-only", why: "GPIO 34 can only read. It has no output driver and no pull-ups." },
      "35": { kind: "input-only", why: "GPIO 35 can only read. It has no output driver and no pull-ups." },
      "2": { kind: "strap", why: "a strapping pin and the blue LED. It must be low or floating at reset for flashing to work." },
      "12": { kind: "strap", why: "a strapping pin that sets the flash voltage. Pulled high at reset, the board may not boot." },
      "15": { kind: "strap", why: "a strapping pin. It changes boot messages when low at reset." },
      "TX": { kind: "uart", why: "carries the serial console. Anything wired here fights with flashing and the bench." },
      "RX": { kind: "uart", why: "carries the serial console. Anything wired here fights with flashing and the bench." },
    },
    notes: [
      "The most common cheap ESP32 board. The same chip and GPIO numbers as the DevKitC, so its projects run here unchanged when their pins are on this header.",
      "GPIO 0 is not on the header (it is the BOOT button), nor are the flash pins.",
      "The pad printed VIN is the 5 V pin. Projects call it 5V.",
      "The blue LED is on GPIO 2.",
      "Clones differ. Check the labels printed on your board, or find each pad with the Pin detective.",
    ],
    buy: [{ label: "ESP32 DevKit", href: BOM.esp32DevKit }],
    source: "https://mischianti.org/doit-esp32-dev-kit-v1-high-resolution-pinout-and-specs/",
    variantOf: "esp32",
    buildAs: "esp32",
  },
  {
    id: "esp32s3",
    chip: "esp32s3",
    short: "S3",
    name: "ESP32-S3-DevKitC-1, 44 pin",
    arduinoBoard: "ESP32S3 Dev Module",
    left: ["3V3", "3V3", "RST", "4", "5", "6", "7", "15", "16", "17", "18", "8", "3", "46", "9", "10", "11", "12", "13", "14", "5V", "GND"],
    right: ["GND", "TX", "RX", "1", "2", "42", "41", "40", "39", "38", "37", "36", "35", "0", "45", "48", "47", "21", "20", "19", "GND", "GND"],
    gpioOf: { TX: 43, RX: 44 },
    tested: { i2c: "SDA 8 / SCL 9", probe: "GPIO 4", boot: "GPIO 0" },
    i2cPins: ["8", "9"],
    safe: ["4", "5", "6", "7", "15", "16", "17", "18", "10", "11", "12", "13", "14", "21", "1", "2"],
    special: {
      "3V3": { kind: "3v3", why: "the 3.3 V supply." },
      "5V": { kind: "5v", why: "the 5 V supply from USB." },
      "GND": { kind: "gnd", why: "ground." },
      "RST": { kind: "reset", why: "the reset pin." },
      "0": { kind: "strap", why: "a strapping pin and the BOOT button." },
      "3": { kind: "strap", why: "a strapping pin that selects the JTAG source." },
      "45": { kind: "strap", why: "a strapping pin that sets the flash voltage." },
      "46": { kind: "strap", why: "a strapping pin. It must be low at reset to boot normally." },
      "19": { kind: "usb", why: "the native USB D- line." },
      "20": { kind: "usb", why: "the native USB D+ line." },
      "35": { kind: "caution", why: "used for flash or PSRAM on modules with octal memory." },
      "36": { kind: "caution", why: "used for flash or PSRAM on modules with octal memory." },
      "37": { kind: "caution", why: "used for flash or PSRAM on modules with octal memory." },
      "38": { kind: "caution", why: "drives the RGB LED on v1.1 boards." },
      "48": { kind: "caution", why: "drives the RGB LED on the first board revision." },
      "TX": { kind: "uart", why: "carries the serial console. Anything wired here fights with flashing and the bench." },
      "RX": { kind: "uart", why: "carries the serial console. Anything wired here fights with flashing and the bench." },
    },
    notes: [
      "The board has two USB ports: a UART bridge and the chip's native USB on GPIO 19 and 20.",
      "Opening the native USB port resets the board, so every new serial connection restarts your firmware.",
      "Firmware that should talk on either port has to listen on both. ProbeHarbor's probe ignored settings on the native port until it did.",
      "The RGB LED is on GPIO 38 on v1.1 boards and GPIO 48 on the first revision.",
      "ProbeHarbor builds for 4 MB flash so modules smaller than the DevKitC's default 8 MB still boot.",
    ],
    buy: [{ label: "ESP32-S3-DevKitC-1", href: BOM.esp32S3DevKitC }],
    source: "https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/user_guide_v1.1.html",
  },
  {
    id: "esp32c3",
    chip: "esp32c3",
    short: "C3",
    name: "ESP32-C3-DevKitM-1, 30 pin",
    arduinoBoard: "ESP32C3 Dev Module",
    left: ["GND", "3V3", "3V3", "2", "3", "GND", "RST", "GND", "0", "1", "10", "GND", "5V", "5V", "GND"],
    right: ["GND", "TX", "RX", "GND", "9", "8", "GND", "7", "6", "5", "4", "GND", "18", "19", "GND"],
    gpioOf: { TX: 21, RX: 20 },
    tested: { i2c: "SDA 6 / SCL 7", probe: "GPIO 4", boot: "GPIO 9" },
    i2cPins: ["6", "7"],
    safe: ["4", "5", "10", "0", "1", "3"],
    special: {
      "3V3": { kind: "3v3", why: "the 3.3 V supply." },
      "5V": { kind: "5v", why: "the 5 V supply from USB." },
      "GND": { kind: "gnd", why: "ground." },
      "RST": { kind: "reset", why: "the reset pin." },
      "2": { kind: "strap", why: "a strapping pin. It must be high at reset." },
      "8": { kind: "strap", why: "a strapping pin and the RGB LED." },
      "9": { kind: "strap", why: "a strapping pin and the BOOT button." },
      "18": { kind: "usb", why: "the native USB D- line." },
      "19": { kind: "usb", why: "the native USB D+ line." },
      "TX": { kind: "uart", why: "carries the serial console. Anything wired here fights with flashing and the bench." },
      "RX": { kind: "uart", why: "carries the serial console. Anything wired here fights with flashing and the bench." },
    },
    notes: [
      "Native USB serial is off by default on the DevKitM-1 build. Without -DARDUINO_USB_MODE=1 a board connected only by its native port boots but prints nothing.",
      "GPIO 9 is the BOOT button and GPIO 8 drives the RGB LED.",
      "GPIO 18 and 19 are the native USB data lines.",
      "Check the silkscreen before wiring: a sensor on the wrong pad was the one wiring fault in ProbeHarbor's C3 test.",
    ],
    buy: [{ label: "ESP32-C3-DevKitM-1", href: BOM.esp32C3DevKitM }],
    source: "https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32c3/esp32-c3-devkitm-1/user_guide.html",
  },

  // Pads are printed with their GPIO numbers. The pad order is not shown: the
  // sources found give only pin lists, and say to read the board's silkscreen.
  // LED, I2C and SPI defaults: the Arduino core's variants/nologo_esp32c3_super_mini.
  {
    id: "esp32c3-supermini",
    chip: "esp32c3",
    short: "C3 Mini",
    name: "ESP32-C3 SuperMini",
    arduinoBoard: "Nologo ESP32C3 SuperMini (or ESP32C3 Dev Module with USB CDC On Boot enabled)",
    left: [],
    right: [],
    pads: ["5V", "GND", "3V3", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "20", "21"],
    noHeader:
      "The pad order is not shown because the published pinouts disagree on it. Each pad is printed with its GPIO number, so wire by the labels on your board.",
    i2cPins: ["8", "9"],
    safe: ["4", "5", "6", "7", "10", "0", "1", "3"],
    special: {
      "3V3": { kind: "3v3", why: "the 3.3 V supply." },
      "5V": { kind: "5v", why: "the 5 V supply from USB." },
      "GND": { kind: "gnd", why: "ground." },
      "2": { kind: "strap", why: "a strapping pin. It must be high at reset." },
      "8": { kind: "strap", why: "a strapping pin and the blue LED, which lights when the pin is low." },
      "9": { kind: "strap", why: "a strapping pin and the BOOT button." },
      "21": { kind: "uart", why: "UART0 TX. The ROM boot messages come out here." },
      "20": { kind: "uart", why: "UART0 RX." },
    },
    notes: [
      "A tiny, cheap C3 board. The same chip and GPIO numbers as the C3 DevKitM-1, so its projects run here when their pins are on this board.",
      "Serial output goes over the USB-C port, which needs USB CDC On Boot. The firmware and the online build here set it; in the Arduino IDE pick Nologo ESP32C3 SuperMini, or enable USB CDC On Boot.",
      "GPIO 8 drives the blue LED (on when low) and GPIO 9 is the BOOT button. Both are strapping pins.",
      "GPIO 18 and 19 are the USB data lines and are not on the header.",
      "To flash a board that will not connect, hold BOOT, press and release RESET, then let go of BOOT.",
    ],
    buy: [],
    source: "https://github.com/espressif/arduino-esp32/blob/master/variants/nologo_esp32c3_super_mini/pins_arduino.h",
    variantOf: "esp32c3",
  },

  // Boards below come from vendor documentation only. Nobody has run ESP32 Bench
  // firmware on them yet, so they have no `tested` pins.

  // Header tables J1 (left) and J3 (right):
  // https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s2/esp32-s2-devkitc-1/user_guide.html
  {
    id: "esp32s2",
    chip: "esp32s2",
    short: "S2",
    name: "ESP32-S2-DevKitC-1, 44 pin",
    arduinoBoard: "ESP32S2 Dev Module",
    left: ["3V3", "3V3", "RST", "4", "5", "6", "7", "15", "16", "17", "18", "8", "3", "46", "9", "10", "11", "12", "13", "14", "5V", "GND"],
    right: ["GND", "TX", "RX", "1", "2", "42", "41", "40", "39", "38", "37", "36", "35", "0", "45", "34", "33", "21", "20", "19", "GND", "GND"],
    gpioOf: { TX: 43, RX: 44 },
    i2cPins: ["8", "9"],
    safe: ["4", "5", "6", "7", "15", "16", "17", "10", "11", "12", "13", "14", "21", "1", "2"],
    special: {
      "3V3": { kind: "3v3", why: "the 3.3 V supply." },
      "5V": { kind: "5v", why: "the 5 V supply from USB." },
      "GND": { kind: "gnd", why: "ground." },
      "RST": { kind: "reset", why: "the reset pin." },
      "0": { kind: "strap", why: "a strapping pin. Held low at reset, the chip enters download mode." },
      "45": { kind: "strap", why: "a strapping pin that sets the flash voltage." },
      "46": { kind: "input-only", why: "GPIO 46 can only read, and it is a strapping pin that must be low to enter download mode." },
      "18": { kind: "caution", why: "drives the board's RGB LED." },
      "19": { kind: "usb", why: "the native USB D- line." },
      "20": { kind: "usb", why: "the native USB D+ line." },
      "33": { kind: "caution", why: "used for octal flash or PSRAM on modules that have it." },
      "34": { kind: "caution", why: "used for octal flash or PSRAM on modules that have it." },
      "35": { kind: "caution", why: "used for octal flash or PSRAM on modules that have it." },
      "36": { kind: "caution", why: "used for octal flash or PSRAM on modules that have it." },
      "37": { kind: "caution", why: "used for octal flash or PSRAM on modules that have it." },
      "TX": { kind: "uart", why: "carries the serial console. Anything wired here fights with flashing and the bench." },
      "RX": { kind: "uart", why: "carries the serial console. Anything wired here fights with flashing and the bench." },
    },
    notes: [
      "The ESP32-S2 has Wi-Fi but no Bluetooth.",
      "Two USB ports: a micro-USB UART bridge, the default, and the chip's native USB on GPIO 19 and 20.",
      "The addressable RGB LED is on GPIO 18.",
      "GPIO 46 is input only. GPIO 17 and 18 have the chip's two DAC outputs.",
      "The current DevKitC-1 uses the ESP32-S2-SOLO-2 module with 8 MB flash and 2 MB PSRAM.",
    ],
    buy: [],
    source: "https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s2/esp32-s2-devkitc-1/user_guide.html",
  },

  // Header tables J1 (left) and J3 (right):
  // https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32c6/esp32-c6-devkitc-1/user_guide.html
  // Default I2C pins from the Arduino core's variants/esp32c6/pins_arduino.h (SDA 23, SCL 22).
  {
    id: "esp32c6",
    chip: "esp32c6",
    short: "C6",
    name: "ESP32-C6-DevKitC-1, 32 pin",
    arduinoBoard: "ESP32C6 Dev Module",
    left: ["3V3", "RST", "4", "5", "6", "7", "0", "1", "8", "10", "11", "2", "3", "5V", "GND", "NC"],
    right: ["GND", "TX", "RX", "15", "23", "22", "21", "20", "19", "18", "9", "GND", "13", "12", "GND", "NC"],
    gpioOf: { TX: 16, RX: 17 },
    i2cPins: ["23", "22"],
    safe: ["0", "1", "2", "3", "6", "7", "10", "11", "18", "19", "20", "21"],
    special: {
      "3V3": { kind: "3v3", why: "the 3.3 V supply." },
      "5V": { kind: "5v", why: "the 5 V supply from USB." },
      "GND": { kind: "gnd", why: "ground." },
      "RST": { kind: "reset", why: "the reset pin." },
      "NC": { kind: "nc", why: "not connected to anything." },
      "4": { kind: "strap", why: "a strapping pin (MTMS). It only changes SDIO timing, so it is safe for most projects once the board has booted." },
      "5": { kind: "strap", why: "a strapping pin (MTDI). It only changes SDIO timing, so it is safe for most projects once the board has booted." },
      "8": { kind: "strap", why: "a strapping pin and the RGB LED. It must be high to enter download mode." },
      "9": { kind: "strap", why: "a strapping pin. Held low at reset, the chip enters download mode." },
      "15": { kind: "strap", why: "a strapping pin that selects the JTAG source." },
      "12": { kind: "usb", why: "the native USB D- line." },
      "13": { kind: "usb", why: "the native USB D+ line." },
      "TX": { kind: "uart", why: "carries the serial console. Anything wired here fights with flashing and the bench." },
      "RX": { kind: "uart", why: "carries the serial console. Anything wired here fights with flashing and the bench." },
    },
    notes: [
      "The ESP32-C6 adds Wi-Fi 6 and an 802.15.4 radio for Thread and Zigbee to the usual Wi-Fi and Bluetooth LE.",
      "Two USB-C ports: a UART bridge and the chip's native USB on GPIO 12 and 13.",
      "The addressable RGB LED is on GPIO 8, which is also a strapping pin.",
      "Only GPIO 0 to 6 have analog input, and GPIO 0 to 7 can wake the chip from deep sleep.",
      "There are no touch pins.",
    ],
    buy: [],
    source: "https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32c6/esp32-c6-devkitc-1/user_guide.html",
  },

  // Pad names and GPIOs: https://wiki.seeedstudio.com/XIAO_ESP32C3_Getting_Started/ (Pin Map)
  // and the Arduino core's variants/XIAO_ESP32C3/pins_arduino.h.
  // Pad positions: the standard XIAO layout, D0 to D6 down one edge from the USB end and
  // 5V, GND, 3V3, D10 to D7 down the other, as described in Zephyr's seeed,xiao-gpio binding:
  // https://docs.zephyrproject.org/latest/build/dts/api/bindings/gpio/seeed%2Cxiao-gpio.html
  // Shown here turned round so the USB connector is at the bottom, like every board on this site.
  {
    id: "xiao-esp32c3",
    chip: "esp32c3",
    short: "XIAO C3",
    name: "Seeed Studio XIAO ESP32C3",
    arduinoBoard: "XIAO_ESP32C3",
    left: ["20", "8", "9", "10", "3V3", "GND", "5V"],
    right: ["21", "7", "6", "5", "4", "3", "2"],
    silk: { "2": "D0", "3": "D1", "4": "D2", "5": "D3", "6": "D4", "7": "D5", "21": "D6", "20": "D7", "8": "D8", "9": "D9", "10": "D10" },
    i2cPins: ["6", "7"],
    safe: ["3", "4", "5", "10"],
    special: {
      "3V3": { kind: "3v3", why: "the 3.3 V output." },
      "5V": { kind: "5v", why: "the 5 V supply from USB." },
      "GND": { kind: "gnd", why: "ground." },
      "2": { kind: "strap", why: "a strapping pin. It must be high at reset." },
      "8": { kind: "strap", why: "a strapping pin. It must be high to enter download mode." },
      "9": { kind: "strap", why: "a strapping pin and the BOOT button." },
      "21": { kind: "uart", why: "UART0 TX. The ROM boot messages come out here." },
      "20": { kind: "uart", why: "UART0 RX." },
    },
    notes: [
      "Pad names on the silkscreen are D0 to D10. This page shows the GPIO number next to each, and sketches use the GPIO number.",
      "D0 (GPIO 2), D8 (GPIO 8) and D9 (GPIO 9) are strapping pins. GPIO 9 is also the BOOT button.",
      "Serial output goes over the USB-C port. D6 and D7 are UART0 TX and RX.",
      "Default I2C is D4 (GPIO 6) for SDA and D5 (GPIO 7) for SCL.",
      "The antenna is a separate U.FL whip. Wi-Fi range is poor with nothing attached.",
    ],
    buy: [],
    source: "https://wiki.seeedstudio.com/XIAO_ESP32C3_Getting_Started/",
    sources: [{ label: "XIAO pad order (Zephyr)", href: "https://docs.zephyrproject.org/latest/build/dts/api/bindings/gpio/seeed%2Cxiao-gpio.html" }],
  },

  // Pad names and GPIOs: https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/ (Pin Map)
  // and the Arduino core's variants/XIAO_ESP32S3/pins_arduino.h. Pad positions as for the XIAO ESP32C3.
  {
    id: "xiao-esp32s3",
    chip: "esp32s3",
    short: "XIAO S3",
    name: "Seeed Studio XIAO ESP32S3",
    arduinoBoard: "XIAO_ESP32S3",
    left: ["44", "7", "8", "9", "3V3", "GND", "5V"],
    right: ["43", "6", "5", "4", "3", "2", "1"],
    silk: { "1": "D0", "2": "D1", "3": "D2", "4": "D3", "5": "D4", "6": "D5", "43": "D6", "44": "D7", "7": "D8", "8": "D9", "9": "D10" },
    i2cPins: ["5", "6"],
    safe: ["1", "2", "4", "7", "8", "9", "3"],
    special: {
      "3V3": { kind: "3v3", why: "the 3.3 V output." },
      "5V": { kind: "5v", why: "the 5 V supply from USB." },
      "GND": { kind: "gnd", why: "ground." },
      "3": { kind: "strap", why: "a strapping pin that selects the JTAG source. Safe for most projects." },
      "43": { kind: "uart", why: "UART0 TX. The ROM boot messages come out here." },
      "44": { kind: "uart", why: "UART0 RX." },
    },
    notes: [
      "Pad names on the silkscreen are D0 to D10. This page shows the GPIO number next to each, and sketches use the GPIO number.",
      "The user LED is on GPIO 21 and lights when the pin is low. The BOOT button is GPIO 0.",
      "8 MB flash and 8 MB PSRAM. Turn on PSRAM under Tools to use it.",
      "Serial output goes over the USB-C port. D6 and D7 are UART0 TX and RX.",
      "Every header GPIO except D6 and D7 also has touch and analog input.",
    ],
    buy: [],
    source: "https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/",
    sources: [{ label: "XIAO pad order (Zephyr)", href: "https://docs.zephyrproject.org/latest/build/dts/api/bindings/gpio/seeed%2Cxiao-gpio.html" }],
  },

  // Camera pins: the AI-Thinker block in Espressif's CameraWebServer example, camera_pins.h:
  // https://github.com/espressif/arduino-esp32/blob/master/libraries/ESP32/examples/Camera/CameraWebServer/camera_pins.h
  // SD card: the ESP32's SDMMC slot 1 pins from the ESP-IDF SDMMC host driver documentation.
  // The header layout is left out: AI-Thinker's own documentation could not be checked.
  {
    id: "esp32-cam",
    chip: "esp32",
    short: "CAM",
    name: "AI-Thinker ESP32-CAM",
    arduinoBoard: "AI Thinker ESP32-CAM",
    left: [],
    right: [],
    noHeader:
      "The header order is not shown because AI-Thinker's documentation for it could not be checked. Read the labels printed next to each pin on your board.",
    i2cPins: ["14", "15"],
    safe: [],
    special: {},
    wired: [
      { gpio: 0, job: "Camera XCLK. Also the boot pin: tie it to GND while flashing" },
      { gpio: 5, job: "Camera data Y2" },
      { gpio: 18, job: "Camera data Y3" },
      { gpio: 19, job: "Camera data Y4" },
      { gpio: 21, job: "Camera data Y5" },
      { gpio: 36, job: "Camera data Y6" },
      { gpio: 39, job: "Camera data Y7" },
      { gpio: 34, job: "Camera data Y8" },
      { gpio: 35, job: "Camera data Y9" },
      { gpio: 25, job: "Camera VSYNC" },
      { gpio: 23, job: "Camera HREF" },
      { gpio: 22, job: "Camera PCLK" },
      { gpio: 26, job: "Camera SCCB data (SIOD)" },
      { gpio: 27, job: "Camera SCCB clock (SIOC)" },
      { gpio: 32, job: "Camera power-down (PWDN)" },
      { gpio: 4, job: "White flash LED, and SD card D1" },
      { gpio: 33, job: "Small red status LED" },
      { gpio: 14, job: "SD card CLK" },
      { gpio: 15, job: "SD card CMD" },
      { gpio: 2, job: "SD card D0" },
      { gpio: 12, job: "SD card D2" },
      { gpio: 13, job: "SD card D3" },
      { gpio: 1, job: "UART0 TX, used for flashing and the serial console" },
      { gpio: 3, job: "UART0 RX, used for flashing and the serial console" },
    ],
    notes: [
      "There is no USB port. Flash it through a 3.3 V USB-to-serial adapter on U0T and U0R, with IO0 tied to GND, then remove that wire and reset.",
      "Power it from a solid 5 V supply. Brownout resets are the most common ESP32-CAM fault, and the adapter's 3.3 V pin is rarely strong enough.",
      "The camera uses almost every GPIO. With the SD card in 1-bit mode, GPIO 12 and 13 are the usual pins left for your own wiring.",
      "The bright LED on GPIO 4 shares a line with the SD card, so it flickers when the card is used.",
      "Enable PSRAM in the board settings, or the camera can only use small frame sizes.",
    ],
    buy: [],
    source: "https://github.com/espressif/arduino-esp32/blob/master/libraries/ESP32/examples/Camera/CameraWebServer/camera_pins.h",
    sources: [{ label: "ESP-IDF SDMMC pins", href: "https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/sdmmc_host.html" }],
  },
];

/** Boards with a documented header layout, which the pinout figure and the wiring pad can draw. */
export const HEADER_BOARDS: Board[] = BOARDS.filter((b) => b.left.length > 0);

/** The GPIO number behind a pad label, or null for supply, ground and other non-GPIO pads. */
export function gpioOfPad(board: Board, label: string): number | null {
  if (/^\d+$/.test(label)) return Number(label);
  return board.gpioOf?.[label] ?? null;
}

export const boardById = (id: BoardId): Board => BOARDS.find((b) => b.id === id) ?? BOARDS[0];
