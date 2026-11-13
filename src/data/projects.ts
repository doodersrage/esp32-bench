import { BOARDS, buildTarget, padsOf, type BoardId } from "./boards";
import { BOM } from "../lib/shop";
import { PROBEHARBOR_SKETCHES } from "./probeharbor";
import { WIFI, benchSettings, type Setting } from "./bench-settings";
export type { Setting } from "./bench-settings";

export type Tag = "games" | "motion" | "no-parts" | "sensors" | "input" | "display" | "lights" | "wireless" | "logging" | "probeharbor";

/** A check done on real hardware. `board` says which board it was done on. */
export interface Verified {
  board: BoardId;
  what: string;
  /** Firmware version and date, when recorded */
  when?: string;
}

export interface Project {
  /** Slug used in the URL: /projects/<id> */
  id: string;
  name: string;
  level: "Starter" | "Intermediate";
  /** Rough build time in minutes */
  mins: number;
  tags: Tag[];
  /** Date the project was published (YYYY-MM-DD); the library marks it New for NEW_FOR_DAYS */
  added?: string;
  /** One-line summary */
  sum: string;
  /**
   * Parts needed beyond the board, as keys of DRAWER. Each inner list is a set
   * of alternatives: [["ds18b20", "dht22"]] means either one will do.
   */
  needs: DrawerPart[][];
  /** Boards this project supports. Defaults to the classic ESP32. */
  boards?: BoardId[];
  /**
   * Per-board values substituted for %NAME% in `pins`, `wiring` and `code`,
   * e.g. { esp32: { SDA: "21" }, esp32s3: { SDA: "8" } }.
   */
  vars?: Partial<Record<BoardId, Record<string, string>>>;
  /** Pin labels to highlight on the pinout, e.g. "21", "3V3", "GND", "%SDA%" */
  pins: string[];
  libs: string[];
  baud: number;
  /** [quantity, description, buy link] */
  parts: [number, string, string?][];
  /** [from, to, note] */
  wiring: [string, string, string][];
  /** Arduino sketch. Omit for projects that ship as prebuilt firmware. */
  code?: string;
  /** Where the firmware source lives, for prebuilt projects */
  sourceUrl?: string;
  /** ESP Web Tools manifest under public/, for projects that flash from the browser */
  flash?: { manifest: string; version: string; after: string[] };
  /** Show the form that sends ProbeHarbor settings to the board over USB */
  setup?: "probeharbor";
  /**
   * Settings the sketch reads from flash (its "ESP32 Bench settings block"), so
   * prebuilt firmware works without editing code. The project page's settings
   * form sends them over USB. Keys must match the sketch's BENCH_KEYS.
   */
  settings?: Setting[];
  /**
   * ProbeHarbor projects written here rather than copied from ProbeHarbor:
   * "reads" shows readings from a share link, "sends" posts to a push device.
   */
  probeharbor?: "reads" | "sends";
  /** A second sketch for another board, such as the Uno end of a radio link */
  extraCode?: { title: string; board: string; code: string };
  /** Checks done on real hardware */
  verified?: Verified[];
  /** Things that have only been compiled or are still untested */
  open?: string[];
  /** Field notes worth knowing before you build */
  notes?: string[];
  /** Lines the firmware prints when it works */
  sample: string[];
}

/** Parts someone might have in a drawer, for the "build tonight" picker. */
export const DRAWER = {
  dht22: "DHT22",
  ds18b20: "DS18B20 probe",
  i2c: "BME280, SHT31, AHT20 or another I2C module",
  oled: "SSD1306 OLED",
  hcsr04: "HC-SR04",
  button: "Push button",
  reed: "Reed switch",
  wires: "Bare wire or contact pads",
  powersense: "Power sense module",
  max31855: "MAX31855 and thermocouple",
  max6675: "MAX6675 module",
  neopixel: "NeoPixel strip or stick",
  servo: "Hobby servo (SG90 or similar)",
  relay: "Relay module",
  epaper: "SPI e-paper display",
  led: "LEDs and 220 Ω resistors",
  buzzer: "Passive buzzer or piezo",
  pot: "10 kΩ potentiometers",
  soil: "Capacitive soil moisture sensor",
  sharpir: "Sharp IR distance sensor",
  mpu6050: "MPU-6050 accelerometer and gyro",
  joystick: "Analog thumb joystick",
  pir: "PIR motion sensor (HC-SR501)",
  shiftreg: "74HC595 shift register",
  sevenseg: "7-segment LED digit",
  dcmotor: "Small DC motor",
  transistor: "NPN transistor and diode",
  ldr: "Photoresistor (light sensor)",
  lcd1602: "16x2 character LCD",
  encoder: "Rotary encoder",
  nrf24: "Two nRF24L01+ radio modules",
  rgbled: "RGB LED",
  rc522: "RC522 RFID reader",
  irreceiver: "IR receiver and a remote",
  stepper: "28BYJ-48 stepper and ULN2003 board",
  keypad: "4x4 membrane keypad",
  max7219: "MAX7219 LED matrix",
  ds3231: "DS3231 real-time clock",
  tft: "ST7789 colour TFT",
  sdcard: "MicroSD card module",
  esp32cam: "ESP32-CAM board",
} as const;
export type DrawerPart = keyof typeof DRAWER;

/** The drawer picker's parts, grouped. Every DRAWER part appears in exactly one group (checked at build). */
export const DRAWER_GROUPS: [string, DrawerPart[]][] = [
  ["Basics", ["led", "rgbled", "button", "pot", "buzzer", "wires", "transistor", "shiftreg"]],
  ["Sensors", ["dht22", "ds18b20", "i2c", "hcsr04", "sharpir", "mpu6050", "pir", "ldr", "soil", "reed", "powersense", "max31855", "max6675"]],
  ["Displays and lights", ["oled", "lcd1602", "epaper", "tft", "max7219", "sevenseg", "neopixel"]],
  ["Input", ["joystick", "encoder", "keypad", "irreceiver", "rc522"]],
  ["Motors and switching", ["servo", "relay", "dcmotor", "stepper"]],
  ["Radio, time and storage", ["nrf24", "ds3231", "sdcard"]],
  ["Other boards", ["esp32cam"]],
];

export const TAGS: [Tag | "all", string][] = [
  ["all", "All"],
  ["no-parts", "No extra parts"],
  ["sensors", "Sensors"],
  ["input", "Buttons and input"],
  ["display", "Display"],
  ["lights", "Lights"],
  ["motion", "Motors and relays"],
  ["wireless", "Wi-Fi and radio"],
  ["logging", "Clocks, logging and power"],
  ["games", "Games and toys"],
  ["probeharbor", "ProbeHarbor"],
];

export const LEVELS: [Project["level"] | "all", string][] = [
  ["all", "Any level"],
  ["Starter", "Starter"],
  ["Intermediate", "Intermediate"],
];

/** How long a project keeps its New mark after `added`. */
export const NEW_FOR_DAYS = 45;
export const isNew = (p: Project, now = Date.now()): boolean =>
  p.added !== undefined && now - Date.parse(p.added) < NEW_FOR_DAYS * 86_400_000;

/**
 * What the "build tonight" picker needs in the drawer: the project's parts, plus
 * the board itself when it only runs on one that is not a plain dev board. Kept
 * out of `needs`, which the wiring pad loads as parts to wire.
 */
export const pickerNeeds = (p: Project): DrawerPart[][] =>
  boardsOf(p).every((b) => b === "esp32-cam") ? [...p.needs, ["esp32cam"]] : p.needs;

/** Projects that run on a bare dev board with nothing else. */
export const bareBoard = (p: Project): boolean => pickerNeeds(p).length === 0;

const fill = (text: string, vars: Record<string, string>) =>
  text.replace(/%([A-Z]+)%/g, (whole, name: string) => vars[name] ?? whole);

/** The boards a project lists itself, without the variant boards boardsOf adds. */
const ownBoards = (p: Project): BoardId[] => p.boards ?? ["esp32"];

/** Pin values for a board: its own, or its parent's for a variant board such as the DOIT 30-pin. */
const varsFor = (p: Project, board: BoardId): Record<string, string> => {
  const own = p.vars?.[board];
  if (own) return own;
  const parent = BOARDS.find((b) => b.id === board)?.variantOf;
  return (parent && p.vars?.[parent]) ?? {};
};

/**
 * Every board a project runs on: the ones it lists, each followed by any variant
 * board (same chip and GPIO numbers) whose header has every pad the project uses.
 */
export const boardsOf = (p: Project): BoardId[] =>
  ownBoards(p).flatMap((id) => [
    id,
    // A variant with its own build target (the C3 SuperMini) needs a sketch to build;
    // prebuilt firmware from elsewhere was built for the parent board only.
    ...BOARDS.filter((v) => v.variantOf === id && !ownBoards(p).includes(v.id) && (v.buildAs !== undefined || p.code !== undefined))
      .filter((v) => {
        const pads = new Set(padsOf(v));
        return p.pins.every((pin) => pads.has(fill(pin, varsFor(p, id))));
      })
      .map((v) => v.id),
  ]);

/** The build targets for a project's firmware: one per board, variants mapped to the board they are built as. */
export const buildBoardsOf = (p: Project): BoardId[] => [...new Set(boardsOf(p).map((id) => buildTarget(BOARDS.find((b) => b.id === id)!)))];

/** A project's pins, wiring and code with one board's values filled in. */
export function forBoard(p: Project, board: BoardId) {
  const vars = varsFor(p, board);
  return {
    pins: p.pins.map((x) => fill(x, vars)),
    wiring: p.wiring.map(([from, to, note]) => [fill(from, vars), fill(to, vars), fill(note, vars)] as const),
    code: p.code === undefined ? undefined : fill(p.code, vars),
    sample: p.sample.map((x) => fill(x, vars)),
  };
}

const R = String.raw;

export const PROJECTS: Project[] = [
  {
    id: "probeharbor-probe", needs: [["ds18b20", "dht22", "i2c"]], name: "ProbeHarbor probe", level: "Starter", mins: 15, tags: ["probeharbor", "sensors", "wireless"],
    sum: "Prebuilt sensor firmware from the ProbeHarbor project. Flash it from this page, then it finds a temperature sensor by itself and posts a reading every minute.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    vars: {
      esp32: { SDA: "21", SCL: "22", LEAK: "27", DOOR: "26", BAT: "35" },
      esp32s3: { SDA: "8", SCL: "9", LEAK: "5", DOOR: "6", BAT: "7" },
      esp32c3: { SDA: "6", SCL: "7", LEAK: "5", DOOR: "10", BAT: "3" },
    },
    pins: ["3V3", "GND", "4", "%SDA%", "%SCL%", "%LEAK%", "%DOOR%", "%BAT%"],
    libs: [], baud: 115200,
    parts: [
      [1, "ESP32 dev board", BOM.esp32DevKit],
      [1, "or ESP32-S3-DevKitC-1", BOM.esp32S3DevKitC],
      [1, "or ESP32-C3-DevKitM-1", BOM.esp32C3DevKitM],
      [1, "DS18B20 waterproof probe, or a DHT22", BOM.ds18b20],
      [1, "4.7 kΩ resistor, pull-up for the probe data line", BOM.resistor4k7],
      [1, "Optional I2C sensor: SHT31", BOM.sht31],
      [1, "Optional I2C sensor: BME280", BOM.bme280],
      [1, "Optional I2C sensor: AHT20", BOM.aht20],
      [1, "Optional door reed switch", BOM.reedSwitch],
      [2, "Optional 100 kΩ resistors, battery divider", BOM.resistor100k],
    ],
    wiring: [
      ["Sensor VCC", "3V3", ""],
      ["Sensor GND", "GND", ""],
      ["DS18B20 or DHT22 data", "GPIO 4", "Up to four DS18B20s share the line"],
      ["4.7 kΩ pull-up resistor", "GPIO 4 to 3V3", "Holds the data line high"],
      ["I2C sensor SDA", "GPIO %SDA%", "SHT31, BME280 or AHT20, found at boot"],
      ["I2C sensor SCL", "GPIO %SCL%", ""],
      ["Optional: leak contact, wire A", "GPIO %LEAK%", "Only read when enabled in setup"],
      ["Optional: leak contact, wire B", "GND", ""],
      ["Optional: door reed switch, wire A", "GPIO %DOOR%", "Only read when enabled in setup"],
      ["Optional: door reed switch, wire B", "GND", ""],
      ["Optional: battery + through 100 kΩ", "GPIO %BAT%", "1:1 divider from a single Li-ion cell. Only read when enabled"],
      ["Optional: 100 kΩ from GPIO %BAT%", "GND", "Divider bottom: the pin sees half the battery voltage"],
    ],
    sourceUrl: "https://github.com/doodersrage/probeharbor/tree/main/firmware/probeharbor-probe",
    flash: {
      manifest: "/firmware/probeharbor-probe/manifest.json",
      version: "1.2.6",
      after: [
        "Create a device at probeharbor.dev to get a device key.",
        "Keep the board on USB and send Wi-Fi and the key with the form below.",
        "No computer nearby? Join the ProbeHarbor-Setup Wi-Fi network from a phone and fill in the portal instead.",
      ],
    },
    setup: "probeharbor",
    verified: [
      { board: "esp32", what: "Browser flash, USB settings, Wi-Fi and first reading with a DS18B20", when: "firmware 1.0.1" },
      { board: "esp32", what: "DHT22 on GPIO 4", when: "firmware 1.1.1" },
      { board: "esp32", what: "BME280 on I2C: temperature, humidity and pressure", when: "firmware 1.2.2" },
      { board: "esp32", what: "SHT31 on I2C", when: "firmware 1.2.3" },
      { board: "esp32", what: "Door reed switch, with a post on every change", when: "firmware 1.2.3, 2026-10-29" },
      { board: "esp32", what: "AHT20 on SDA 21 / SCL 22", when: "firmware 1.2.6, 2026-11-11" },
      { board: "esp32s3", what: "Flash, settings and Wi-Fi over the native USB port", when: "firmware 1.2.4, 2026-11-05" },
      { board: "esp32s3", what: "AHT20 on SDA 8 / SCL 9", when: "firmware 1.2.6, 2026-11-11" },
      { board: "esp32c3", what: "Native USB port, settings and Wi-Fi, DHT22 on GPIO 4", when: "firmware 1.2.5, 2026-11-06" },
    ],
    open: [
      "Leak and battery inputs on any board",
      "Setup portal and the five-second BOOT reset",
      "DS18B20 on the S3 and C3, and any I2C sensor on the C3",
      "UART port on the S3 and on a C3 DevKitM-1",
      "A long unattended run on the S3",
    ],
    notes: [
      "Flashing writes a merged image at offset 0, which also erases saved Wi-Fi and the device key. Send settings again after every flash.",
      "TT post -5 means the reply was lost, not the reading. In testing the server had stored both readings that printed -5.",
      "An I2C sensor that is found at boot but then prints TT sensor problem usually has a loose power or ground wire. That was the cause when it happened on the S3.",
      "Hold BOOT for five seconds to erase Wi-Fi and the key. Feather boards have no button on GPIO 0, so resend settings instead.",
      "On a Feather, probe data on GPIO 4 is the pad marked A5 and the door input on GPIO 26 is A0.",
    ],
    sample: [
      "TT firmware 1.2.6",
      "TT setup: send settings over USB, or join the ProbeHarbor-Setup Wi-Fi network",
      "TT key saved",
      "TT wifi joining",
      "TT sensor: AHT20 on I2C (SDA %SDA%, SCL %SCL%)",
      "TT wifi ok",
      "TT post 200 probes=1",
    ],
  },
  {
    id: "blink", needs: [], name: "Blink and heartbeat", level: "Starter", mins: 5, tags: ["no-parts"],
    sum: "Toggle the LED on GPIO 2 and print a tick every second. The first thing to flash on any new board.",
    pins: ["2"], libs: [], baud: 115200,
    parts: [[1, "ESP32 dev board", BOM.esp32DevKit], [1, "LED and 220 Ω resistor, only if your board has no LED on GPIO 2"]],
    wiring: [["LED anode, through 220 Ω", "GPIO 2", "Skip if your board has an onboard LED"], ["LED cathode", "GND", ""]],
    code: R`const int LED = 2;

void setup() {
  Serial.begin(115200);
  pinMode(LED, OUTPUT);
}

void loop() {
  digitalWrite(LED, HIGH);
  delay(500);
  digitalWrite(LED, LOW);
  delay(500);
  Serial.printf("tick %lu ms\n", millis());
}`,
    sample: ["ets Jul 29 2019 12:21:46", "rst:0x1 (POWERON_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)", "tick 1000 ms", "tick 2000 ms", "tick 3000 ms", "tick 4000 ms"]
  },
  {
    id: "wifi-scan", needs: [], name: "Wi-Fi scanner", level: "Starter", mins: 5, tags: ["no-parts", "wireless"],
    sum: "List nearby networks with signal strength and channel every ten seconds. A quick radio health check.",
    boards: ["esp32", "esp32s3", "esp32c3", "esp32s2", "esp32c6", "xiao-esp32c3", "xiao-esp32s3", "esp32-cam"],
    pins: [], libs: ["WiFi (built in)"], baud: 115200,
    parts: [[1, "ESP32 dev board", BOM.esp32DevKit]],
    wiring: [],
    code: R`#include <WiFi.h>

void setup() {
  Serial.begin(115200);
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);
}

void loop() {
  int n = WiFi.scanNetworks();
  Serial.printf("%d networks\n", n);
  for (int i = 0; i < n; i++) {
    Serial.printf("%2d  %-24s %4d dBm  ch %2d  %s\n",
      i + 1, WiFi.SSID(i).c_str(), WiFi.RSSI(i), WiFi.channel(i),
      WiFi.encryptionType(i) == WIFI_AUTH_OPEN ? "open" : "secured");
  }
  WiFi.scanDelete();
  delay(10000);
}`,
    sample: ["3 networks", " 1  workshop-2g               -48 dBm  ch  6  secured", " 2  printer-setup             -67 dBm  ch  1  open", " 3  neighbours                -81 dBm  ch 11  secured"]
  },
  {
    id: "i2c-scan", needs: [["i2c", "oled"]], name: "I2C bus scanner", level: "Starter", mins: 10, tags: ["sensors"],
    sum: "Probe every address on the I2C bus and report what answers. Run it before trusting any sensor wiring.",
    boards: ["esp32", "esp32s3", "esp32c3", "esp32s2", "esp32c6", "xiao-esp32c3", "xiao-esp32s3"],
    vars: {
      esp32: { SDA: "21", SCL: "22" },
      esp32s3: { SDA: "8", SCL: "9" },
      esp32c3: { SDA: "6", SCL: "7" },
      esp32s2: { SDA: "8", SCL: "9" },
      esp32c6: { SDA: "23", SCL: "22" },
      "xiao-esp32c3": { SDA: "6", SCL: "7" },
      "xiao-esp32s3": { SDA: "5", SCL: "6" },
    },
    pins: ["3V3", "GND", "%SDA%", "%SCL%"], libs: ["Wire (built in)"], baud: 115200,
    parts: [[1, "ESP32 dev board", BOM.esp32DevKit], [1, "Any I2C device"], [4, "Jumper wires"]],
    wiring: [["Device VCC", "3V3", ""], ["Device GND", "GND", ""], ["Device SDA", "GPIO %SDA%", ""], ["Device SCL", "GPIO %SCL%", ""]],
    code: R`#include <Wire.h>

void setup() {
  Serial.begin(115200);
  Wire.begin(%SDA%, %SCL%);
}

void loop() {
  int found = 0;
  for (uint8_t addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.printf("Device at 0x%02X\n", addr);
      found++;
    }
  }
  Serial.printf("%d device(s) found\n\n", found);
  delay(5000);
}`,
    sample: ["Device at 0x3C", "Device at 0x76", "2 device(s) found", ""]
  },
  {
    id: "dht22", needs: [["dht22"]], name: "DHT22 climate logger", level: "Starter", mins: 15, tags: ["sensors"],
    sum: "Read temperature and humidity every two seconds and print them as a log line.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    pins: ["3V3", "GND", "4"], libs: ["DHT sensor library (Adafruit)", "Adafruit Unified Sensor"], baud: 115200,
    parts: [[1, "ESP32 dev board", BOM.esp32DevKit], [1, "DHT22 (AM2302) sensor"], [1, "10 kΩ resistor, only for a bare sensor without a breakout"], [3, "Jumper wires"]],
    wiring: [
      ["DHT22 VCC", "3V3", ""],
      ["DHT22 DATA", "GPIO 4", ""],
      ["DHT22 GND", "GND", ""],
      ["Optional: 10 kΩ pull-up resistor", "GPIO 4 to 3V3", "Only for a bare 4-pin sensor. Modules on a small board have one built in"],
    ],
    code: R`#include <DHT.h>

DHT dht(4, DHT22);

void setup() {
  Serial.begin(115200);
  dht.begin();
}

void loop() {
  delay(2000);
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  if (isnan(h) || isnan(t)) {
    Serial.println("Sensor read failed, check wiring");
    return;
  }
  Serial.printf("%.1f C  %.1f %%RH\n", t, h);
}`,
    sample: ["21.4 C  46.2 %RH", "21.4 C  46.3 %RH", "21.5 C  46.1 %RH", "Sensor read failed, check wiring", "21.5 C  46.0 %RH"]
  },
  {
    id: "oled", needs: [["oled"]], name: "SSD1306 OLED status", level: "Starter", mins: 15, tags: ["display"],
    sum: "Drive a 128 by 64 I2C OLED and show an uptime counter. The base for any small status display.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    vars: { esp32: { SDA: "21", SCL: "22" }, esp32s3: { SDA: "8", SCL: "9" }, esp32c3: { SDA: "6", SCL: "7" } },
    pins: ["3V3", "GND", "%SDA%", "%SCL%"], libs: ["Adafruit SSD1306", "Adafruit GFX Library"], baud: 115200,
    parts: [[1, "ESP32 dev board", BOM.esp32DevKit], [1, "0.96 inch SSD1306 OLED, I2C, address 0x3C"], [4, "Jumper wires"]],
    wiring: [["OLED VCC", "3V3", ""], ["OLED GND", "GND", ""], ["OLED SDA", "GPIO %SDA%", ""], ["OLED SCL", "GPIO %SCL%", ""]],
    code: R`#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

Adafruit_SSD1306 display(128, 64, &Wire, -1);

void setup() {
  Serial.begin(115200);
  Wire.begin(%SDA%, %SCL%);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("SSD1306 not found at 0x3C");
    for (;;) delay(1000);
  }
  Serial.println("Display ready");
}

void loop() {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(2);
  display.setCursor(0, 0);
  display.println("ESP32");
  display.setTextSize(1);
  display.printf("up %lu s", millis() / 1000);
  display.display();
  delay(1000);
}`,
    sample: ["Display ready"]
  },
  {
    id: "hcsr04", needs: [["hcsr04"]], name: "HC-SR04 distance", level: "Intermediate", mins: 20, tags: ["sensors"],
    sum: "Measure distance with an ultrasonic sensor. The echo pin is 5 V, so it goes through a divider.",
    pins: ["5V", "GND", "5", "18"], libs: [], baud: 115200,
    parts: [[1, "ESP32 dev board", BOM.esp32DevKit], [1, "HC-SR04 ultrasonic sensor"], [1, "1 kΩ resistor"], [1, "2 kΩ resistor"], [4, "Jumper wires"]],
    wiring: [["HC-SR04 VCC", "5V", ""], ["HC-SR04 GND", "GND", ""], ["HC-SR04 TRIG", "GPIO 5", ""], ["HC-SR04 ECHO, through 1 kΩ", "GPIO 18", "The divider's top resistor"], ["2 kΩ resistor", "GPIO 18 to GND", "The divider's bottom resistor: drops the 5 V echo to 3.3 V"]],
    code: R`const int TRIG = 5;
const int ECHO = 18;

void setup() {
  Serial.begin(115200);
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
}

void loop() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);

  unsigned long us = pulseIn(ECHO, HIGH, 30000);
  if (us == 0) {
    Serial.println("No echo");
  } else {
    Serial.printf("%.1f cm\n", us * 0.0343 / 2);
  }
  delay(500);
}`,
    sample: ["34.2 cm", "34.1 cm", "33.8 cm", "No echo", "12.6 cm"]
  },
  {
    id: "deep-sleep", needs: [["button"]], name: "Deep sleep, button wake", level: "Intermediate", mins: 20, tags: ["logging"],
    sum: "Sleep at microamp current and wake on a button press. A boot counter survives in RTC memory.",
    pins: ["3V3", "GND", "33"], libs: [], baud: 115200,
    parts: [[1, "ESP32 dev board", BOM.esp32DevKit], [1, "Push button"], [1, "10 kΩ resistor"], [3, "Jumper wires"]],
    wiring: [["Button, side A", "3V3", ""], ["Button, side B", "GPIO 33", "RTC pin, so it can wake the chip"], ["10 kΩ pull-down", "GPIO 33 to GND", "Holds the pin low while the button is open"]],
    code: R`RTC_DATA_ATTR int boots = 0;

void setup() {
  Serial.begin(115200);
  delay(200);
  boots++;
  Serial.printf("Boot %d, wake cause %d\n", boots, (int)esp_sleep_get_wakeup_cause());

  esp_sleep_enable_ext0_wakeup(GPIO_NUM_33, 1);
  Serial.println("Sleeping. Press the button to wake.");
  Serial.flush();
  esp_deep_sleep_start();
}

void loop() {}`,
    sample: ["rst:0x1 (POWERON_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)", "Boot 1, wake cause 0", "Sleeping. Press the button to wake.", "rst:0x5 (DEEPSLEEP_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)", "Boot 2, wake cause 2", "Sleeping. Press the button to wake."]
  },
  {
    id: "web-led", needs: [], name: "Web page LED switch", level: "Intermediate", mins: 20, tags: ["no-parts", "wireless"],
    sum: "Join your Wi-Fi, serve a one-button page and switch GPIO 2 from any phone on the network.",
    pins: ["2"], libs: ["WiFi (built in)", "WebServer (built in)"], baud: 115200,
    parts: [[1, "ESP32 dev board", BOM.esp32DevKit], [1, "LED and 220 Ω resistor, only if your board has no LED on GPIO 2"]],
    wiring: [["LED anode, through 220 Ω", "GPIO 2", "Skip if your board has an onboard LED"], ["LED cathode", "GND", ""]],
    code: R`#include <WiFi.h>
#include <WebServer.h>

const char* WIFI_NAME = "your-network";
const char* WIFI_PASS = "your-password";
const int LED = 2;
${benchSettings(["wifi_ssid", "wifi_pass"])}

WebServer server(80);
bool on = false;
String wifiName, wifiPass;

void page() {
  String h = "<!doctype html><meta name=viewport content='width=device-width'>";
  h += "<h1>LED is ";
  h += on ? "on" : "off";
  h += "</h1><a href='/toggle'>Toggle</a>";
  server.send(200, "text/html", h);
}

void setup() {
  Serial.begin(115200);
  pinMode(LED, OUTPUT);
  benchSettingsBoot();
  wifiName = benchSetting("wifi_ssid", WIFI_NAME);
  wifiPass = benchSetting("wifi_pass", WIFI_PASS);
  benchNeeds("Wi-Fi name", wifiName, "your-network", "WIFI_NAME");
  WiFi.begin(wifiName.c_str(), wifiPass.c_str());
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }
  Serial.printf("\nOpen http://%s\n", WiFi.localIP().toString().c_str());

  server.on("/", page);
  server.on("/toggle", []() {
    on = !on;
    digitalWrite(LED, on);
    server.sendHeader("Location", "/");
    server.send(303);
  });
  server.begin();
}

void loop() {
  benchSettingsPoll();
  server.handleClient();
}`,
    settings: WIFI,
    sample: ["SETTINGS\twifi_ssid=set\twifi_pass=set", ".......", "Open http://192.168.1.57"]
  },
  {
    id: "touch-piano", needs: [], name: "Touch piano", level: "Starter", mins: 10, tags: ["no-parts", "sensors", "input"],
    sum: "Turn four bare wires into touch keys. Each touch prints a note, and an optional buzzer plays it.",
    boards: ["esp32", "esp32s3"],
    vars: {
      esp32: { PA: "4", PB: "13", PC: "14", PD: "27", BUZZ: "25", BA: "71", BB: "68", TV: "18" },
      esp32s3: { PA: "4", PB: "5", PC: "6", PD: "7", BUZZ: "15", BA: "21843", BB: "22410", TV: "38210" },
    },
    pins: ["%PA%", "%PB%", "%PC%", "%PD%", "%BUZZ%", "GND"], libs: [], baud: 115200,
    parts: [
      [1, "ESP32 or ESP32-S3 dev board", BOM.esp32DevKit],
      [4, "Jumper wires, or foil, coins or fruit as keys"],
      [1, "Optional passive buzzer"],
    ],
    wiring: [
      ["Key 1", "GPIO %PA%", "Any conductive pad. Bare wire is enough"],
      ["Key 2", "GPIO %PB%", ""],
      ["Key 3", "GPIO %PC%", ""],
      ["Key 4", "GPIO %PD%", ""],
      ["Buzzer +", "GPIO %BUZZ%", "Optional. A passive buzzer, not an active one"],
      ["Buzzer -", "GND", ""],
    ],
    code: R`// Four touch keys. Touch pins sense a finger through the wire, no parts needed.
const int KEYS[] = {%PA%, %PB%, %PC%, %PD%};
const char* NOTES[] = {"C4", "E4", "G4", "C5"};
const int FREQ[] = {262, 330, 392, 523};
const int BUZZER = %BUZZ%;  // optional passive buzzer

uint32_t baseline[4];
bool down[4];
int playing = -1;

bool touched(int i, uint32_t v) {
#if CONFIG_IDF_TARGET_ESP32
  return v < baseline[i] * 7 / 10;   // classic ESP32: the reading drops when touched
#else
  return v > baseline[i] * 13 / 10;  // ESP32-S3: the reading rises when touched
#endif
}

void setup() {
  Serial.begin(115200);
  delay(500);
  // Average a few readings with nobody touching the keys.
  for (int i = 0; i < 4; i++) {
    uint32_t sum = 0;
    for (int k = 0; k < 16; k++) {
      sum += touchRead(KEYS[i]);
      delay(5);
    }
    baseline[i] = sum / 16;
    Serial.printf("key %d on GPIO %d: baseline %lu\n", i + 1, KEYS[i], (unsigned long)baseline[i]);
  }
  Serial.println("Touch a key");
}

void loop() {
  int now = -1;
  for (int i = 0; i < 4; i++) {
    uint32_t v = touchRead(KEYS[i]);
    bool on = touched(i, v);
    if (on && !down[i]) Serial.printf("key %d down  %s  (reading %lu)\n", i + 1, NOTES[i], (unsigned long)v);
    if (!on && down[i]) Serial.printf("key %d up\n", i + 1);
    down[i] = on;
    if (on && now < 0) now = i;
  }
  if (now != playing) {
    if (now >= 0) tone(BUZZER, FREQ[now]);
    else noTone(BUZZER);
    playing = now;
  }
  delay(20);
}`,
    open: ["Not tested on hardware yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    notes: [
      "The ESP32-C3 has no touch sensor, so this project is for the classic ESP32 and the S3 only.",
      "Readings go the opposite way on the two chips: on the classic ESP32 they fall when touched, on the S3 they rise. The sketch handles both.",
      "Keep your hands off the keys while the board starts. The first half second sets the untouched baseline.",
      "Readings shift with humidity, wire length and whether the board is on USB or a battery. If keys trigger by themselves, press EN to take a new baseline.",
    ],
    sample: [
      "key 1 on GPIO %PA%: baseline %BA%",
      "key 2 on GPIO %PB%: baseline %BB%",
      "key 3 on GPIO %PC%: baseline %BA%",
      "key 4 on GPIO %PD%: baseline %BB%",
      "Touch a key",
      "key 1 down  C4  (reading %TV%)",
      "key 1 up",
      "key 3 down  G4  (reading %TV%)",
      "key 3 up",
    ],
  },
  {
    id: "esp-now", needs: [], name: "ESP-NOW pair", level: "Intermediate", mins: 20, tags: ["no-parts", "wireless"],
    sum: "Two boards talk directly over the Wi-Fi radio, with no router. Each sends a counter and prints what the other sends.",
    boards: ["esp32", "esp32s3", "esp32c3", "esp32s2", "esp32c6", "xiao-esp32c3", "xiao-esp32s3"],
    pins: [], libs: ["WiFi (built in)", "esp_now (built in)"], baud: 115200,
    parts: [
      [2, "ESP32 boards, any mix of the boards listed above", BOM.esp32DevKit],
      [2, "USB cables, or one cable and a USB power supply"],
    ],
    wiring: [],
    code: R`#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>

const char NAME = 'A';  // set to 'B' before flashing the second board
const int CHANNEL = 1;  // both boards must use the same channel
const uint8_t BROADCAST[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

struct Message {
  char from;
  uint32_t count;
};

uint32_t count = 0;

void onReceive(const esp_now_recv_info_t* info, const uint8_t* data, int len) {
  if (len != sizeof(Message)) return;
  Message m;
  memcpy(&m, data, sizeof m);
  if (m.from == NAME) return;
  const uint8_t* a = info->src_addr;
  Serial.printf("rx %c #%lu from %02X:%02X:%02X:%02X:%02X:%02X rssi %d\n",
    m.from, (unsigned long)m.count, a[0], a[1], a[2], a[3], a[4], a[5], info->rx_ctrl->rssi);
}

void setup() {
  Serial.begin(115200);
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  esp_wifi_set_channel(CHANNEL, WIFI_SECOND_CHAN_NONE);

  if (esp_now_init() != ESP_OK) {
    Serial.println("esp-now init failed");
    for (;;) delay(1000);
  }
  esp_now_register_recv_cb(onReceive);

  // Broadcast, so neither board needs the other's MAC address.
  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, BROADCAST, 6);
  peer.channel = CHANNEL;
  peer.ifidx = WIFI_IF_STA;
  peer.encrypt = false;
  esp_now_add_peer(&peer);

  Serial.printf("esp-now ready on channel %d, this board is %c, MAC %s\n", CHANNEL, NAME, WiFi.macAddress().c_str());
}

void loop() {
  Message m = {NAME, ++count};
  esp_err_t r = esp_now_send(BROADCAST, (const uint8_t*)&m, sizeof m);
  Serial.printf("tx %c #%lu %s\n", NAME, (unsigned long)m.count, r == ESP_OK ? "sent" : esp_err_to_name(r));
  delay(2000);
}`,
    open: ["Not tested on hardware yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    notes: [
      "Flash the same sketch to both boards, but change NAME to 'B' on the second one.",
      "Watch both sides at once: on the Bench page, choose Add a second board and connect one board to each monitor.",
      "Broadcasts are not acknowledged, so 'sent' only means the radio queued the message. Seeing it arrive on the other board is the real test.",
      "Both boards must be on the same channel. A board that also joins a Wi-Fi network moves to that network's channel, so set CHANNEL to match it.",
      "Messages are not encrypted. Do not send anything private this way.",
    ],
    sample: [
      "esp-now ready on channel 1, this board is A, MAC 24:6F:28:AA:10:3C",
      "tx A #1 sent",
      "rx B #1 from 7C:DF:A1:0B:22:E4 rssi -38",
      "tx A #2 sent",
      "rx B #2 from 7C:DF:A1:0B:22:E4 rssi -41",
      "tx A #3 sent",
      "rx B #3 from 7C:DF:A1:0B:22:E4 rssi -39",
    ],
  },
  {
    id: "neopixel", needs: [["neopixel"]], name: "NeoPixel effects", level: "Starter", mins: 15, tags: ["lights"],
    sum: "Drive a strip or stick of WS2812 LEDs through a color wipe, a rainbow and a theater chase.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    vars: { esp32: { PIX: "16" }, esp32s3: { PIX: "5" }, esp32c3: { PIX: "4" } },
    pins: ["5V", "GND", "%PIX%"], libs: ["Adafruit NeoPixel"], baud: 115200,
    parts: [
      [1, "ESP32 dev board", BOM.esp32DevKit],
      [1, "NeoPixel Stick, 8 LEDs, or any WS2812B strip", BOM.neopixelStick],
      [1, "330 Ω resistor"],
      [1, "Optional 74AHCT125 level shifter", BOM.levelShifter],
      [3, "Jumper wires"],
    ],
    wiring: [
      ["Strip 5V or VDC", "5V", "Fine for a few LEDs. A long strip needs its own 5 V supply"],
      ["Strip GND", "GND", "Join the grounds if the strip has its own supply"],
      ["Strip DIN, through 330 Ω", "GPIO %PIX%", "The resistor goes next to the strip"],
    ],
    code: R`#include <Adafruit_NeoPixel.h>

const int PIN = %PIX%;
const int COUNT = 8;  // LEDs on your strip or stick

Adafruit_NeoPixel strip(COUNT, PIN, NEO_GRB + NEO_KHZ800);

void wipe(uint32_t color) {
  for (int i = 0; i < COUNT; i++) {
    strip.setPixelColor(i, color);
    strip.show();
    delay(60);
  }
}

void rainbow(unsigned long ms) {
  unsigned long start = millis();
  uint16_t hue = 0;
  while (millis() - start < ms) {
    for (int i = 0; i < COUNT; i++) {
      strip.setPixelColor(i, strip.gamma32(strip.ColorHSV(hue + i * 65536L / COUNT)));
    }
    strip.show();
    hue += 256;
    delay(20);
  }
}

void chase(uint32_t color, unsigned long ms) {
  unsigned long start = millis();
  int step = 0;
  while (millis() - start < ms) {
    strip.clear();
    for (int i = step % 3; i < COUNT; i += 3) strip.setPixelColor(i, color);
    strip.show();
    step++;
    delay(120);
  }
}

void setup() {
  Serial.begin(115200);
  strip.begin();
  strip.setBrightness(40);  // about 15 %: easy on the eyes and on USB power
  strip.show();
  Serial.printf("%d LEDs on GPIO %d\n", COUNT, PIN);
}

void loop() {
  Serial.println("effect: color wipe");
  wipe(strip.Color(255, 0, 0));
  wipe(strip.Color(0, 255, 0));
  wipe(strip.Color(0, 0, 255));
  Serial.println("effect: rainbow");
  rainbow(5000);
  Serial.println("effect: theater chase");
  chase(strip.Color(255, 160, 0), 4000);
}`,
    open: ["Not tested on hardware yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    notes: [
      "Each LED can draw about 60 mA at full white. Eight LEDs at the sketch's brightness are fine on USB. A metre or more needs its own 5 V supply and a 1000 µF capacitor across it.",
      "WS2812B LEDs on 5 V expect a data signal near 5 V. Most accept the ESP32's 3.3 V anyway. If the first LED flickers or stays dark, put a 74AHCT125 level shifter in the data line.",
      "No strip yet? The S3 and C3 DevKits have one WS2812 LED on the board: GPIO 38 (or 48 on the first S3 revision) and GPIO 8 on the C3. Set PIN to that and COUNT to 1.",
      "Use a current release of Adafruit NeoPixel. Old releases do not build on the 3.x Arduino core.",
    ],
    sample: ["8 LEDs on GPIO %PIX%", "effect: color wipe", "effect: rainbow", "effect: theater chase", "effect: color wipe"],
  },
  {
    id: "mqtt-ha", needs: [["ds18b20"]], name: "Home Assistant temperature", level: "Intermediate", mins: 30, tags: ["sensors", "wireless"],
    sum: "Publish a DS18B20 reading over MQTT every 30 seconds. Home Assistant finds the sensor by itself through MQTT discovery.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    pins: ["3V3", "GND", "4"], libs: ["PubSubClient (Nick O'Leary)", "OneWire", "DallasTemperature", "WiFi (built in)"], baud: 115200,
    parts: [
      [1, "ESP32 dev board", BOM.esp32DevKit],
      [1, "DS18B20 waterproof probe", BOM.ds18b20],
      [1, "4.7 kΩ resistor, pull-up for the data line", BOM.resistor4k7],
      [1, "An MQTT broker, such as the Mosquitto add-on in Home Assistant"],
    ],
    wiring: [
      ["DS18B20 VDD (red)", "3V3", ""],
      ["DS18B20 GND (black)", "GND", ""],
      ["DS18B20 DATA (yellow)", "GPIO 4", ""],
      ["4.7 kΩ pull-up resistor", "GPIO 4 to 3V3", "Holds the data line high"],
    ],
    code: R`#include <WiFi.h>
#include <PubSubClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>

const char* WIFI_NAME = "your-network";
const char* WIFI_PASS = "your-password";
const char* MQTT_HOST = "192.168.1.10";  // your broker, often the Home Assistant machine
const int MQTT_PORT = 1883;
const char* MQTT_USER = "";  // leave empty if the broker allows anonymous clients
const char* MQTT_PASS = "";
${benchSettings(["wifi_ssid", "wifi_pass", "mqtt_host", "mqtt_port", "mqtt_user", "mqtt_pass"])}

String wifiName, wifiPass, mqttHost, mqttUser, mqttPass;
int mqttPort = MQTT_PORT;
OneWire oneWire(4);
DallasTemperature probes(&oneWire);
WiFiClient net;
PubSubClient mqtt(net);

String id, stateTopic, statusTopic;
unsigned long lastSend = 0;

// Tell Home Assistant about the sensor. Retained, so it survives a restart.
void announce() {
  String config = String("{\"name\":\"Temperature\",\"device_class\":\"temperature\",")
    + "\"state_class\":\"measurement\",\"unit_of_measurement\":\"°C\","
    + "\"state_topic\":\"" + stateTopic + "\","
    + "\"availability_topic\":\"" + statusTopic + "\","
    + "\"unique_id\":\"" + id + "_temperature\","
    + "\"device\":{\"identifiers\":[\"" + id + "\"],\"name\":\"ESP32 Bench " + id + "\"}}";
  String topic = String("homeassistant/sensor/") + id + "/temperature/config";
  mqtt.publish(topic.c_str(), config.c_str(), true);
}

void connectMqtt() {
  const char* user = mqttUser.length() > 0 ? mqttUser.c_str() : nullptr;
  const char* pass = mqttPass.length() > 0 ? mqttPass.c_str() : nullptr;
  while (!mqtt.connected()) {
    benchSettingsPoll();
    Serial.printf("mqtt connecting to %s\n", mqttHost.c_str());
    // The last will marks the sensor unavailable if the board drops off.
    if (mqtt.connect(id.c_str(), user, pass, statusTopic.c_str(), 1, true, "offline")) {
      mqtt.publish(statusTopic.c_str(), "online", true);
      announce();
      Serial.printf("mqtt ok as %s, discovery sent\n", id.c_str());
    } else {
      Serial.printf("mqtt failed, state %d, retry in 5 s\n", mqtt.state());
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  probes.begin();
  benchSettingsBoot();
  wifiName = benchSetting("wifi_ssid", WIFI_NAME);
  wifiPass = benchSetting("wifi_pass", WIFI_PASS);
  mqttHost = benchSetting("mqtt_host", MQTT_HOST);
  mqttPort = benchSetting("mqtt_port", String(MQTT_PORT).c_str()).toInt();
  mqttUser = benchSetting("mqtt_user", MQTT_USER);
  mqttPass = benchSetting("mqtt_pass", MQTT_PASS);
  benchNeeds("Wi-Fi name", wifiName, "your-network", "WIFI_NAME");
  benchNeeds("MQTT broker", mqttHost, "", "MQTT_HOST");

  Serial.printf("wifi joining %s\n", wifiName.c_str());
  WiFi.mode(WIFI_STA);
  WiFi.begin(wifiName.c_str(), wifiPass.c_str());
  while (WiFi.status() != WL_CONNECTED) delay(300);
  Serial.printf("wifi ok %s\n", WiFi.localIP().toString().c_str());

  String mac = WiFi.macAddress();
  mac.replace(":", "");
  mac.toLowerCase();
  id = String("esp32bench-") + mac.substring(6);
  stateTopic = String("esp32bench/") + id + "/temperature";
  statusTopic = String("esp32bench/") + id + "/status";

  mqtt.setServer(mqttHost.c_str(), mqttPort);
  mqtt.setBufferSize(512);  // the discovery message is longer than the 256-byte default
}

void loop() {
  benchSettingsPoll();
  if (!mqtt.connected()) connectMqtt();
  mqtt.loop();

  if (lastSend != 0 && millis() - lastSend < 30000) return;
  lastSend = millis();

  probes.requestTemperatures();
  float c = probes.getTempCByIndex(0);
  if (c == DEVICE_DISCONNECTED_C) {
    Serial.println("no probe: check the data wire and the 4.7 kOhm pull-up");
    return;
  }
  char value[16];
  snprintf(value, sizeof value, "%.2f", c);
  mqtt.publish(stateTopic.c_str(), value);
  Serial.printf("%s %s\n", stateTopic.c_str(), value);
}`,
    open: ["Not tested on hardware or with Home Assistant yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    notes: [
      "Home Assistant needs the MQTT integration set up and pointed at the same broker. The sensor then appears under Settings, Devices and services, MQTT.",
      "mqtt failed, state -2 means the broker could not be reached: check MQTT_HOST and that port 1883 is open. State 4 or 5 means the user name or password was refused.",
      "The sketch raises PubSubClient's buffer to 512 bytes. With the default 256 the discovery message is silently dropped and nothing appears in Home Assistant.",
      "The device id comes from the board's MAC address, so each board shows up as its own device.",
    ],
    settings: [
      ...WIFI,
      { key: "mqtt_host", label: "MQTT broker address", kind: "text", hint: "Often the Home Assistant machine, e.g. 192.168.1.10.", required: true },
      { key: "mqtt_port", label: "MQTT port", kind: "number", hint: "1883 unless you changed it." },
      { key: "mqtt_user", label: "MQTT user name", kind: "text", hint: "Leave empty for a broker that allows anonymous clients." },
      { key: "mqtt_pass", label: "MQTT password", kind: "password" },
    ],
    sample: [
      "wifi joining your-network",
      "wifi ok 192.168.1.64",
      "mqtt connecting to 192.168.1.10",
      "mqtt ok as esp32bench-aa103c, discovery sent",
      "esp32bench/esp32bench-aa103c/temperature 21.44",
      "esp32bench/esp32bench-aa103c/temperature 21.50",
      "esp32bench/esp32bench-aa103c/temperature 21.56",
    ],
  },
  {
    id: "ble-scan", needs: [], name: "Bluetooth LE scanner", level: "Starter", mins: 5, tags: ["no-parts", "wireless"],
    sum: "List nearby Bluetooth LE devices with their signal strength every ten seconds: phones, watches, beacons and sensors.",
    boards: ["esp32", "esp32s3", "esp32c3", "esp32c6", "xiao-esp32c3", "xiao-esp32s3"],
    pins: [], libs: ["BLE (built in)"], baud: 115200,
    parts: [[1, "ESP32 dev board", BOM.esp32DevKit]],
    wiring: [],
    code: R`#include <BLEDevice.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>

BLEScan* scan;

void setup() {
  Serial.begin(115200);
  BLEDevice::init("");
  scan = BLEDevice::getScan();
  scan->setActiveScan(true);  // ask devices for their names
  scan->setInterval(100);
  scan->setWindow(99);
}

void loop() {
  BLEScanResults* found = scan->start(5, false);  // scan for five seconds
  int n = found->getCount();
  Serial.printf("%d devices\n", n);
  for (int i = 0; i < n; i++) {
    BLEAdvertisedDevice d = found->getDevice(i);
    Serial.printf("%s  %4d dBm  %s\n", d.getAddress().toString().c_str(), d.getRSSI(),
      d.haveName() ? d.getName().c_str() : "(no name)");
  }
  scan->clearResults();
  delay(5000);
}`,
    open: ["Not tested on hardware yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    notes: [
      "Written for the 3.x Arduino core, where start() returns a pointer. On the older 2.x core, use BLEScanResults found = scan->start(5, false) and found.getCount() instead.",
      "The Bluetooth stack is large. If the classic ESP32 build says the sketch is too big, pick Tools, Partition Scheme, Huge APP.",
      "Phones and watches change their address every few minutes for privacy, so the same phone can appear more than once.",
      "The S3, C3 and C6 only have Bluetooth LE. The classic ESP32 also has Classic Bluetooth, which this sketch does not scan. The ESP32-S2 has no Bluetooth at all.",
    ],
    sample: [
      "6 devices",
      "a4:c1:38:2f:91:0e   -58 dBm  ATC_2F910E",
      "5c:e7:62:11:a0:3b   -64 dBm  (no name)",
      "f0:9e:9e:4a:22:17   -71 dBm  Galaxy Watch5 (2C1B)",
      "d8:3a:dd:05:6e:90   -77 dBm  (no name)",
      "c4:7c:8d:6a:31:5f   -82 dBm  Flower care",
      "4e:91:0b:7f:c2:a8   -89 dBm  (no name)",
    ],
  },
  {
    id: "ota", needs: [], name: "Over-the-air updates", level: "Intermediate", mins: 15, tags: ["no-parts", "wireless"],
    sum: "Upload new firmware over Wi-Fi with ArduinoOTA, so a board in a box on the shelf never needs a USB cable again.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    pins: [], libs: ["WiFi (built in)", "ArduinoOTA (built in)", "ESPmDNS (built in)"], baud: 115200,
    parts: [[1, "ESP32 dev board", BOM.esp32DevKit], [1, "USB cable for the first upload"]],
    wiring: [],
    code: R`#include <WiFi.h>
#include <ESPmDNS.h>
#include <ArduinoOTA.h>

const char* WIFI_NAME = "your-network";
const char* WIFI_PASS = "your-password";
const char* OTA_NAME = "esp32-bench";  // the board appears as esp32-bench.local
const char* OTA_PASS = "change-me";    // asked for on every network upload
${benchSettings(["wifi_ssid", "wifi_pass", "ota_name", "ota_pass"])}

String wifiName, wifiPass, otaName, otaPass;
unsigned long lastBeat = 0;

void setup() {
  Serial.begin(115200);
  benchSettingsBoot();
  wifiName = benchSetting("wifi_ssid", WIFI_NAME);
  wifiPass = benchSetting("wifi_pass", WIFI_PASS);
  otaName = benchSetting("ota_name", OTA_NAME);
  otaPass = benchSetting("ota_pass", OTA_PASS);
  benchNeeds("Wi-Fi name", wifiName, "your-network", "WIFI_NAME");
  WiFi.mode(WIFI_STA);
  WiFi.begin(wifiName.c_str(), wifiPass.c_str());
  Serial.printf("wifi joining %s\n", wifiName.c_str());
  while (WiFi.waitForConnectResult() != WL_CONNECTED) {
    Serial.println("wifi failed, retrying in 5 s");
    delay(5000);
    benchSettingsPoll();
    WiFi.begin(wifiName.c_str(), wifiPass.c_str());
  }

  ArduinoOTA.setHostname(otaName.c_str());
  ArduinoOTA.setPassword(otaPass.c_str());
  ArduinoOTA
    .onStart([]() { Serial.printf("ota start: %s\n", ArduinoOTA.getCommand() == U_FLASH ? "sketch" : "filesystem"); })
    .onProgress([](unsigned int done, unsigned int total) { Serial.printf("ota %u percent\r", done * 100 / total); })
    .onEnd([]() { Serial.println("\nota done, restarting"); })
    .onError([](ota_error_t error) { Serial.printf("ota error %u\n", error); });
  ArduinoOTA.begin();
  Serial.printf("ota ready: %s.local at %s\n", otaName.c_str(), WiFi.localIP().toString().c_str());
}

void loop() {
  benchSettingsPoll();
  ArduinoOTA.handle();  // call often: uploads only happen while this runs

  if (millis() - lastBeat > 10000) {
    lastBeat = millis();
    Serial.printf("up %lu s, rssi %d dBm\n", millis() / 1000, WiFi.RSSI());
  }
}`,
    open: ["Not tested on hardware yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    notes: [
      "The first upload has to go over USB. After that, the board shows up as a network port named esp32-bench in the Arduino IDE's port list, and Upload sends the sketch over Wi-Fi.",
      "Every sketch you upload over the air must include the OTA code too. Leave it out and the next update needs a USB cable again.",
      "Network uploads need a partition scheme with two app slots, such as the default. Huge APP and No OTA have only one slot and cannot take an update.",
      "Your computer and the board must be on the same network, and some guest or mesh networks block the mDNS lookups the IDE uses to find the board.",
      "In PlatformIO, set upload_protocol = espota, upload_port = esp32-bench.local and upload_flags = --auth=change-me.",
      "To update from a browser instead, the core's HTTPUpdateServer example serves an upload page for the compiled .bin file.",
    ],
    settings: [
      ...WIFI,
      { key: "ota_name", label: "Board name", kind: "text", hint: "The board appears as <name>.local on your network." },
      { key: "ota_pass", label: "OTA password", kind: "password", hint: "Asked for on every network upload." },
    ],
    sample: [
      "wifi joining your-network",
      "ota ready: esp32-bench.local at 192.168.1.71",
      "up 10 s, rssi -54 dBm",
      "ota start: sketch",
      "ota 100 percent",
      "ota done, restarting",
    ],
  },
  {
    id: "battery-sensor", needs: [["ds18b20"]], name: "Battery deep-sleep sensor", level: "Intermediate", mins: 30, tags: ["logging", "sensors"],
    sum: "Wake every five minutes, read a DS18B20 and the battery voltage, then go back to deep sleep. A boot counter survives in RTC memory.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    vars: { esp32: { BAT: "35" }, esp32s3: { BAT: "7" }, esp32c3: { BAT: "3" } },
    pins: ["3V3", "GND", "4", "%BAT%"], libs: ["OneWire", "DallasTemperature"], baud: 115200,
    parts: [
      [1, "ESP32 dev board", BOM.esp32DevKit],
      [1, "DS18B20 waterproof probe", BOM.ds18b20],
      [1, "4.7 kΩ resistor, pull-up for the probe data line", BOM.resistor4k7],
      [2, "100 kΩ resistors, battery divider", BOM.resistor100k],
      [1, "Single-cell Li-ion or LiPo battery with protection, and a way to get 3.3 V from it"],
    ],
    wiring: [
      ["DS18B20 VDD (red)", "3V3", ""],
      ["DS18B20 GND (black)", "GND", ""],
      ["DS18B20 DATA (yellow)", "GPIO 4", ""],
      ["4.7 kΩ pull-up resistor", "GPIO 4 to 3V3", "Holds the data line high"],
      ["Battery + through 100 kΩ", "GPIO %BAT%", "Divider top. Never connect the battery straight to a GPIO"],
      ["100 kΩ from GPIO %BAT%", "GND", "Divider bottom: the pin sees half the battery voltage"],
    ],
    code: R`#include <OneWire.h>
#include <DallasTemperature.h>

const int PROBE_PIN = 4;
const int BAT_PIN = %BAT%;       // ADC1 pin at the middle of a 100k/100k divider
const uint64_t SLEEP_MINUTES = 5;

// RTC memory keeps these through deep sleep. Losing power or flashing clears them.
RTC_DATA_ATTR uint32_t boots = 0;
RTC_DATA_ATTR float lastC = NAN;

OneWire oneWire(PROBE_PIN);
DallasTemperature probes(&oneWire);

void setup() {
  Serial.begin(115200);
  boots++;
  bool timer = esp_sleep_get_wakeup_cause() == ESP_SLEEP_WAKEUP_TIMER;
  Serial.printf("boot %lu, woke by %s\n", (unsigned long)boots, timer ? "timer" : "power-on or reset");

  probes.begin();
  probes.requestTemperatures();  // about 750 ms at full resolution
  float c = probes.getTempCByIndex(0);
  if (c == DEVICE_DISCONNECTED_C) {
    Serial.println("no probe: check the data wire and the 4.7 kOhm pull-up");
  } else {
    Serial.printf("temp %.2f C, last time %.2f C\n", c, lastC);
    lastC = c;
  }

  uint32_t mv = 0;
  for (int i = 0; i < 8; i++) mv += analogReadMilliVolts(BAT_PIN);
  float battery = mv / 8.0f * 2.0f / 1000.0f;  // the divider halves the voltage
  Serial.printf("battery %.2f V\n", battery);

  Serial.printf("awake %lu ms, sleeping %llu min\n", millis(), (unsigned long long)SLEEP_MINUTES);
  Serial.flush();
  esp_sleep_enable_timer_wakeup(SLEEP_MINUTES * 60ULL * 1000000ULL);
  esp_deep_sleep_start();
}

void loop() {}  // never reached: every wake starts again at setup()`,
    open: ["Not tested on hardware yet, and no current draw has been measured. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    notes: [
      "A dev board is the wrong thing to run from a battery. Its voltage regulator, USB serial chip and power LED keep drawing current in deep sleep, typically milliamps rather than the microamps the chip itself needs. Measure your own board with a meter in series with the battery before trusting a battery-life estimate.",
      "Espressif's datasheets put the chip alone at around 5 to 10 µA in deep sleep with the RTC timer running, depending on the chip. Getting near that needs a board built for low power, or a bare module with a low-quiescent regulator.",
      "A full Li-ion cell is 4.2 V, too high for the 3V3 pin. Use a board with a battery connector, or a low-dropout 3.3 V regulator with a small quiescent current. The 5V pin's regulator on most dev boards drops too much voltage to run from one cell for long.",
      "The 100k/100k divider draws about 20 µA from the battery all the time. For long battery life, switch it with a MOSFET or use larger resistors with a 100 nF capacitor from the pin to GND.",
      "The battery pin must be an ADC1 pin: ADC2 cannot be read while Wi-Fi is on, which matters as soon as you add a Wi-Fi upload.",
      "On the S3 and C3 with the native USB port, the serial port disappears during deep sleep and the bench loses the connection on every sleep. Use the UART USB port, or reconnect after each wake.",
    ],
    sample: [
      "boot 1, woke by power-on or reset",
      "temp 21.44 C, last time nan C",
      "battery 4.08 V",
      "awake 842 ms, sleeping 5 min",
      "boot 2, woke by timer",
      "temp 21.50 C, last time 21.44 C",
      "battery 4.07 V",
      "awake 838 ms, sleeping 5 min",
    ],
  },
  {
    id: "relay-servo", needs: [["servo", "relay"]], name: "Relay and servo control", level: "Starter", mins: 20, tags: ["motion"],
    sum: "Move a hobby servo to any angle and switch a relay module on and off by typing commands on the bench.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    vars: {
      esp32: { SERVO: "18", RELAY: "26" },
      esp32s3: { SERVO: "5", RELAY: "6" },
      esp32c3: { SERVO: "4", RELAY: "5" },
    },
    pins: ["5V", "GND", "%SERVO%", "%RELAY%"], libs: ["ESP32Servo"], baud: 115200,
    parts: [
      [1, "ESP32 dev board", BOM.esp32DevKit],
      [1, "Micro servo, SG90 or SG92R class", BOM.microServo],
      [1, "Relay module, such as a 3 V-ready mini relay board", BOM.miniRelay],
      [5, "Jumper wires"],
    ],
    wiring: [
      ["Servo red (power)", "5V", "One micro servo is fine from USB. Bigger servos need their own 5 V supply"],
      ["Servo brown or black (ground)", "GND", "Join the grounds if the servo has its own supply"],
      ["Servo orange or yellow (signal)", "GPIO %SERVO%", "3.3 V signals work with most hobby servos"],
      ["Relay module VCC", "5V or 3V3", "Whatever the module is made for. Check its label"],
      ["Relay module GND", "GND", ""],
      ["Relay module IN or SIG", "GPIO %RELAY%", "Many blue modules switch on when IN is low: set RELAY_ACTIVE_LOW"],
    ],
    code: R`#include <ESP32Servo.h>

const int SERVO_PIN = %SERVO%;
const int RELAY_PIN = %RELAY%;
const bool RELAY_ACTIVE_LOW = false;  // set true if your relay clicks on when IN is low

Servo servo;
String line;

void relay(bool on) {
  digitalWrite(RELAY_PIN, on != RELAY_ACTIVE_LOW ? HIGH : LOW);
  Serial.printf("relay %s\n", on ? "on" : "off");
}

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  relay(false);

  servo.setPeriodHertz(50);
  servo.attach(SERVO_PIN, 500, 2400);  // pulse range in microseconds for SG90-class servos
  servo.write(90);
  Serial.println("ready: type angle 0 to 180, relay on or relay off");
}

void loop() {
  while (Serial.available()) {
    char ch = Serial.read();
    if (ch == '\r') continue;
    if (ch != '\n') {
      line += ch;
      continue;
    }
    line.trim();
    if (line.startsWith("angle ")) {
      int angle = constrain(line.substring(6).toInt(), 0, 180);
      servo.write(angle);
      Serial.printf("servo %d deg\n", angle);
    } else if (line == "relay on") {
      relay(true);
    } else if (line == "relay off") {
      relay(false);
    } else if (line.length() > 0) {
      Serial.printf("unknown command: %s\n", line.c_str());
    }
    line = "";
  }
}`,
    open: ["Not tested on hardware yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    notes: [
      "Type the commands into the bench's send box: angle 45, relay on, relay off. The bench sends a line ending, which ends each command.",
      "Relay modules carry the transistor and the flyback diode a relay coil needs. A bare relay on a GPIO pin will not switch and its coil's voltage spike can kill the pin: use a module, or add an NPN transistor and a diode across the coil.",
      "Many cheap blue relay modules are made for 5 V logic and switch on when IN is pulled low. Some will not switch reliably from 3.3 V; a module sold as 3 V-ready avoids the guesswork.",
      "Mains voltage can kill. Keep relay projects to low-voltage loads unless you are qualified to wire mains, and never leave mains terminals exposed.",
      "A servo that twitches or resets the board is drawing more current than USB can give. Power it separately and join the grounds.",
      "If a servo buzzes at the ends of its travel, narrow the 500 to 2400 µs pulse range in attach() until it stops.",
    ],
    sample: [
      "relay off",
      "ready: type angle 0 to 180, relay on or relay off",
      "servo 45 deg",
      "servo 135 deg",
      "relay on",
      "relay off",
    ],
  },
  {
    id: "epaper", needs: [["epaper"], ["ds18b20"]], name: "E-paper temperature card", level: "Intermediate", mins: 30, tags: ["display", "sensors"],
    sum: "Show a DS18B20 reading on a 2.9 inch e-paper panel that keeps its image with the power off, refreshing only when the value changes.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    vars: {
      esp32: { SCK: "18", MOSI: "23", CS: "5", DC: "17", RST: "16", BUSY: "25", PROBE: "4" },
      esp32s3: { SCK: "12", MOSI: "11", CS: "10", DC: "17", RST: "16", BUSY: "15", PROBE: "4" },
      esp32c3: { SCK: "4", MOSI: "6", CS: "7", DC: "10", RST: "1", BUSY: "3", PROBE: "5" },
    },
    pins: ["3V3", "GND", "%SCK%", "%MOSI%", "%CS%", "%DC%", "%RST%", "%BUSY%", "%PROBE%"],
    libs: ["GxEPD2", "Adafruit GFX Library", "OneWire", "DallasTemperature"], baud: 115200,
    parts: [
      [1, "ESP32 dev board", BOM.esp32DevKit],
      [1, "2.9 inch black and white SPI e-paper module, 296 by 128, SSD1680 driver"],
      [1, "DS18B20 waterproof probe", BOM.ds18b20],
      [1, "4.7 kΩ resistor, pull-up for the probe data line", BOM.resistor4k7],
      [10, "Jumper wires"],
    ],
    wiring: [
      ["Display VCC", "3V3", ""],
      ["Display GND", "GND", ""],
      ["Display CLK or SCK", "GPIO %SCK%", ""],
      ["Display DIN or MOSI", "GPIO %MOSI%", ""],
      ["Display CS", "GPIO %CS%", ""],
      ["Display DC", "GPIO %DC%", ""],
      ["Display RST", "GPIO %RST%", ""],
      ["Display BUSY", "GPIO %BUSY%", ""],
      ["DS18B20 VDD (red)", "3V3", ""],
      ["DS18B20 GND (black)", "GND", ""],
      ["DS18B20 DATA (yellow)", "GPIO %PROBE%", ""],
      ["4.7 kΩ pull-up resistor", "GPIO %PROBE% to 3V3", "Holds the data line high"],
    ],
    code: R`#include <SPI.h>
#include <GxEPD2_BW.h>
#include <Fonts/FreeSans9pt7b.h>
#include <Fonts/FreeSansBold24pt7b.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// Pick the class for your panel. GxEPD2_290_T94_V2 suits the common 2.9 inch SSD1680
// modules (Waveshare 2.9 inch V2 and similar). See GxEPD2's display selection list for others.
GxEPD2_BW<GxEPD2_290_T94_V2, GxEPD2_290_T94_V2::HEIGHT> display(
  GxEPD2_290_T94_V2(/*CS*/ %CS%, /*DC*/ %DC%, /*RST*/ %RST%, /*BUSY*/ %BUSY%));

OneWire oneWire(%PROBE%);
DallasTemperature probes(&oneWire);

float shown = NAN;
unsigned long lastRead = 0, lastDraw = 0;
uint32_t refreshes = 0;

void draw(float c) {
  refreshes++;
  char line[48];
  display.setRotation(1);
  display.setFullWindow();
  display.firstPage();
  do {
    display.fillScreen(GxEPD_WHITE);
    display.setTextColor(GxEPD_BLACK);
    display.setFont(&FreeSans9pt7b);
    display.setCursor(10, 24);
    display.print("ESP32 Bench");
    display.setFont(&FreeSansBold24pt7b);
    display.setCursor(10, 84);
    if (isnan(c)) {
      display.print("no probe");
    } else {
      snprintf(line, sizeof line, "%.1f C", c);
      display.print(line);
    }
    display.setFont(&FreeSans9pt7b);
    display.setCursor(10, 118);
    snprintf(line, sizeof line, "up %lu min, refresh %lu", millis() / 60000, (unsigned long)refreshes);
    display.print(line);
  } while (display.nextPage());
  display.hibernate();  // the image stays with the panel powered down
  shown = c;
  lastDraw = millis();
}

void setup() {
  Serial.begin(115200);
  SPI.begin(%SCK%, -1, %MOSI%, %CS%);  // before init, so the display uses these pins
  display.init(0, true, 2, false);  // 0: no library diagnostics on the serial port
  probes.begin();
}

void loop() {
  if (lastRead != 0 && millis() - lastRead < 30000) return;
  lastRead = millis();

  probes.requestTemperatures();
  float c = probes.getTempCByIndex(0);
  if (c == DEVICE_DISCONNECTED_C) c = NAN;
  if (isnan(c)) Serial.println("no probe: check the data wire and the 4.7 kOhm pull-up");
  else Serial.printf("temp %.2f C\n", c);

  // Full refreshes flash the panel and wear it, so only redraw on a real change,
  // at most every three minutes, or every half hour regardless.
  bool changed = isnan(c) != isnan(shown) || (!isnan(c) && fabs(c - shown) >= 0.2);
  unsigned long since = millis() - lastDraw;
  if (refreshes == 0 || (changed && since > 3 * 60000UL) || since > 30 * 60000UL) {
    draw(c);
    Serial.printf("display refreshed, %lu so far\n", (unsigned long)refreshes);
  }
}`,
    open: ["Not tested on hardware yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    notes: [
      "E-paper panels look alike but use different driver chips. If the screen stays blank or shows noise, the display class is wrong: GxEPD2's examples include a list that maps panel part numbers to classes.",
      "A full refresh takes about two seconds and flashes black and white. That is normal. Panels are rated for a limited number of refreshes, which is why the sketch only redraws when the reading moves.",
      "BUSY must be connected. Without it the library cannot tell when the panel has finished, and every refresh stalls until a timeout.",
      "Most modules have a regulator and level shifting on board and are happy on 3V3. Bare panels with a 24-pin ribbon need a driver board.",
      "The image survives power loss, so this pairs well with the battery deep-sleep sensor: draw, hibernate, sleep.",
    ],
    sample: [
      "temp 21.44 C",
      "display refreshed, 1 so far",
      "temp 21.50 C",
      "temp 21.50 C",
      "temp 21.69 C",
    ],
  },
  {
    id: "bme280-web", needs: [["i2c"]], name: "BME280 web dashboard", level: "Intermediate", mins: 25, tags: ["sensors", "wireless"],
    sum: "The board serves its own web page with live temperature, humidity and pressure and a chart that grows every two seconds.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    vars: { esp32: { SDA: "21", SCL: "22" }, esp32s3: { SDA: "8", SCL: "9" }, esp32c3: { SDA: "6", SCL: "7" } },
    pins: ["3V3", "GND", "%SDA%", "%SCL%"], libs: ["Adafruit BME280 Library", "Adafruit Unified Sensor", "WiFi (built in)", "WebServer (built in)"], baud: 115200,
    parts: [[1, "ESP32 dev board", BOM.esp32DevKit], [1, "BME280 breakout, I2C", BOM.bme280], [4, "Jumper wires"]],
    wiring: [
      ["BME280 VIN or VCC", "3V3", ""],
      ["BME280 GND", "GND", ""],
      ["BME280 SDA or SDI", "GPIO %SDA%", ""],
      ["BME280 SCL or SCK", "GPIO %SCL%", ""],
    ],
    code: R`#include <WiFi.h>
#include <WebServer.h>
#include <Wire.h>
#include <Adafruit_BME280.h>

const char* WIFI_NAME = "your-network";
const char* WIFI_PASS = "your-password";

Adafruit_BME280 bme;
WebServer server(80);
String wifiName, wifiPass;
unsigned long lastLog = 0;

const char PAGE[] = R"html(<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>BME280</title>
<style>body{font-family:sans-serif;margin:16px;background:#f2f5f1;color:#14231f}b{font-size:2em}
canvas{width:100%;height:160px;background:#fff;border:1px solid #c8d1cb}</style></head>
<body><h1>BME280</h1>
<p><b id="t">--</b> &deg;C &nbsp; <b id="h">--</b> %RH &nbsp; <b id="p">--</b> hPa</p>
<canvas id="c" width="600" height="160"></canvas><p id="s">connecting</p>
<script>
var pts = [], c = document.getElementById('c'), g = c.getContext('2d');
function draw() {
  g.clearRect(0, 0, 600, 160);
  if (pts.length < 2) return;
  var lo = Math.min.apply(null, pts) - 0.5, hi = Math.max.apply(null, pts) + 0.5;
  g.beginPath();
  pts.forEach(function (v, i) {
    var x = i * 600 / (pts.length - 1), y = 160 - (v - lo) * 160 / (hi - lo);
    if (i) g.lineTo(x, y); else g.moveTo(x, y);
  });
  g.strokeStyle = '#c0341a'; g.lineWidth = 2; g.stroke();
}
function tick() {
  fetch('/data.json').then(function (r) { return r.json(); }).then(function (d) {
    document.getElementById('t').textContent = d.t.toFixed(1);
    document.getElementById('h').textContent = d.h.toFixed(0);
    document.getElementById('p').textContent = d.p.toFixed(1);
    pts.push(d.t); if (pts.length > 150) pts.shift(); draw();
    document.getElementById('s').textContent = 'updated ' + new Date().toLocaleTimeString();
  }).catch(function () { document.getElementById('s').textContent = 'board not answering'; });
}
tick(); setInterval(tick, 2000);
</script></body></html>)html";

${benchSettings(["wifi_ssid", "wifi_pass"])}

void sendData() {
  char json[96];
  snprintf(json, sizeof json, "{\"t\":%.2f,\"h\":%.1f,\"p\":%.1f}",
           bme.readTemperature(), bme.readHumidity(), bme.readPressure() / 100.0f);
  server.send(200, "application/json", json);
}

void setup() {
  Serial.begin(115200);
  Wire.begin(%SDA%, %SCL%);
  if (!bme.begin(0x76, &Wire) && !bme.begin(0x77, &Wire)) {
    Serial.println("BME280 not found at 0x76 or 0x77: check wiring, or it may be a BMP280");
    for (;;) delay(1000);
  }

  benchSettingsBoot();
  wifiName = benchSetting("wifi_ssid", WIFI_NAME);
  wifiPass = benchSetting("wifi_pass", WIFI_PASS);
  benchNeeds("Wi-Fi name", wifiName, "your-network", "WIFI_NAME");
  WiFi.mode(WIFI_STA);
  WiFi.begin(wifiName.c_str(), wifiPass.c_str());
  Serial.printf("wifi joining %s\n", wifiName.c_str());
  while (WiFi.status() != WL_CONNECTED) delay(300);

  server.on("/", []() { server.send(200, "text/html", PAGE); });
  server.on("/data.json", sendData);
  server.begin();
  Serial.printf("dashboard at http://%s/\n", WiFi.localIP().toString().c_str());
}

void loop() {
  benchSettingsPoll();
  server.handleClient();
  if (millis() - lastLog > 10000) {
    lastLog = millis();
    Serial.printf("t %.2f C  h %.1f %%  p %.1f hPa\n", bme.readTemperature(), bme.readHumidity(), bme.readPressure() / 100.0f);
  }
}`,
    open: ["Not tested on hardware yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    notes: [
      "Open the address the bench prints, such as http://192.168.1.80/, from any phone or computer on the same network. The chart keeps the last five minutes in the browser.",
      "Many cheap purple breakouts sold as BME280 carry a BMP280, which has no humidity sensor. The library refuses it, and the sketch says so. The chip markings tell them apart.",
      "Address 0x76 or 0x77 depends on the board's SDO pin; the sketch tries both. Run the I2C scanner project if neither answers.",
      "The BME280 warms itself a little when read constantly. Readings every two seconds are fine; for accurate room temperature, keep the sensor away from the ESP32's own heat.",
      "/data.json is plain JSON, so Home Assistant's REST sensor or a script can read it too.",
    ],
    settings: [
      ...WIFI,
    ],
    sample: [
      "wifi joining your-network",
      "dashboard at http://192.168.1.80/",
      "t 22.31 C  h 41.2 %  p 1013.6 hPa",
      "t 22.33 C  h 41.0 %  p 1013.6 hPa",
      "t 22.35 C  h 40.9 %  p 1013.5 hPa",
    ],
  },
  {
    id: "wifi-portal", needs: [], name: "Wi-Fi setup portal", level: "Intermediate", mins: 20, tags: ["no-parts", "wireless"],
    sum: "No passwords in the sketch: the board opens its own setup network with a page to pick your Wi-Fi, saves it, and joins it from then on.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    vars: { esp32: { BOOT: "0" }, esp32s3: { BOOT: "0" }, esp32c3: { BOOT: "9" } },
    pins: ["%BOOT%"], libs: ["WiFi (built in)", "WebServer (built in)", "DNSServer (built in)", "Preferences (built in)"], baud: 115200,
    parts: [[1, "ESP32 dev board", BOM.esp32DevKit]],
    wiring: [],
    code: R`#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <Preferences.h>

const int BOOT_BUTTON = %BOOT%;     // the board's BOOT button
const char* AP_PASS = "bench1234";  // password for the setup network, at least 8 characters
${benchSettings(["ap_pass"])}

Preferences prefs;
String apPass;
WebServer server(80);
DNSServer dns;
bool portal = false;
String options;  // network names found when the portal started
unsigned long lastBeat = 0;

String escapeHtml(const String& s) {
  String out;
  for (char c : s) {
    if (c == '<') out += "&lt;";
    else if (c == '&') out += "&amp;";
    else if (c == '"') out += "&quot;";
    else out += c;
  }
  return out;
}

void handleRoot() {
  String page = "<!doctype html><html><head><meta name=viewport content='width=device-width,initial-scale=1'>";
  page += "<title>Wi-Fi setup</title></head><body style='font-family:sans-serif;margin:16px'><h1>Wi-Fi setup</h1>";
  page += "<form method=post action=/save><p><label>Network<br><input name=ssid list=nets required></label></p>";
  page += "<datalist id=nets>";
  page += options;
  page += "</datalist><p><label>Password<br><input name=pass type=password></label></p>";
  page += "<p><button>Save and restart</button></p></form></body></html>";
  server.send(200, "text/html", page);
}

void handleSave() {
  prefs.putString("ssid", server.arg("ssid"));
  prefs.putString("pass", server.arg("pass"));
  server.send(200, "text/html", "<p style='font-family:sans-serif'>Saved. The board restarts and joins the network.</p>");
  Serial.printf("saved network %s, restarting\n", server.arg("ssid").c_str());
  delay(1000);
  ESP.restart();
}

void startPortal() {
  portal = true;
  WiFi.mode(WIFI_AP_STA);
  int n = WiFi.scanNetworks();
  for (int i = 0; i < n; i++) {
    options += "<option value=\"";
    options += escapeHtml(WiFi.SSID(i));
    options += "\">";
  }

  char name[24];
  snprintf(name, sizeof name, "ESP32-Setup-%04x", (unsigned)(ESP.getEfuseMac() >> 32) & 0xffff);
  WiFi.softAP(name, apPass.c_str());
  delay(100);
  dns.start(53, "*", WiFi.softAPIP());  // answer every name with the board, so phones open the page

  server.on("/", handleRoot);
  server.on("/save", HTTP_POST, handleSave);
  server.onNotFound([]() {
    server.sendHeader("Location", "http://192.168.4.1/", true);
    server.send(302, "text/plain", "");
  });
  server.begin();
  Serial.printf("portal up: join %s (password %s), then open http://192.168.4.1\n", name, apPass.c_str());
}

void setup() {
  Serial.begin(115200);
  pinMode(BOOT_BUTTON, INPUT_PULLUP);
  prefs.begin("wifi", false);
  benchSettingsBoot();
  apPass = benchSetting("ap_pass", AP_PASS);
  if (apPass.length() < 8) apPass = AP_PASS;  // the ESP32 refuses a shorter one

  // Holding BOOT while the board resets enters download mode, so the button is
  // only checked in the first two seconds after start-up.
  Serial.println("hold BOOT now to forget the saved network");
  unsigned long start = millis();
  while (millis() - start < 2000) {
    if (digitalRead(BOOT_BUTTON) == LOW) {
      prefs.clear();
      Serial.println("BOOT held: saved network cleared");
      break;
    }
    delay(20);
  }

  String ssid = prefs.getString("ssid", "");
  if (ssid.length() == 0) {
    Serial.println("no saved network");
    startPortal();
    return;
  }
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid.c_str(), prefs.getString("pass", "").c_str());
  Serial.printf("wifi joining %s\n", ssid.c_str());
  if (WiFi.waitForConnectResult(15000) == WL_CONNECTED) {
    Serial.printf("wifi ok %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("wifi failed");
    startPortal();
  }
}

void loop() {
  benchSettingsPoll();
  if (portal) {
    dns.processNextRequest();
    server.handleClient();
    return;
  }
  // Your own code goes here. The board reconnects by itself if the network drops.
  if (millis() - lastBeat > 10000) {
    lastBeat = millis();
    Serial.printf("online, rssi %d dBm\n", WiFi.RSSI());
  }
}`,
    open: ["Not tested on hardware yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    notes: [
      "First start: join the ESP32-Setup network from a phone with the password bench1234. Most phones open the setup page by themselves; if not, browse to http://192.168.4.1.",
      "The network list comes from a scan when the portal starts. Type the name instead if yours is hidden.",
      "The password is stored in the chip's flash without encryption. Anyone with the board and a USB cable can read it back, so do not ship boards with a network you care about.",
      "To change networks, reset the board and hold BOOT within two seconds. Holding it while pressing reset puts the board in download mode instead.",
      "If the saved network is out of reach at start-up, the portal opens again, so a board that moves house can be set up without a cable.",
      "The WiFiManager library does the same with more polish. This sketch shows how it works in about a hundred lines with only built-in libraries.",
    ],
    settings: [
      { key: "ap_pass", label: "Setup network password", kind: "password", hint: "At least 8 characters. The portal's own network uses it." },
    ],
    sample: [
      "hold BOOT now to forget the saved network",
      "no saved network",
      "portal up: join ESP32-Setup-3c71 (password bench1234), then open http://192.168.4.1",
      "saved network your-network, restarting",
      "hold BOOT now to forget the saved network",
      "wifi joining your-network",
      "wifi ok 192.168.1.66",
      "online, rssi -57 dBm",
    ],
  },
  {
    id: "esp32-cam-stream", needs: [], name: "ESP32-CAM video stream", level: "Intermediate", mins: 30, tags: ["wireless"],
    sum: "Stream live video from an ESP32-CAM to any browser on your network. Joins your Wi-Fi and serves the camera at its own address.",
    boards: ["esp32-cam"],
    pins: ["5V", "GND", "0", "1", "3"],
    libs: ["esp32-camera (built into the ESP32 core)", "WiFi (built in)"],
    baud: 115200,
    parts: [
      [1, "AI-Thinker ESP32-CAM with the OV2640 camera"],
      [1, "3.3 V USB-to-serial adapter (CP2102, CH340 or FTDI)"],
      [1, "5 V supply that can give 1 A, or the adapter's 5 V pin if it can"],
      [5, "Jumper wires"],
    ],
    wiring: [
      ["Adapter TX", "U0R (GPIO 3)", "Crossed over: adapter TX to board RX"],
      ["Adapter RX", "U0T (GPIO 1)", ""],
      ["Adapter GND", "GND", ""],
      ["5 V supply", "5V", "Not the 3.3 V pin. Weak power is the usual reason it resets"],
      ["IO0 (GPIO 0)", "GND", "Only while flashing. Remove it, then press RST to run"],
    ],
    code: R`#include "esp_camera.h"
#include <WiFi.h>
#include "esp_http_server.h"

const char* WIFI_SSID = "your-network";
const char* WIFI_PASS = "your-password";
${benchSettings(["wifi_ssid", "wifi_pass"])}
String wifiSsid, wifiPass;

// AI-Thinker ESP32-CAM pins, from Espressif's CameraWebServer example
#define PWDN_GPIO_NUM  32
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM  0
#define SIOD_GPIO_NUM  26
#define SIOC_GPIO_NUM  27
#define Y9_GPIO_NUM    35
#define Y8_GPIO_NUM    34
#define Y7_GPIO_NUM    39
#define Y6_GPIO_NUM    36
#define Y5_GPIO_NUM    21
#define Y4_GPIO_NUM    19
#define Y3_GPIO_NUM    18
#define Y2_GPIO_NUM    5
#define VSYNC_GPIO_NUM 25
#define HREF_GPIO_NUM  23
#define PCLK_GPIO_NUM  22

httpd_handle_t server = nullptr;

// Sends JPEG frames one after another until the browser closes the page.
esp_err_t streamHandler(httpd_req_t* req) {
  httpd_resp_set_type(req, "multipart/x-mixed-replace;boundary=frame");
  char head[96];
  while (true) {
    camera_fb_t* fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("Frame capture failed");
      return ESP_FAIL;
    }
    int n = snprintf(head, sizeof head, "\r\n--frame\r\nContent-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n", (unsigned)fb->len);
    esp_err_t res = httpd_resp_send_chunk(req, head, n);
    if (res == ESP_OK) res = httpd_resp_send_chunk(req, (const char*)fb->buf, fb->len);
    esp_camera_fb_return(fb);
    if (res != ESP_OK) break;
  }
  return ESP_OK;
}

esp_err_t indexHandler(httpd_req_t* req) {
  static const char page[] =
    "<!doctype html><title>ESP32-CAM</title>"
    "<body style='margin:0;background:#111'><img src='/stream' style='width:100%'>";
  httpd_resp_set_type(req, "text/html");
  return httpd_resp_send(req, page, HTTPD_RESP_USE_STRLEN);
}

void startServer() {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  if (httpd_start(&server, &config) != ESP_OK) {
    Serial.println("Web server failed to start");
    return;
  }
  httpd_uri_t index = {};
  index.uri = "/";
  index.method = HTTP_GET;
  index.handler = indexHandler;
  httpd_register_uri_handler(server, &index);

  httpd_uri_t stream = {};
  stream.uri = "/stream";
  stream.method = HTTP_GET;
  stream.handler = streamHandler;
  httpd_register_uri_handler(server, &stream);
}

void setup() {
  Serial.begin(115200);
  Serial.println();

  camera_config_t config = {};
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.grab_mode = CAMERA_GRAB_LATEST;
  config.jpeg_quality = 12;

  if (psramFound()) {
    config.frame_size = FRAMESIZE_VGA;
    config.fb_location = CAMERA_FB_IN_PSRAM;
    config.fb_count = 2;
  } else {
    Serial.println("No PSRAM: streaming at 320x240. Enable PSRAM in the board settings.");
    config.frame_size = FRAMESIZE_QVGA;
    config.fb_location = CAMERA_FB_IN_DRAM;
    config.fb_count = 1;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed: 0x%x. Check the ribbon cable and the power supply.\n", err);
    return;
  }
  Serial.println("Camera ready");

  benchSettingsBoot();
  wifiSsid = benchSetting("wifi_ssid", WIFI_SSID);
  wifiPass = benchSetting("wifi_pass", WIFI_PASS);
  benchNeeds("Wi-Fi name", wifiSsid, "your-network", "WIFI_SSID");
  WiFi.begin(wifiSsid.c_str(), wifiPass.c_str());
  WiFi.setSleep(false);
  Serial.print("Joining Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  startServer();
  Serial.printf("Stream ready: open http://%s/ in a browser\n", WiFi.localIP().toString().c_str());
}

void loop() {
  benchSettingsPoll();
  delay(100);
}`,
    settings: WIFI,
    open: ["Not tested on hardware yet. Compiles for the AI Thinker ESP32-CAM with Arduino-ESP32 core 3.3.12."],
    notes: [
      "Select AI Thinker ESP32-CAM as the board. It turns PSRAM on, which the camera needs for VGA and larger frames.",
      "To flash: tie IO0 to GND, press RST, upload, then remove the wire and press RST again. The bench shows the address once it joins Wi-Fi.",
      "Use 5 V on the 5V pin. Brownout resets during Wi-Fi start-up mean the supply is too weak.",
      "Only one browser can watch at a time with this simple server.",
      "Camera init failed: 0x105 usually means the camera ribbon is not seated. Lift the connector latch, push the ribbon in fully and close it.",
    ],
    sample: [
      "Camera ready",
      "Joining Wi-Fi......",
      "Stream ready: open http://192.168.1.48/ in a browser",
    ],
  },
  {
    id: "reaction-timer", needs: [], name: "Reaction timer", level: "Starter", mins: 5, tags: ["games", "no-parts"],
    sum: "How fast are you? The onboard LED lights after a random wait and you slap the BOOT button. Your best time survives a power cut.",
    boards: ["esp32", "esp32s3", "esp32c3", "esp32s2", "esp32c6", "xiao-esp32s3"],
    vars: {
      esp32: { LED: "2", BTN: "0", RGB: "false", ON: "HIGH", XLED: "GPIO 2", XGND: "GND" },
      esp32s3: { LED: "38", BTN: "0", RGB: "true", ON: "HIGH", XLED: "Not used on this board: it has its own LED", XGND: "Not used on this board: it has its own LED" },
      esp32c3: { LED: "8", BTN: "9", RGB: "true", ON: "HIGH", XLED: "Not used on this board: it has its own LED", XGND: "Not used on this board: it has its own LED" },
      esp32s2: { LED: "18", BTN: "0", RGB: "true", ON: "HIGH", XLED: "Not used on this board: it has its own LED", XGND: "Not used on this board: it has its own LED" },
      esp32c6: { LED: "8", BTN: "9", RGB: "true", ON: "HIGH", XLED: "Not used on this board: it has its own LED", XGND: "Not used on this board: it has its own LED" },
      "xiao-esp32s3": { LED: "21", BTN: "0", RGB: "false", ON: "LOW", XLED: "Not used on this board: it has its own LED", XGND: "Not used on this board: it has its own LED" },
    },
    pins: ["%LED%", "%BTN%"], libs: ["Preferences (built in)"], baud: 115200,
    parts: [[1, "ESP32 dev board", BOM.esp32DevKit], [1, "LED and 220 Ω resistor, only on a board without its own LED"]],
    wiring: [
      ["Onboard LED", "GPIO %LED%", "Already on the board"],
      ["Optional: LED anode, through 220 Ω", "%XLED%", "Only on a board without its own LED, such as the classic ESP32-DevKitC"],
      ["Optional: LED cathode", "%XGND%", ""],
      ["BOOT button", "GPIO %BTN%", "Already on the board"],
    ],
    code: R`// Reaction timer: the LED lights after a random wait, press BOOT as fast as you can.
#include <Preferences.h>

const int LED = %LED%;          // the board's LED
const bool LED_IS_RGB = %RGB%;  // an addressable RGB LED rather than a plain one
const int LED_ON = %ON%;        // the level that lights a plain LED
const int BUTTON = %BTN%;       // the BOOT button

Preferences prefs;
unsigned long best = 0;  // best time in ms, 0 until the first round

void led(bool on) {
  if (LED_IS_RGB) rgbLedWrite(LED, 0, on ? 64 : 0, 0);  // green
  else digitalWrite(LED, on ? LED_ON : !LED_ON);
}

bool pressed() {
  return digitalRead(BUTTON) == LOW;
}

void waitForRelease() {
  while (pressed()) delay(5);
  delay(30);  // let the contacts settle
}

void setup() {
  Serial.begin(115200);
  delay(500);
  pinMode(BUTTON, INPUT_PULLUP);
  if (!LED_IS_RGB) pinMode(LED, OUTPUT);
  led(false);
  prefs.begin("reaction", false);
  best = prefs.getULong("best", 0);
  randomSeed(esp_random());
  Serial.println("Reaction timer. Press BOOT when the LED lights.");
  if (best) Serial.printf("best so far: %lu ms\n", best);
}

void loop() {
  Serial.println("get ready...");
  waitForRelease();
  unsigned long wait = random(1500, 5000);
  unsigned long start = millis();
  while (millis() - start < wait) {
    if (pressed()) {
      Serial.println("false start! wait for the light");
      for (int i = 0; i < 6; i++) {
        led(i % 2 == 0);
        delay(80);
      }
      led(false);
      waitForRelease();
      delay(1000);
      return;
    }
    delay(1);
  }

  led(true);
  unsigned long lit = micros();
  while (!pressed()) {
    if (micros() - lit > 3000000UL) {
      led(false);
      Serial.println("too slow, try again");
      delay(1000);
      return;
    }
  }
  unsigned long ms = (micros() - lit) / 1000;
  led(false);
  Serial.printf("reaction=%lu ms\n", ms);
  if (best == 0 || ms < best) {
    best = ms;
    prefs.putULong("best", best);
    Serial.printf("new best: %lu ms\n", best);
  }
  waitForRelease();
  delay(1500);
}`,
    open: ["Not tested on hardware yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    notes: [
      "The classic ESP32-DevKitC V4 has no user LED. Many 30-pin clones have one on GPIO 2; otherwise add an LED and a 220 Ω resistor from GPIO 2 to GND.",
      "The S3, C3, S2 and C6 DevKits have an addressable RGB LED instead, driven with rgbLedWrite(). On the first S3-DevKitC-1 revision it is on GPIO 48, not 38.",
      "The XIAO ESP32S3's LED lights when its pin is low, which is why LED_ON is LOW there.",
      "Do not hold BOOT while the board resets: that puts it in download mode. Start pressing once it prints 'get ready'.",
      "The best time is kept with Preferences, so it survives a power cut. Erasing the whole flash clears it.",
      "Most people land between 200 and 300 ms. Under 150 ms is usually a lucky guess.",
    ],
    sample: [
      "Reaction timer. Press BOOT when the LED lights.",
      "get ready...", "reaction=312 ms", "new best: 312 ms",
      "get ready...", "reaction=287 ms", "new best: 287 ms",
      "get ready...", "false start! wait for the light",
      "get ready...", "reaction=301 ms",
      "get ready...", "reaction=264 ms", "new best: 264 ms",
      "get ready...", "reaction=279 ms",
    ],
  },
  {
    id: "morse-decoder", needs: [], name: "Morse code decoder", level: "Starter", mins: 10, tags: ["games", "no-parts"],
    sum: "Tap Morse on the BOOT button and watch it turn into letters. It learns your speed as you go, and a buzzer adds a sidetone if you have one.",
    boards: ["esp32", "esp32s3", "esp32c3", "esp32s2", "esp32c6", "xiao-esp32c3", "xiao-esp32s3"],
    vars: {
      esp32: { BTN: "0", BUZZ: "25" },
      esp32s3: { BTN: "0", BUZZ: "15" },
      esp32c3: { BTN: "9", BUZZ: "4" },
      esp32s2: { BTN: "0", BUZZ: "15" },
      esp32c6: { BTN: "9", BUZZ: "21" },
      "xiao-esp32c3": { BTN: "9", BUZZ: "4" },
      "xiao-esp32s3": { BTN: "0", BUZZ: "4" },
    },
    pins: ["%BTN%", "%BUZZ%", "GND"], libs: [], baud: 115200,
    parts: [[1, "ESP32 dev board", BOM.esp32DevKit], [1, "Optional passive buzzer or piezo", BOM.piezoBuzzer]],
    wiring: [
      ["BOOT button", "GPIO %BTN%", "Already on the board. It is the Morse key"],
      ["Buzzer +", "GPIO %BUZZ%", "Optional sidetone. A passive buzzer or piezo"],
      ["Buzzer -", "GND", ""],
    ],
    code: R`// Morse code decoder. The BOOT button is the key: short press = dot, long press = dash.
const int KEY = %BTN%;      // the BOOT button
const int BUZZER = %BUZZ%;  // optional sidetone, leave unconnected if you have no buzzer
const int TONE_HZ = 650;

const char* LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const char* CODES[] = {
  ".-", "-...", "-.-.", "-..", ".", "..-.", "--.", "....", "..", ".---", "-.-", ".-..", "--",
  "-.", "---", ".--.", "--.-", ".-.", "...", "-", "..-", "...-", ".--", "-..-", "-.--", "--..",
  "-----", ".----", "..---", "...--", "....-", ".....", "-....", "--...", "---..", "----.",
};

float unit = 120;      // length of one dot in ms; adapts to your speed
String symbol;         // dots and dashes of the letter being keyed
bool keyDown = false;
bool inWord = false;
unsigned long changedAt = 0;

char decode(const String& s) {
  for (int i = 0; i < 36; i++) {
    if (s == CODES[i]) return LETTERS[i];
  }
  return '?';
}

void setup() {
  Serial.begin(115200);
  delay(500);
  pinMode(KEY, INPUT_PULLUP);
  Serial.println("Morse decoder. Key with the BOOT button: short press = dot, long press = dash.");
}

void loop() {
  bool down = digitalRead(KEY) == LOW;
  unsigned long now = millis();
  unsigned long held = now - changedAt;

  if (down != keyDown && held > 15) {  // 15 ms debounce
    if (keyDown) {
      // Key released: was it a dot or a dash?
      noTone(BUZZER);
      if (held < 2 * unit) {
        symbol += '.';
        unit = (unit * 3 + held) / 4;
      } else {
        symbol += '-';
        unit = (unit * 3 + held / 3.0f) / 4;
      }
      unit = constrain(unit, 40.0f, 400.0f);
    } else {
      tone(BUZZER, TONE_HZ);
    }
    keyDown = down;
    changedAt = now;
    return;
  }

  if (!keyDown) {
    if (symbol.length() > 0 && held > 3 * unit) {
      Serial.print(decode(symbol));  // gap between letters
      symbol = "";
      inWord = true;
    } else if (inWord && held > 7 * unit) {
      Serial.printf("  wpm=%d\n", (int)(1200 / unit));  // gap between words
      inWord = false;
    }
  }
  delay(2);
}`,
    open: ["Not tested on hardware yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    notes: [
      "Start slowly and evenly. The decoder takes a dash as anything longer than two dots, and adjusts the dot length after every symbol.",
      "A gap of three dots ends a letter and seven dots ends a word, as in real Morse. Speed is printed as words per minute at the end of each word.",
      "Do not hold BOOT while the board resets, or it enters download mode.",
      "Try SOS (... --- ...), then your name. A real Morse key or any push button wired from the BOOT pin to GND works too.",
    ],
    sample: [
      "Morse decoder. Key with the BOOT button: short press = dot, long press = dash.",
      "SOS  wpm=9",
      "HELLO  wpm=11",
      "ESP32  wpm=12",
      "BENCH  wpm=13",
    ],
  },
  {
    id: "simon", needs: [["led"], ["button"], ["buzzer"]], name: "Simon memory game", level: "Intermediate", mins: 40, tags: ["games", "input"],
    sum: "Four lights, four buttons, four tones. Repeat the growing pattern for as long as you can; the high score is saved.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    vars: {
      esp32: { LA: "16", LB: "17", LC: "18", LD: "19", KA: "25", KB: "26", KC: "27", KD: "32", BUZZ: "23" },
      esp32s3: { LA: "4", LB: "5", LC: "6", LD: "7", KA: "15", KB: "16", KC: "17", KD: "18", BUZZ: "10" },
      esp32c3: { LA: "0", LB: "1", LC: "3", LD: "4", KA: "2", KB: "5", KC: "7", KD: "10", BUZZ: "6" },
    },
    pins: ["%LA%", "%LB%", "%LC%", "%LD%", "%KA%", "%KB%", "%KC%", "%KD%", "%BUZZ%", "GND"], libs: ["Preferences (built in)"], baud: 115200,
    parts: [
      [1, "ESP32 dev board", BOM.esp32DevKit],
      [4, "LEDs: green, red, yellow and blue"],
      [4, "220 Ω resistors"],
      [4, "Push buttons", BOM.tactileButtons],
      [1, "Passive buzzer or piezo", BOM.piezoBuzzer],
      [16, "Jumper wires"],
    ],
    wiring: [
      ["Green LED anode, through 220 Ω", "GPIO %LA%", "The anode is the longer leg"],
      ["Green LED cathode", "GND", ""],
      ["Red LED anode, through 220 Ω", "GPIO %LB%", ""],
      ["Red LED cathode", "GND", ""],
      ["Yellow LED anode, through 220 Ω", "GPIO %LC%", ""],
      ["Yellow LED cathode", "GND", ""],
      ["Blue LED anode, through 220 Ω", "GPIO %LD%", ""],
      ["Blue LED cathode", "GND", ""],
      ["Green button, side A", "GPIO %KA%", "The internal pull-ups do the rest"],
      ["Green button, side B", "GND", ""],
      ["Red button, side A", "GPIO %KB%", ""],
      ["Red button, side B", "GND", ""],
      ["Yellow button, side A", "GPIO %KC%", ""],
      ["Yellow button, side B", "GND", ""],
      ["Blue button, side A", "GPIO %KD%", ""],
      ["Blue button, side B", "GND", ""],
      ["Buzzer +", "GPIO %BUZZ%", ""],
      ["Buzzer -", "GND", ""],
    ],
    code: R`// Simon: repeat the growing sequence of lights and tones.
#include <Preferences.h>

const int LEDS[] = {%LA%, %LB%, %LC%, %LD%};     // green, red, yellow, blue
const int BUTTONS[] = {%KA%, %KB%, %KC%, %KD%};  // in the same order
const int BUZZER = %BUZZ%;
const int TONES[] = {415, 310, 252, 209};       // the classic Simon pitches
const int MAX_STEPS = 64;

Preferences prefs;
int sequence[MAX_STEPS];
int length = 0;
int best = 0;

void show(int i, int ms) {
  digitalWrite(LEDS[i], HIGH);
  tone(BUZZER, TONES[i]);
  delay(ms);
  noTone(BUZZER);
  digitalWrite(LEDS[i], LOW);
}

// Wait for one button press and release. Returns the button, or -1 after 4 s.
int readButton() {
  unsigned long start = millis();
  while (millis() - start < 4000) {
    for (int i = 0; i < 4; i++) {
      if (digitalRead(BUTTONS[i]) == LOW) {
        digitalWrite(LEDS[i], HIGH);
        tone(BUZZER, TONES[i]);
        delay(30);
        while (digitalRead(BUTTONS[i]) == LOW) delay(5);
        noTone(BUZZER);
        digitalWrite(LEDS[i], LOW);
        delay(30);
        return i;
      }
    }
    delay(2);
  }
  return -1;
}

void gameOver(int score) {
  tone(BUZZER, 110, 800);
  for (int k = 0; k < 3; k++) {
    for (int i = 0; i < 4; i++) digitalWrite(LEDS[i], HIGH);
    delay(150);
    for (int i = 0; i < 4; i++) digitalWrite(LEDS[i], LOW);
    delay(150);
  }
  if (score > best) {
    best = score;
    prefs.putInt("best", best);
  }
  Serial.printf("score=%d  best=%d\n", score, best);
  Serial.println("Press any button to start.");
  length = 0;
}

void setup() {
  Serial.begin(115200);
  delay(500);
  for (int i = 0; i < 4; i++) {
    pinMode(LEDS[i], OUTPUT);
    pinMode(BUTTONS[i], INPUT_PULLUP);
  }
  prefs.begin("simon", false);
  best = prefs.getInt("best", 0);
  randomSeed(esp_random());
  Serial.println("Simon. Press any button to start.");
}

void loop() {
  if (length == 0) {
    while (readButton() < 0) {
    }
    delay(600);
  }
  if (length == MAX_STEPS) {
    Serial.println("You beat the game!");
    gameOver(MAX_STEPS);
    return;
  }
  sequence[length++] = random(4);
  Serial.printf("round=%d\n", length);
  int speed = max(150, 450 - length * 15);  // it speeds up as you go
  for (int i = 0; i < length; i++) {
    show(sequence[i], speed);
    delay(speed / 2);
  }
  for (int i = 0; i < length; i++) {
    int pressed = readButton();
    if (pressed != sequence[i]) {
      Serial.println(pressed < 0 ? "too slow! game over" : "wrong button! game over");
      gameOver(length - 1);
      return;
    }
  }
  delay(700);
}`,
    open: ["Not tested on hardware yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    notes: [
      "The buttons use the chip's internal pull-ups, so each one only needs a wire to its GPIO and one to GND.",
      "On the C3 the red button is on GPIO 2, a strapping pin that must be high at reset. An open button does not change that; just do not hold it while the board starts.",
      "Use a passive buzzer or piezo. An active buzzer plays one fixed pitch whatever tone() asks for.",
      "The high score is kept with Preferences and survives a power cut.",
    ],
    sample: [
      "Simon. Press any button to start.",
      "round=1", "round=2", "round=3", "round=4", "round=5", "round=6", "round=7",
      "wrong button! game over",
      "score=6  best=6",
      "Press any button to start.",
    ],
  },
  {
    id: "theremin", needs: [["hcsr04"], ["buzzer"]], name: "Ultrasonic theremin", level: "Intermediate", mins: 20, tags: ["games", "sensors"],
    sum: "Play music by waving your hand over an ultrasonic sensor. Closer is higher. Open the bench to watch distance and pitch chart live.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    vars: {
      esp32: { TRIG: "5", ECHO: "18", BUZZ: "25" },
      esp32s3: { TRIG: "4", ECHO: "5", BUZZ: "6" },
      esp32c3: { TRIG: "4", ECHO: "5", BUZZ: "10" },
    },
    pins: ["5V", "GND", "%TRIG%", "%ECHO%", "%BUZZ%"], libs: [], baud: 115200,
    parts: [
      [1, "ESP32 dev board", BOM.esp32DevKit],
      [1, "HC-SR04 ultrasonic sensor"],
      [1, "1 kΩ resistor"],
      [1, "2 kΩ resistor"],
      [1, "Passive buzzer or piezo", BOM.piezoBuzzer],
      [7, "Jumper wires"],
    ],
    wiring: [
      ["HC-SR04 VCC", "5V", ""],
      ["HC-SR04 GND", "GND", ""],
      ["HC-SR04 TRIG", "GPIO %TRIG%", ""],
      ["HC-SR04 ECHO, through 1 kΩ", "GPIO %ECHO%", "The divider's top resistor"],
      ["2 kΩ resistor", "GPIO %ECHO% to GND", "The divider's bottom resistor: drops the 5 V echo to 3.3 V"],
      ["Buzzer +", "GPIO %BUZZ%", ""],
      ["Buzzer -", "GND", ""],
    ],
    code: R`// Ultrasonic theremin: hand distance sets the pitch. Closer is higher.
const int TRIG = %TRIG%;
const int ECHO = %ECHO%;
const int BUZZER = %BUZZ%;

const float NEAR_CM = 5;    // highest note here
const float FAR_CM = 60;    // lowest note here; further away is silence
const float LOW_HZ = 220;   // A3
const int OCTAVES = 3;      // up to A6
const bool SNAP = true;     // round to the nearest semitone, so it plays in tune

float readCm() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  unsigned long us = pulseIn(ECHO, HIGH, 25000);  // about 4 m round trip
  return us == 0 ? -1 : us * 0.0343f / 2;
}

void setup() {
  Serial.begin(115200);
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  Serial.println("Theremin ready. Wave a hand 5 to 60 cm above the sensor.");
}

void loop() {
  float cm = readCm();
  int hz = 0;
  if (cm >= NEAR_CM && cm <= FAR_CM) {
    float f = LOW_HZ * powf(2.0f, (FAR_CM - cm) / (FAR_CM - NEAR_CM) * OCTAVES);
    if (SNAP) f = 440.0f * powf(2.0f, roundf(12 * log2f(f / 440.0f)) / 12.0f);
    hz = (int)(f + 0.5f);
    tone(BUZZER, hz);
  } else {
    noTone(BUZZER);
  }
  Serial.printf("distance_cm=%.1f, freq=%d\n", cm < 0 ? 0.0f : cm, hz);
  delay(60);
}`,
    open: ["Not tested on hardware yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    notes: [
      "The HC-SR04's echo pin is 5 V. The 1 kΩ and 2 kΩ divider brings it down to about 3.3 V, the same as the HC-SR04 distance project.",
      "Set SNAP to false for a smooth, swooping theremin sound instead of notes.",
      "A flat hand works better than fingers: more surface sends back a stronger echo.",
      "Open the bench at 115200 baud: the plotter charts distance_cm and freq side by side as you play.",
      "No HC-SR04? A Sharp GP2Y0A21 IR distance sensor works too: power it from 5 V, read its output on an ADC1 pin and convert volts to cm as the IR sonar sweep project does. It only sees 10 to 80 cm.",
    ],
    sample: [
      "Theremin ready. Wave a hand 5 to 60 cm above the sensor.",
      "distance_cm=42.3, freq=440",
      "distance_cm=35.8, freq=554",
      "distance_cm=28.4, freq=740",
      "distance_cm=21.0, freq=988",
      "distance_cm=15.6, freq=1175",
      "distance_cm=11.2, freq=1397",
      "distance_cm=8.9, freq=1480",
      "distance_cm=12.7, freq=1319",
      "distance_cm=19.5, freq=1047",
      "distance_cm=30.2, freq=698",
      "distance_cm=0.0, freq=0",
    ],
  },
  {
    id: "oled-pong", needs: [["oled"], ["pot"]], name: "OLED Pong", level: "Intermediate", mins: 30, tags: ["games", "display", "input"],
    sum: "Classic Pong on a tiny OLED with two knobs as paddles. Play a friend, or set one side to the computer.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    vars: {
      esp32: { SDA: "21", SCL: "22", PA: "34", PB: "35" },
      esp32s3: { SDA: "8", SCL: "9", PA: "1", PB: "2" },
      esp32c3: { SDA: "6", SCL: "7", PA: "0", PB: "1" },
    },
    pins: ["3V3", "GND", "%SDA%", "%SCL%", "%PA%", "%PB%"], libs: ["Adafruit SSD1306", "Adafruit GFX Library"], baud: 115200,
    parts: [
      [1, "ESP32 dev board", BOM.esp32DevKit],
      [1, "0.96 inch SSD1306 OLED, I2C, address 0x3C"],
      [2, "10 kΩ potentiometers", BOM.pot10k],
      [10, "Jumper wires"],
    ],
    wiring: [
      ["OLED VCC", "3V3", ""],
      ["OLED GND", "GND", ""],
      ["OLED SDA", "GPIO %SDA%", ""],
      ["OLED SCL", "GPIO %SCL%", ""],
      ["Left knob, middle pin", "GPIO %PA%", ""],
      ["Left knob, outer pin", "3V3", "3V3, never 5V"],
      ["Left knob, other outer pin", "GND", ""],
      ["Right knob, middle pin", "GPIO %PB%", "Skip the right knob and set TWO_PLAYERS to false to play the computer"],
      ["Right knob, outer pin", "3V3", ""],
      ["Right knob, other outer pin", "GND", ""],
    ],
    code: R`// Pong on a 128 x 64 SSD1306 with two potentiometers as paddles.
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

const int KNOB_LEFT = %PA%;    // ADC1 pins
const int KNOB_RIGHT = %PB%;
const bool TWO_PLAYERS = true;  // false: the right paddle plays itself
const int WIN_SCORE = 7;

const int W = 128, H = 64, PADDLE_H = 14, PADDLE_W = 3;
Adafruit_SSD1306 display(W, H, &Wire, -1);

float ballX, ballY, velX, velY;
float leftY = 25, rightY = 25;
int scoreLeft = 0, scoreRight = 0;

void serve(int direction) {
  ballX = W / 2;
  ballY = H / 2;
  velX = 1.6f * direction;
  velY = random(-10, 11) / 10.0f;
}

float knobToY(int pin, float current) {
  float target = analogRead(pin) * (H - PADDLE_H) / 4095.0f;
  return current + (target - current) * 0.5f;  // a little smoothing
}

void setup() {
  Serial.begin(115200);
  Wire.begin(%SDA%, %SCL%);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("SSD1306 not found at 0x3C");
    for (;;) delay(1000);
  }
  analogReadResolution(12);
  randomSeed(esp_random());
  serve(1);
  Serial.printf("Pong ready. Left paddle: GPIO %d, right paddle: %s\n", KNOB_LEFT, TWO_PLAYERS ? "knob" : "computer");
}

void loop() {
  leftY = knobToY(KNOB_LEFT, leftY);
  if (TWO_PLAYERS) {
    rightY = knobToY(KNOB_RIGHT, rightY);
  } else {
    float aim = ballY - PADDLE_H / 2;
    rightY += constrain(aim - rightY, -1.3f, 1.3f);  // beatable on purpose
    rightY = constrain(rightY, 0.0f, (float)(H - PADDLE_H));
  }

  ballX += velX;
  ballY += velY;
  if (ballY <= 0 || ballY >= H - 2) velY = -velY;

  // Paddles: the bounce angle depends on where the ball hits.
  if (velX < 0 && ballX <= 4 && ballY + 2 >= leftY && ballY <= leftY + PADDLE_H) {
    velX = -velX * 1.05f;
    velY = (ballY - (leftY + PADDLE_H / 2)) / 4;
  }
  if (velX > 0 && ballX >= W - 6 && ballY + 2 >= rightY && ballY <= rightY + PADDLE_H) {
    velX = -velX * 1.05f;
    velY = (ballY - (rightY + PADDLE_H / 2)) / 4;
  }
  velX = constrain(velX, -4.0f, 4.0f);

  if (ballX < 0 || ballX > W) {
    bool leftScored = ballX > W;
    if (leftScored) scoreLeft++;
    else scoreRight++;
    Serial.printf("point to %s, score %d-%d\n", leftScored ? "left" : "right", scoreLeft, scoreRight);
    if (scoreLeft == WIN_SCORE || scoreRight == WIN_SCORE) {
      Serial.printf("%s wins %d-%d\n", scoreLeft > scoreRight ? "left" : "right", scoreLeft, scoreRight);
      display.clearDisplay();
      display.setTextSize(2);
      display.setTextColor(SSD1306_WHITE);
      display.setCursor(10, 24);
      display.print(scoreLeft > scoreRight ? "LEFT WINS" : "RIGHT WINS");
      display.display();
      delay(3000);
      scoreLeft = scoreRight = 0;
    }
    serve(leftScored ? -1 : 1);
    delay(500);
  }

  display.clearDisplay();
  for (int y = 0; y < H; y += 6) display.drawFastVLine(W / 2, y, 3, SSD1306_WHITE);
  display.fillRect(1, (int)leftY, PADDLE_W, PADDLE_H, SSD1306_WHITE);
  display.fillRect(W - 1 - PADDLE_W, (int)rightY, PADDLE_W, PADDLE_H, SSD1306_WHITE);
  display.fillRect((int)ballX, (int)ballY, 2, 2, SSD1306_WHITE);
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(W / 2 - 18, 0);
  display.print(scoreLeft);
  display.setCursor(W / 2 + 13, 0);
  display.print(scoreRight);
  display.display();
  delay(16);  // about 60 frames a second
}`,
    open: ["Not tested on hardware yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    notes: [
      "The knobs are on ADC1 pins. On the classic ESP32 those are GPIO 32 to 39; GPIO 34 and 35 are input only, which is all a knob needs.",
      "Wire the knobs' outer pins to 3V3 and GND. Using 5V would put 5 V on the GPIO when the knob is turned all the way.",
      "No second knob? Set TWO_PLAYERS to false and the right paddle plays itself. It is slow on purpose, so you can win.",
      "If a paddle jitters, add a 100 nF capacitor from the knob's middle pin to GND.",
    ],
    sample: [
      "Pong ready. Left paddle: GPIO %PA%, right paddle: knob",
      "point to left, score 1-0",
      "point to right, score 1-1",
      "point to left, score 2-1",
      "point to left, score 3-1",
      "point to right, score 3-2",
      "point to left, score 4-2",
    ],
  },
  {
    id: "dice", needs: [["oled"], ["button"]], name: "Electronic dice", level: "Starter", mins: 20, tags: ["games", "display", "input"],
    sum: "Press a button to roll two dice on an OLED, with a tumbling animation. The serial port keeps score, so you can check how fair the dice are.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    vars: {
      esp32: { SDA: "21", SCL: "22", BTN: "4" },
      esp32s3: { SDA: "8", SCL: "9", BTN: "4" },
      esp32c3: { SDA: "6", SCL: "7", BTN: "4" },
    },
    pins: ["3V3", "GND", "%SDA%", "%SCL%", "%BTN%"], libs: ["Adafruit SSD1306", "Adafruit GFX Library"], baud: 115200,
    parts: [
      [1, "ESP32 dev board", BOM.esp32DevKit],
      [1, "0.96 inch SSD1306 OLED, I2C, address 0x3C"],
      [1, "Push button", BOM.tactileButtons],
      [6, "Jumper wires"],
    ],
    wiring: [
      ["OLED VCC", "3V3", ""],
      ["OLED GND", "GND", ""],
      ["OLED SDA", "GPIO %SDA%", ""],
      ["OLED SCL", "GPIO %SCL%", ""],
      ["Button, side A", "GPIO %BTN%", "The internal pull-up does the rest"],
      ["Button, side B", "GND", ""],
    ],
    code: R`// Electronic dice on an SSD1306. Press the button to roll.
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

const int BUTTON = %BTN%;
const int DICE = 2;  // 1 or 2

Adafruit_SSD1306 display(128, 64, &Wire, -1);
int counts[13];  // how often each total came up
int rolls = 0;

void drawDie(int x, int y, int value) {
  const int S = 44, R = 4;
  display.drawRoundRect(x, y, S, S, 6, SSD1306_WHITE);
  int a = x + 11, b = x + S / 2, c = x + S - 11;  // pip columns
  int d = y + 11, e = y + S / 2, f = y + S - 11;  // pip rows
  if (value % 2 == 1) display.fillCircle(b, e, R, SSD1306_WHITE);
  if (value >= 2) {
    display.fillCircle(a, d, R, SSD1306_WHITE);
    display.fillCircle(c, f, R, SSD1306_WHITE);
  }
  if (value >= 4) {
    display.fillCircle(c, d, R, SSD1306_WHITE);
    display.fillCircle(a, f, R, SSD1306_WHITE);
  }
  if (value == 6) {
    display.fillCircle(a, e, R, SSD1306_WHITE);
    display.fillCircle(c, e, R, SSD1306_WHITE);
  }
}

void showDice(int one, int two) {
  display.clearDisplay();
  if (DICE == 1) {
    drawDie(42, 10, one);
  } else {
    drawDie(12, 10, one);
    drawDie(72, 10, two);
  }
  display.display();
}

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON, INPUT_PULLUP);
  Wire.begin(%SDA%, %SCL%);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("SSD1306 not found at 0x3C");
    for (;;) delay(1000);
  }
  showDice(6, 6);
  Serial.println("Dice ready. Press the button to roll.");
}

void loop() {
  if (digitalRead(BUTTON) == HIGH) return;

  // Tumble: quick random faces that slow down, like a die settling.
  int one = 1, two = 1;
  for (int wait = 30; wait < 220; wait += 20) {
    one = 1 + esp_random() % 6;
    two = 1 + esp_random() % 6;
    showDice(one, two);
    delay(wait);
  }
  int total = DICE == 1 ? one : one + two;
  counts[total]++;
  rolls++;
  if (DICE == 1) Serial.printf("die1=%d\n", one);
  else Serial.printf("die1=%d die2=%d sum=%d\n", one, two, total);

  if (rolls % 12 == 0) {
    Serial.printf("after %d rolls:", rolls);
    for (int t = DICE; t <= DICE * 6; t++) Serial.printf(" %d:%d", t, counts[t]);
    Serial.println();
  }
  while (digitalRead(BUTTON) == LOW) delay(10);
  delay(50);
}`,
    open: ["Not tested on hardware yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    notes: [
      "esp_random() uses the chip's hardware random number generator, which is truly random while the radio is on and plenty good for dice when it is off.",
      "With two dice, 7 should come up most often: about one roll in six. The summary every 12 rolls lets you watch that happen.",
      "Set DICE to 1 for a single die in the middle of the screen.",
    ],
    sample: [
      "Dice ready. Press the button to roll.",
      "die1=4 die2=3 sum=7",
      "die1=6 die2=2 sum=8",
      "die1=1 die2=5 sum=6",
      "die1=3 die2=3 sum=6",
      "die1=5 die2=6 sum=11",
      "die1=2 die2=1 sum=3",
      "die1=6 die2=1 sum=7",
      "die1=4 die2=4 sum=8",
      "die1=3 die2=6 sum=9",
      "die1=5 die2=2 sum=7",
      "die1=1 die2=1 sum=2",
      "die1=4 die2=5 sum=9",
      "after 12 rolls: 2:1 3:1 4:0 5:0 6:2 7:3 8:2 9:2 10:0 11:1 12:0",
    ],
  },
  {
    id: "ntp-clock", needs: [["oled"]], name: "NTP internet clock", level: "Starter", mins: 20, tags: ["display", "wireless", "logging"],
    sum: "A desk clock that sets itself from the internet and handles daylight saving on its own. Big digits and the date on a small OLED.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    vars: { esp32: { SDA: "21", SCL: "22" }, esp32s3: { SDA: "8", SCL: "9" }, esp32c3: { SDA: "6", SCL: "7" } },
    pins: ["3V3", "GND", "%SDA%", "%SCL%"], libs: ["WiFi (built in)", "Adafruit SSD1306", "Adafruit GFX Library"], baud: 115200,
    parts: [[1, "ESP32 dev board", BOM.esp32DevKit], [1, "0.96 inch SSD1306 OLED, I2C, address 0x3C"], [4, "Jumper wires"]],
    wiring: [["OLED VCC", "3V3", ""], ["OLED GND", "GND", ""], ["OLED SDA", "GPIO %SDA%", ""], ["OLED SCL", "GPIO %SCL%", ""]],
    code: R`// NTP clock: Wi-Fi sets the time, the TZ rule handles daylight saving.
#include <WiFi.h>
#include <Wire.h>
#include <time.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

const char* WIFI_SSID = "your-network";
const char* WIFI_PASS = "your-password";
// POSIX time zone rule. US Eastern shown; more examples in the project notes.
const char* TZ_RULE = "EST5EDT,M3.2.0,M11.1.0";
${benchSettings(["wifi_ssid", "wifi_pass", "tz_rule"])}

Adafruit_SSD1306 display(128, 64, &Wire, -1);
String wifiSsid, wifiPass, tzRule;
int lastMinute = -1;

void message(const char* text) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 28);
  display.print(text);
  display.display();
}

void setup() {
  Serial.begin(115200);
  Wire.begin(%SDA%, %SCL%);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("SSD1306 not found at 0x3C");
    for (;;) delay(1000);
  }
  message("Waiting for settings...");
  benchSettingsBoot();
  wifiSsid = benchSetting("wifi_ssid", WIFI_SSID);
  wifiPass = benchSetting("wifi_pass", WIFI_PASS);
  tzRule = benchSetting("tz_rule", TZ_RULE);
  benchNeeds("Wi-Fi name", wifiSsid, "your-network", "WIFI_SSID");
  message("Joining Wi-Fi...");
  Serial.printf("wifi joining %s\n", wifiSsid.c_str());
  WiFi.mode(WIFI_STA);
  WiFi.begin(wifiSsid.c_str(), wifiPass.c_str());
  while (WiFi.status() != WL_CONNECTED) delay(250);
  Serial.printf("wifi ok %s\n", WiFi.localIP().toString().c_str());

  message("Setting the time...");
  configTzTime(tzRule.c_str(), "pool.ntp.org", "time.google.com");
  struct tm now;
  while (!getLocalTime(&now, 10000)) Serial.println("waiting for NTP");
  char text[48];
  strftime(text, sizeof text, "%a %d %b %Y %H:%M:%S %Z", &now);
  Serial.printf("time synced: %s\n", text);
}

void loop() {
  benchSettingsPoll();
  struct tm now;
  if (!getLocalTime(&now, 100)) return;

  char hhmm[6], ss[3], date[20];
  strftime(hhmm, sizeof hhmm, "%H:%M", &now);
  strftime(ss, sizeof ss, "%S", &now);
  strftime(date, sizeof date, "%a %d %b %Y", &now);

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(3);
  display.setCursor(4, 12);
  display.print(hhmm);
  display.setTextSize(2);
  display.setCursor(100, 19);
  display.print(ss);
  display.setTextSize(1);
  display.setCursor(4, 50);
  display.print(date);
  if (WiFi.status() != WL_CONNECTED) display.print(" *");  // still keeping time, just not syncing
  display.display();

  if (now.tm_min != lastMinute) {
    lastMinute = now.tm_min;
    char line[48];
    strftime(line, sizeof line, "%H:%M:%S %a %d %b %Y %Z", &now);
    Serial.println(line);
  }
  delay(200);
}`,
    open: ["Not tested on hardware yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    notes: [
      "Change TZ_RULE for your time zone. Examples: Central US \"CST6CDT,M3.2.0,M11.1.0\", Pacific US \"PST8PDT,M3.2.0,M11.1.0\", UK \"GMT0BST,M3.5.0/1,M10.5.0\", Central Europe \"CET-1CEST,M3.5.0,M10.5.0/3\", Japan \"JST-9\".",
      "The ESP32 re-syncs with the time servers about once an hour. If Wi-Fi drops, the clock keeps running on its own crystal and a * appears after the date.",
      "Set WIFI_SSID and WIFI_PASS first. The ESP32 only joins 2.4 GHz networks.",
    ],
    settings: [
      ...WIFI,
      { key: "tz_rule", label: "Time zone rule", kind: "text", hint: 'POSIX form, e.g. "CST6CDT,M3.2.0,M11.1.0". Examples are in the notes.' },
    ],
    sample: [
      "wifi joining your-network",
      "wifi ok 192.168.1.42",
      "time synced: Thu 12 Nov 2026 10:41:07 EST",
      "10:42:00 Thu 12 Nov 2026 EST",
      "10:43:00 Thu 12 Nov 2026 EST",
      "10:44:00 Thu 12 Nov 2026 EST",
    ],
  },
  {
    id: "fire-lamp", needs: [["neopixel"]], name: "NeoPixel fire and lava lamp", level: "Starter", mins: 15, tags: ["lights"],
    sum: "A flickering fire on a strip of NeoPixels, and a slow lava-lamp glow. The BOOT button switches between them.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    vars: { esp32: { PIX: "16", BTN: "0" }, esp32s3: { PIX: "5", BTN: "0" }, esp32c3: { PIX: "4", BTN: "9" } },
    pins: ["5V", "GND", "%PIX%", "%BTN%"], libs: ["Adafruit NeoPixel"], baud: 115200,
    parts: [
      [1, "ESP32 dev board", BOM.esp32DevKit],
      [1, "WS2812B strip, 30 LEDs, or a NeoPixel Stick", BOM.neopixelStick],
      [1, "330 Ω resistor"],
      [1, "Optional 74AHCT125 level shifter", BOM.levelShifter],
      [3, "Jumper wires"],
    ],
    wiring: [
      ["Strip 5V or VDC", "5V", "Fine for a short strip at this brightness. Longer strips need their own 5 V supply"],
      ["Strip GND", "GND", "Join the grounds if the strip has its own supply"],
      ["Strip DIN, through 330 Ω", "GPIO %PIX%", "The resistor goes next to the strip"],
      ["BOOT button", "GPIO %BTN%", "Already on the board. Press it to switch effects"],
    ],
    code: R`// Fire and lava lamp on a NeoPixel strip. BOOT switches the effect.
#include <Adafruit_NeoPixel.h>

const int PIN = %PIX%;
const int COUNT = 30;       // LEDs on your strip
const int BUTTON = %BTN%;   // the BOOT button
const int COOLING = 55;     // fire: higher makes shorter flames
const int SPARKING = 120;   // fire: higher makes a busier fire

Adafruit_NeoPixel strip(COUNT, PIN, NEO_GRB + NEO_KHZ800);
uint8_t heat[COUNT];
bool lava = false;
int lastButton = HIGH;
unsigned long frames = 0, reportAt = 0;

// Black, red, orange, yellow, white as heat rises.
uint32_t heatColor(uint8_t t) {
  uint8_t scaled = (t * 191) / 255;  // 0 to 191, three bands of 64
  uint8_t ramp = (scaled & 63) << 2;
  if (scaled > 127) return strip.Color(255, 255, ramp);
  if (scaled > 63) return strip.Color(255, ramp, 0);
  return strip.Color(ramp, 0, 0);
}

void fire() {
  // The classic Fire2012 idea: each cell cools, heat drifts up, new sparks at the bottom.
  for (int i = 0; i < COUNT; i++) {
    int cool = random(0, ((COOLING * 10) / COUNT) + 2);
    heat[i] = heat[i] > cool ? heat[i] - cool : 0;
  }
  for (int k = COUNT - 1; k >= 2; k--) heat[k] = (heat[k - 1] + 2 * heat[k - 2]) / 3;
  if (random(255) < SPARKING) {
    int y = random(min(7, COUNT));
    heat[y] = min(255, heat[y] + (int)random(160, 255));
  }
  for (int j = 0; j < COUNT; j++) strip.setPixelColor(j, heatColor(heat[j]));
}

void lavaLamp() {
  // Two slow waves of warm colour drifting past each other.
  float t = millis() / 1000.0f;
  for (int i = 0; i < COUNT; i++) {
    float a = (sinf(i * 0.35f + t * 0.6f) + 1) / 2;
    float b = (sinf(i * 0.17f - t * 0.4f + 2) + 1) / 2;
    uint16_t hue = 60000 + (uint16_t)(a * 9000);  // magenta through red to orange
    uint8_t value = 60 + (uint8_t)(b * 195);
    strip.setPixelColor(i, strip.gamma32(strip.ColorHSV(hue, 255, value)));
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON, INPUT_PULLUP);
  strip.begin();
  strip.setBrightness(60);  // about a quarter: easy on USB power
  strip.show();
  randomSeed(esp_random());
  Serial.printf("%d LEDs on GPIO %d. Press BOOT to switch effects.\n", COUNT, PIN);
  Serial.println("mode: fire");
}

void loop() {
  int button = digitalRead(BUTTON);
  if (lastButton == HIGH && button == LOW) {
    lava = !lava;
    Serial.println(lava ? "mode: lava lamp" : "mode: fire");
    delay(30);
  }
  lastButton = button;

  if (lava) lavaLamp();
  else fire();
  strip.show();
  frames++;

  if (millis() - reportAt >= 5000) {
    Serial.printf("fps=%lu\n", frames * 1000 / (millis() - reportAt));
    frames = 0;
    reportAt = millis();
  }
  delay(lava ? 30 : 16);
}`,
    open: ["Not tested on hardware yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    notes: [
      "Each LED can draw about 60 mA at full white. Thirty LEDs at this brightness are fine on USB; at full brightness use a separate 5 V supply and a 1000 µF capacitor across it.",
      "WS2812B LEDs on 5 V expect data near 5 V. Most accept 3.3 V; if the first LED flickers or stays dark, put a 74AHCT125 level shifter in the data line.",
      "Hang the strip vertically for the fire: the flames rise from LED 0. A paper tube or a frosted jar over it makes it look far better.",
      "Tune COOLING and SPARKING to change the fire. The fps lines on the bench show how fast the strip is updating.",
    ],
    sample: [
      "30 LEDs on GPIO %PIX%. Press BOOT to switch effects.",
      "mode: fire",
      "fps=58",
      "fps=57",
      "fps=58",
      "mode: lava lamp",
      "fps=31",
      "fps=31",
      "mode: fire",
      "fps=58",
    ],
  },
  {
    id: "talking-plant", needs: [["soil"]], name: "Talking plant", level: "Starter", mins: 15, tags: ["games", "sensors"],
    sum: "Give a house plant a voice. A soil moisture sensor tells you when it is thirsty, and the plant says so on the serial port.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    vars: { esp32: { SOIL: "34" }, esp32s3: { SOIL: "2" }, esp32c3: { SOIL: "3" } },
    pins: ["3V3", "GND", "%SOIL%"], libs: [], baud: 115200,
    parts: [
      [1, "ESP32 dev board", BOM.esp32DevKit],
      [1, "Capacitive soil moisture sensor, v1.2 or similar, with analog output"],
      [3, "Jumper wires"],
    ],
    wiring: [
      ["Sensor VCC", "3V3", "3.3 V keeps the analog output inside the ESP32's range"],
      ["Sensor GND", "GND", ""],
      ["Sensor AOUT", "GPIO %SOIL%", "An ADC1 pin"],
    ],
    code: R`// Talking plant: a capacitive soil sensor gives the plant a voice.
const int SOIL = %SOIL%;       // an ADC1 pin
// Calibrate: read the raw value with the sensor in dry air, then in a glass of water.
const int AIR_RAW = 2800;
const int WATER_RAW = 1200;
const unsigned long EVERY_MS = 10000;

enum Mood { PARCHED, THIRSTY, HAPPY, SOGGY, UNKNOWN };
Mood mood = UNKNOWN;

int readRaw() {
  long sum = 0;
  for (int i = 0; i < 16; i++) {
    sum += analogRead(SOIL);
    delay(5);
  }
  return sum / 16;
}

Mood moodFor(int pct) {
  // A few percent of slack around the extremes, so the plant does not dither.
  const int slack = 3;
  if (mood == PARCHED && pct < 20 + slack) return PARCHED;
  if (mood == SOGGY && pct > 85 - slack) return SOGGY;
  if (pct < 20) return PARCHED;
  if (pct < 40) return THIRSTY;
  if (pct <= 85) return HAPPY;
  return SOGGY;
}

void say(Mood next) {
  if (next == HAPPY && (mood == PARCHED || mood == THIRSTY)) Serial.println("Plant: Ahh, that's better. Thank you!");
  else if (next == HAPPY) Serial.println("Plant: Feeling good.");
  else if (next == THIRSTY) Serial.println("Plant: I could use a drink soon.");
  else if (next == PARCHED) Serial.println("Plant: I'm parched! Water, please.");
  else Serial.println("Plant: Glub. That's plenty, my roots need air too.");
}

void setup() {
  Serial.begin(115200);
  delay(500);
  analogReadResolution(12);
  Serial.println("Talking plant. Calibrate AIR_RAW and WATER_RAW in the sketch for your sensor.");
}

void loop() {
  int raw = readRaw();
  int pct = constrain(map(raw, AIR_RAW, WATER_RAW, 0, 100), 0, 100);
  Serial.printf("moisture=%d%% raw=%d\n", pct, raw);
  Mood next = moodFor(pct);
  if (next != mood) {
    say(next);
    mood = next;
  }
  delay(EVERY_MS);
}`,
    open: ["Not tested on hardware yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    notes: [
      "Every sensor reads a little differently. Set AIR_RAW and WATER_RAW to the raw values you see in dry air and in a glass of water, and the percentages start to mean something.",
      "Wetter soil gives a lower raw number on capacitive sensors, which is why WATER_RAW is the smaller one.",
      "Only push the sensor in up to the line printed on it. The electronics at the top are not waterproof; a coat of nail varnish or hot glue on the edges helps it last.",
      "On a battery, read once and go to deep sleep for half an hour with esp_sleep_enable_timer_wakeup() and esp_deep_sleep_start(). Power the sensor from a GPIO so it is off while the board sleeps.",
      "The sensor is on an ADC1 pin, so the same wiring keeps working if you add Wi-Fi later.",
    ],
    sample: [
      "Talking plant. Calibrate AIR_RAW and WATER_RAW in the sketch for your sensor.",
      "moisture=18% raw=2512",
      "Plant: I'm parched! Water, please.",
      "moisture=17% raw=2528",
      "moisture=17% raw=2531",
      "moisture=52% raw=1968",
      "Plant: Ahh, that's better. Thank you!",
      "moisture=58% raw=1872",
      "moisture=61% raw=1824",
      "moisture=60% raw=1840",
    ],
  },
  {
    id: "ir-sweep", needs: [["sharpir"], ["servo"]], name: "IR sonar sweep", level: "Intermediate", mins: 30, tags: ["sensors", "motion"],
    sum: "A servo swings a Sharp IR distance sensor back and forth like a radar dish. The bench charts every reading and each sweep ends with a little map of what it saw.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    vars: {
      esp32: { SERVO: "18", IR: "34" },
      esp32s3: { SERVO: "5", IR: "2" },
      esp32c3: { SERVO: "4", IR: "3" },
    },
    pins: ["5V", "GND", "%SERVO%", "%IR%"], libs: ["ESP32Servo"], baud: 115200,
    parts: [
      [1, "ESP32 dev board", BOM.esp32DevKit],
      [1, "Sharp GP2Y0A21YK0F IR distance sensor, 10 to 80 cm", BOM.sharpIr],
      [1, "Micro servo, SG90 or similar", BOM.microServo],
      [1, "100 µF electrolytic capacitor"],
      [6, "Jumper wires"],
    ],
    wiring: [
      ["Sharp VCC (red)", "5V", "The sensor needs 5 V. Its output stays below about 3.1 V, so it is safe for the ESP32"],
      ["Sharp GND (black)", "GND", ""],
      ["100 µF capacitor", "5V to GND", "Right at the sensor, longer leg (+) to 5V. It smooths the sensor's current pulses"],
      ["Sharp Vo (yellow or white)", "GPIO %IR%", "An ADC1 pin, so it keeps working if you add Wi-Fi later"],
      ["Servo red", "5V", "One micro servo is fine from USB"],
      ["Servo brown", "GND", ""],
      ["Servo orange", "GPIO %SERVO%", ""],
    ],
    code: R`// IR sonar sweep: a servo swings a Sharp IR distance sensor from side to side
// and maps what it sees. Open the bench: angle and cm chart live, and each sweep
// ends with a little top-down map.
#include <ESP32Servo.h>

const int SERVO_PIN = %SERVO%;
const int IR_PIN = %IR%;               // an ADC1 pin: the sensor's analog output
const int STEP_DEG = 10;               // degrees per step
const int SETTLE_MS = 60;              // let the servo arrive and the sensor update (it refreshes every ~40 ms)
const int SAMPLES = 8;                 // readings averaged per step: the sensor is noisy
const float MIN_CM = 10, MAX_CM = 80;  // the GP2Y0A21's useful range

Servo servo;
float distances[180 / STEP_DEG + 1];

// The GP2Y0A21YK's output falls as distance rises, roughly as a power curve.
// cm = 27.86 * V^-1.15 is a common fit to the datasheet's typical curve from
// 10 to 80 cm. Measure a few known distances and adjust it for real accuracy.
float readCm() {
  uint32_t mv = 0;
  for (int i = 0; i < SAMPLES; i++) {
    mv += analogReadMilliVolts(IR_PIN);
    delay(2);
  }
  const float volts = mv / (float)SAMPLES / 1000.0f;
  if (volts < 0.35f) return MAX_CM + 1;  // nothing in range
  const float cm = 27.86f * powf(volts, -1.15f);
  return constrain(cm, MIN_CM - 1, MAX_CM + 1);
}

// A top-down map of one sweep: the sensor at the bottom middle, '*' where it saw
// something. It contains no digits, so the bench's plotter ignores it.
void drawMap() {
  const int W = 41, H = 11;
  char grid[H][W + 1];
  for (int y = 0; y < H; y++) {
    memset(grid[y], ' ', W);
    grid[y][W] = 0;
  }
  for (int i = 0; i * STEP_DEG <= 180; i++) {
    const float cm = distances[i];
    if (cm > MAX_CM) continue;
    const float a = radians(i * STEP_DEG);
    const int x = W / 2 + (int)roundf(cosf(a) * cm / MAX_CM * (W / 2));
    const int y = H - 1 - (int)roundf(sinf(a) * cm / MAX_CM * (H - 1));
    if (x >= 0 && x < W && y >= 0 && y < H) grid[y][x] = '*';
  }
  grid[H - 1][W / 2] = 'S';
  Serial.println("+-----------------------------------------+");
  for (int y = 0; y < H; y++) Serial.printf("|%s|\n", grid[y]);
  Serial.println("+-----------------------------------------+");
}

void setup() {
  Serial.begin(115200);
  analogSetPinAttenuation(IR_PIN, ADC_11db);  // the full 0 to 3.1 V range
  servo.setPeriodHertz(50);
  servo.attach(SERVO_PIN, 500, 2400);  // pulse range for SG90-class servos
  servo.write(0);
  delay(500);
  Serial.println("IR sweep ready");
}

int sweep = 0;

void loop() {
  sweep++;
  const bool forward = sweep % 2 == 1;  // sweep back and forth, so the servo never jumps
  float nearest = MAX_CM + 1;
  int nearestAt = -1;
  for (int i = 0; i * STEP_DEG <= 180; i++) {
    const int angle = forward ? i * STEP_DEG : 180 - i * STEP_DEG;
    servo.write(angle);
    delay(SETTLE_MS);
    const float cm = readCm();
    distances[angle / STEP_DEG] = cm;
    Serial.printf("angle = %d, cm = %.1f\n", angle, cm);
    if (cm < nearest) {
      nearest = cm;
      nearestAt = angle;
    }
  }
  drawMap();
  if (nearestAt >= 0 && nearest <= MAX_CM) {
    Serial.printf("sweep = %d, nearest_cm = %.1f, nearest_angle = %d\n", sweep, nearest, nearestAt);
  }
}`,
    open: ["Not tested on hardware yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    notes: [
      "Stick the IR sensor on the servo horn with tape or a dab of hot glue so it points the way the horn turns.",
      "The Sharp sensor draws its current in short bursts, which makes its output jumpy. The 100 µF capacitor across its power pins smooths that; the sketch also averages eight readings per step.",
      "It only measures from about 10 to 80 cm. Closer than 10 cm the reading folds back and looks farther away, so keep the first 10 cm in front of it clear.",
      "The cm figure comes from a typical curve for the GP2Y0A21. Check it with a ruler at two or three distances and adjust the 27.86 and -1.15 in readCm() if yours reads high or low.",
      "Dark, shiny or very angled surfaces send back less infrared light and may read farther than they are. A sheet of paper makes a good test target.",
      "Open the bench at 115200 baud: angle and cm chart live, and each sweep prints a top-down map with the sensor at the bottom.",
    ],
    sample: [
      "IR sweep ready",
      "angle = 0, cm = 80.6",
      "angle = 10, cm = 81.6",
      "angle = 20, cm = 80.6",
      "angle = 30, cm = 81.6",
      "angle = 40, cm = 80.6",
      "angle = 50, cm = 78.9",
      "angle = 60, cm = 68.9",
      "angle = 70, cm = 64.5",
      "angle = 80, cm = 26.1",
      "angle = 90, cm = 25.6",
      "angle = 100, cm = 26.1",
      "angle = 110, cm = 64.5",
      "angle = 120, cm = 68.9",
      "angle = 130, cm = 78.9",
      "angle = 140, cm = 80.6",
      "angle = 150, cm = 81.6",
      "angle = 160, cm = 80.6",
      "angle = 170, cm = 81.6",
      "angle = 180, cm = 80.6",
      "+-----------------------------------------+",
      "|                                         |",
      "|                                         |",
      "|       *      *           *      *       |",
      "|           *                 *           |",
      "|                                         |",
      "|                                         |",
      "|                                         |",
      "|                   ***                   |",
      "|                                         |",
      "|                                         |",
      "|                    S                    |",
      "+-----------------------------------------+",
      "sweep = 1, nearest_cm = 25.6, nearest_angle = 90",
      "angle = 180, cm = 81.3",
      "angle = 170, cm = 81.3",
      "angle = 160, cm = 81.3",
      "angle = 150, cm = 81.3",
      "angle = 140, cm = 81.3",
      "angle = 130, cm = 78.6",
      "angle = 120, cm = 69.6",
      "angle = 110, cm = 64.2",
    ],
  },
  {
    id: "level-platform", needs: [["mpu6050"], ["servo"]], name: "Self-levelling platform", level: "Intermediate", mins: 45, tags: ["sensors", "motion"],
    sum: "Tilt the base and two servos tilt the plate the other way, so a marble stays put. An MPU-6050 measures the tilt and a complementary filter keeps it steady.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    vars: {
      esp32: { SDA: "21", SCL: "22", SX: "18", SY: "19" },
      esp32s3: { SDA: "8", SCL: "9", SX: "5", SY: "6" },
      esp32c3: { SDA: "6", SCL: "7", SX: "4", SY: "5" },
    },
    pins: ["3V3", "GND", "%SDA%", "%SCL%", "%SX%", "%SY%"], libs: ["Wire (built in)", "ESP32Servo"], baud: 115200,
    parts: [
      [1, "ESP32 dev board", BOM.esp32DevKit],
      [1, "MPU-6050 accelerometer and gyro board (GY-521)"],
      [2, "Micro servos, SG90 or similar", BOM.microServo],
      [1, "5 V supply for the servos, such as a USB power bank or a 5 V 2 A adapter"],
      [1, "Small plate and base: card, plywood or a 3D print"],
      [10, "Jumper wires"],
    ],
    wiring: [
      ["MPU-6050 VCC", "3V3", "The GY-521 board also accepts 5 V, but 3V3 keeps its I2C lines at the ESP32's level"],
      ["MPU-6050 GND", "GND", ""],
      ["MPU-6050 SDA", "GPIO %SDA%", "The board has its own pull-up resistors"],
      ["MPU-6050 SCL", "GPIO %SCL%", ""],
      ["Roll servo signal", "GPIO %SX%", "Tilts the plate left and right"],
      ["Pitch servo signal", "GPIO %SY%", "Tilts the plate forward and back"],
      ["Both servos red", "5 V supply +", "Not the ESP32's 3V3 pin. Two servos moving at once can draw an amp"],
      ["Both servos brown", "GND", ""],
      ["5 V supply -", "GND", "Joins the servo supply's ground to the ESP32's"],
    ],
    code: R`// Self-levelling platform: an MPU-6050 on the base measures how far it is
// tilted, and two servos tilt the plate the other way so it stays level.
// Talks to the MPU-6050 directly over I2C, so no extra library is needed.
#include <Wire.h>
#include <ESP32Servo.h>

const int SDA_PIN = %SDA%;
const int SCL_PIN = %SCL%;
const int SERVO_X_PIN = %SX%;  // tilts the plate left and right (roll)
const int SERVO_Y_PIN = %SY%;  // tilts the plate forward and back (pitch)

const uint8_t MPU = 0x68;      // 0x69 if the board's AD0 pin is tied high
const float ALPHA = 0.98f;     // complementary filter: 98 % gyro, 2 % accelerometer
const float GAIN_X = 1.0f;     // servo degrees per degree of tilt; depends on your linkage
const float GAIN_Y = 1.0f;
const bool INVERT_X = false;   // flip if a servo makes the tilt worse instead of better
const bool INVERT_Y = false;
const int CENTER = 90, TRAVEL = 45;  // servo centre and how far either way it may go

Servo servoX, servoY;
float gyroBiasX = 0, gyroBiasY = 0;
float pitch = 0, roll = 0;          // filtered tilt, degrees
float pitchZero = 0, rollZero = 0;  // the tilt at start-up counts as level
unsigned long lastUs = 0;

void writeReg(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(MPU);
  Wire.write(reg);
  Wire.write(value);
  Wire.endTransmission();
}

// Accelerometer in g and gyro in degrees per second, from one 14-byte read.
bool readMpu(float& ax, float& ay, float& az, float& gx, float& gy) {
  Wire.beginTransmission(MPU);
  Wire.write(0x3B);  // ACCEL_XOUT_H
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom(MPU, (uint8_t)14) != 14) return false;
  int16_t raw[7];
  for (int i = 0; i < 7; i++) raw[i] = (int16_t)((Wire.read() << 8) | Wire.read());
  ax = raw[0] / 16384.0f;  // ±2 g range
  ay = raw[1] / 16384.0f;
  az = raw[2] / 16384.0f;
  gx = raw[4] / 131.0f;    // ±250 °/s range; raw[3] is temperature
  gy = raw[5] / 131.0f;
  return true;
}

void accelAngles(float ax, float ay, float az, float& p, float& r) {
  p = degrees(atan2f(-ax, sqrtf(ay * ay + az * az)));
  r = degrees(atan2f(ay, az));
}

void setup() {
  Serial.begin(115200);
  Wire.begin(SDA_PIN, SCL_PIN, 400000);
  Wire.beginTransmission(MPU);
  if (Wire.endTransmission() != 0) {
    Serial.println("MPU-6050 not found at 0x68: check SDA, SCL, 3V3 and GND");
    while (true) delay(1000);
  }
  writeReg(0x6B, 0x00);  // PWR_MGMT_1: wake up
  writeReg(0x1A, 0x03);  // CONFIG: 44 Hz low-pass filter to calm the servos
  writeReg(0x1B, 0x00);  // GYRO_CONFIG: ±250 °/s
  writeReg(0x1C, 0x00);  // ACCEL_CONFIG: ±2 g

  servoX.setPeriodHertz(50);
  servoY.setPeriodHertz(50);
  servoX.attach(SERVO_X_PIN, 500, 2400);
  servoY.attach(SERVO_Y_PIN, 500, 2400);
  servoX.write(CENTER);
  servoY.write(CENTER);

  // Calibrate: hold still for two seconds while the gyro's drift and the
  // starting tilt are measured.
  Serial.println("Calibrating: keep the base still and level");
  delay(500);
  float sumGx = 0, sumGy = 0, sumP = 0, sumR = 0;
  int n = 0;
  for (int i = 0; i < 400; i++) {
    float ax, ay, az, gx, gy;
    if (readMpu(ax, ay, az, gx, gy)) {
      float p, r;
      accelAngles(ax, ay, az, p, r);
      sumGx += gx;
      sumGy += gy;
      sumP += p;
      sumR += r;
      n++;
    }
    delay(5);
  }
  if (n > 0) {
    gyroBiasX = sumGx / n;
    gyroBiasY = sumGy / n;
    pitchZero = sumP / n;
    rollZero = sumR / n;
  }
  pitch = pitchZero;
  roll = rollZero;
  lastUs = micros();
  Serial.println("Levelling. Tilt the base and watch the plate.");
}

unsigned long lastPrint = 0;

void loop() {
  float ax, ay, az, gx, gy;
  if (!readMpu(ax, ay, az, gx, gy)) {
    Serial.println("MPU-6050 read failed");
    delay(100);
    return;
  }
  const unsigned long now = micros();
  const float dt = (now - lastUs) / 1e6f;
  lastUs = now;

  // Complementary filter: the gyro is smooth but drifts, the accelerometer is
  // noisy but never drifts. Mix them.
  float ap, ar;
  accelAngles(ax, ay, az, ap, ar);
  roll = ALPHA * (roll + (gx - gyroBiasX) * dt) + (1 - ALPHA) * ar;
  pitch = ALPHA * (pitch + (gy - gyroBiasY) * dt) + (1 - ALPHA) * ap;

  // Tilt the plate against the base's tilt.
  const float tiltX = roll - rollZero, tiltY = pitch - pitchZero;
  const int sx = constrain((int)roundf(CENTER + (INVERT_X ? 1 : -1) * GAIN_X * tiltX), CENTER - TRAVEL, CENTER + TRAVEL);
  const int sy = constrain((int)roundf(CENTER + (INVERT_Y ? 1 : -1) * GAIN_Y * tiltY), CENTER - TRAVEL, CENTER + TRAVEL);
  servoX.write(sx);
  servoY.write(sy);

  if (millis() - lastPrint >= 100) {
    lastPrint = millis();
    Serial.printf("pitch = %.1f, roll = %.1f, servo_x = %d, servo_y = %d\n", tiltY, tiltX, sx, sy);
  }
  delay(5);
}`,
    open: ["Not tested on hardware yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    notes: [
      "Fix the MPU-6050 to the base, not the plate. The sketch measures how far the base tilts and turns the servos the other way.",
      "Keep the base still and level for the first two seconds after power-up: the sketch measures the gyro's drift and takes the starting position as level.",
      "If the plate tilts the wrong way on one axis, set INVERT_X or INVERT_Y. If it under- or over-corrects, change GAIN_X and GAIN_Y: the right value depends on how far each servo arm moves the plate.",
      "The complementary filter trusts the gyro 98 % (ALPHA) for smooth, quick moves and the accelerometer 2 % to stop the gyro drifting. Lower ALPHA if it slowly wanders, raise it if it jitters.",
      "Many cheap MPU-6050 boards are clones. If the board is not found, run the I2C scanner project: it may answer at 0x69 if its AD0 pin is high.",
      "Servos that jitter or reset the board are short of current. Power them from their own 5 V supply and join the grounds.",
    ],
    sample: [
      "Calibrating: keep the base still and level",
      "Levelling. Tilt the base and watch the plate.",
      "pitch = 0.0, roll = -0.0, servo_x = 90, servo_y = 90",
      "pitch = 2.9, roll = -3.0, servo_x = 93, servo_y = 87",
      "pitch = 5.6, roll = -5.3, servo_x = 95, servo_y = 84",
      "pitch = 8.0, roll = -6.4, servo_x = 96, servo_y = 82",
      "pitch = 9.9, roll = -6.0, servo_x = 96, servo_y = 80",
      "pitch = 11.2, roll = -4.2, servo_x = 94, servo_y = 79",
      "pitch = 11.9, roll = -1.5, servo_x = 92, servo_y = 78",
      "pitch = 11.9, roll = 1.5, servo_x = 88, servo_y = 78",
      "pitch = 11.2, roll = 4.2, servo_x = 86, servo_y = 79",
      "pitch = 9.9, roll = 6.0, servo_x = 84, servo_y = 80",
      "pitch = 8.0, roll = 6.4, servo_x = 84, servo_y = 82",
      "pitch = 5.6, roll = 5.3, servo_x = 85, servo_y = 84",
      "pitch = 2.9, roll = 3.0, servo_x = 87, servo_y = 87",
      "pitch = 0.0, roll = 0.0, servo_x = 90, servo_y = 90",
    ],
  },
  {
    id: "joystick-turret", needs: [["joystick"], ["servo"]], name: "Joystick pan-tilt turret", level: "Starter", mins: 30, tags: ["games", "motion", "input"],
    sum: "Steer two servos with a thumb joystick, like a camera turret. Add an MPU-6050 and a click of the stick switches to tilt steering: point your hand and the turret follows.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    vars: {
      esp32: { JX: "34", JY: "35", JB: "27", PAN: "18", TILT: "19", SDA: "21", SCL: "22" },
      esp32s3: { JX: "1", JY: "2", JB: "4", PAN: "5", TILT: "6", SDA: "8", SCL: "9" },
      esp32c3: { JX: "0", JY: "1", JB: "10", PAN: "4", TILT: "5", SDA: "6", SCL: "7" },
    },
    pins: ["3V3", "5V", "GND", "%JX%", "%JY%", "%JB%", "%PAN%", "%TILT%"], libs: ["Wire (built in)", "ESP32Servo"], baud: 115200,
    parts: [
      [1, "ESP32 dev board", BOM.esp32DevKit],
      [1, "Analog thumb joystick with select button", BOM.thumbJoystick],
      [2, "Micro servos, SG90 or similar", BOM.microServo],
      [1, "Optional: MPU-6050 board (GY-521) for tilt steering"],
      [1, "Optional: a pan-tilt bracket, or tape the tilt servo to the pan servo's horn"],
      [10, "Jumper wires"],
    ],
    wiring: [
      ["Joystick +5V or VCC", "3V3", "3V3, not 5 V: at 5 V the stick could send more than 3.3 V into the ESP32"],
      ["Joystick GND", "GND", ""],
      ["Joystick VRx", "GPIO %JX%", "An ADC1 pin"],
      ["Joystick VRy", "GPIO %JY%", "An ADC1 pin"],
      ["Joystick SW", "GPIO %JB%", "The internal pull-up does the rest"],
      ["Pan servo signal", "GPIO %PAN%", ""],
      ["Tilt servo signal", "GPIO %TILT%", ""],
      ["Both servos red", "5V", "Fine from USB for two micro servos that move gently; use a separate 5 V supply if the board resets"],
      ["Both servos brown", "GND", ""],
      ["Optional: MPU-6050 VCC", "3V3", ""],
      ["Optional: MPU-6050 GND", "GND", ""],
      ["Optional: MPU-6050 SDA and SCL", "GPIO %SDA% and %SCL%", "Found automatically at start-up"],
    ],
    code: R`// Joystick pan-tilt turret: push the stick and two servos follow. Click the stick
// to switch to tilt mode, where an MPU-6050 in your hand steers instead (if one
// is wired; without it the button does nothing).
#include <Wire.h>
#include <ESP32Servo.h>

const int JOY_X = %JX%;     // ADC1 pins
const int JOY_Y = %JY%;
const int JOY_BTN = %JB%;   // the stick's push button (SW)
const int PAN_PIN = %PAN%;
const int TILT_PIN = %TILT%;
const int SDA_PIN = %SDA%;  // optional MPU-6050 for tilt mode
const int SCL_PIN = %SCL%;

const float DEADZONE = 0.08f;    // ignore the stick this close to centre (fraction of full throw)
const float MAX_SPEED = 120.0f;  // degrees per second at full throw
const int MIN_ANGLE = 10, MAX_ANGLE = 170;
const float TILT_GAIN = 1.5f;    // tilt mode: servo degrees per degree of hand tilt
const uint8_t MPU = 0x68;

Servo pan, tilt;
float panAngle = 90, tiltAngle = 90;
int centerX = 2048, centerY = 2048;
bool hasMpu = false, tiltMode = false;
unsigned long lastMs = 0, lastPrint = 0;

int averageRead(int pin) {
  long sum = 0;
  for (int i = 0; i < 16; i++) sum += analogRead(pin);
  return sum / 16;
}

// Stick position from -1 to 1, with the dead zone removed and the rest rescaled.
float axis(int pin, int center) {
  const int raw = averageRead(pin);
  const float span = raw >= center ? 4095 - center : center;
  float v = (raw - center) / (span > 0 ? span : 1);
  if (fabsf(v) < DEADZONE) return 0;
  v = (fabsf(v) - DEADZONE) / (1 - DEADZONE) * (v > 0 ? 1 : -1);
  return constrain(v, -1.0f, 1.0f);
}

bool readTilt(float& pitch, float& roll) {
  Wire.beginTransmission(MPU);
  Wire.write(0x3B);
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom(MPU, (uint8_t)6) != 6) return false;
  const float ax = (int16_t)((Wire.read() << 8) | Wire.read()) / 16384.0f;
  const float ay = (int16_t)((Wire.read() << 8) | Wire.read()) / 16384.0f;
  const float az = (int16_t)((Wire.read() << 8) | Wire.read()) / 16384.0f;
  pitch = degrees(atan2f(-ax, sqrtf(ay * ay + az * az)));
  roll = degrees(atan2f(ay, az));
  return true;
}

void setup() {
  Serial.begin(115200);
  pinMode(JOY_BTN, INPUT_PULLUP);
  analogSetPinAttenuation(JOY_X, ADC_11db);
  analogSetPinAttenuation(JOY_Y, ADC_11db);

  pan.setPeriodHertz(50);
  tilt.setPeriodHertz(50);
  pan.attach(PAN_PIN, 500, 2400);
  tilt.attach(TILT_PIN, 500, 2400);
  pan.write(90);
  tilt.write(90);

  // The stick rests at its centre now: remember where that is.
  delay(300);
  centerX = averageRead(JOY_X);
  centerY = averageRead(JOY_Y);

  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.beginTransmission(MPU);
  hasMpu = Wire.endTransmission() == 0;
  if (hasMpu) {
    Wire.beginTransmission(MPU);
    Wire.write(0x6B);  // PWR_MGMT_1: wake up
    Wire.write(0);
    Wire.endTransmission();
  }
  Serial.printf("Turret ready. MPU-6050 %s.\n", hasMpu ? "found: click the stick for tilt mode" : "not found: stick only");
  lastMs = millis();
}

void loop() {
  const unsigned long now = millis();
  const float dt = (now - lastMs) / 1000.0f;
  lastMs = now;

  // Click to switch modes, only when an MPU-6050 is there to steer with.
  if (hasMpu && digitalRead(JOY_BTN) == LOW) {
    tiltMode = !tiltMode;
    Serial.println(tiltMode ? "Tilt mode: steer by tilting the MPU-6050" : "Stick mode");
    while (digitalRead(JOY_BTN) == LOW) delay(10);
    delay(30);  // debounce the release
  }

  float pitch, roll;
  if (tiltMode && readTilt(pitch, roll)) {
    panAngle = 90 + roll * TILT_GAIN;
    tiltAngle = 90 + pitch * TILT_GAIN;
  } else {
    // Stick mode: the further you push, the faster it turns, and it stays put when you let go.
    panAngle += axis(JOY_X, centerX) * MAX_SPEED * dt;
    tiltAngle += axis(JOY_Y, centerY) * MAX_SPEED * dt;
  }
  panAngle = constrain(panAngle, (float)MIN_ANGLE, (float)MAX_ANGLE);
  tiltAngle = constrain(tiltAngle, (float)MIN_ANGLE, (float)MAX_ANGLE);
  pan.write((int)roundf(panAngle));
  tilt.write((int)roundf(tiltAngle));

  if (now - lastPrint >= 150) {
    lastPrint = now;
    Serial.printf("pan = %d, tilt = %d\n", (int)roundf(panAngle), (int)roundf(tiltAngle));
  }
  delay(15);
}`,
    open: ["Not tested on hardware yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    notes: [
      "Leave the stick alone while the board starts: it reads the resting position as the centre, so the turret does not creep.",
      "In stick mode the turret moves faster the further you push and stays where it is when you let go. Change MAX_SPEED to taste, and DEADZONE if it drifts with the stick at rest.",
      "Without an MPU-6050 the stick's button does nothing. With one, a click switches to tilt mode, where the servos copy the board's tilt: hold it like a remote.",
      "Many joystick modules are labelled +5V. Power them from 3V3 anyway: the stick is just two potentiometers, and at 5 V their outputs could reach 5 V.",
      "On the C3 the two axes use GPIO 0 and 1, the only free ADC pins once I2C and the servos are wired.",
    ],
    sample: [
      "Turret ready. MPU-6050 found: click the stick for tilt mode.",
      "pan = 102, tilt = 90",
      "pan = 114, tilt = 90",
      "pan = 126, tilt = 90",
      "pan = 138, tilt = 90",
      "pan = 150, tilt = 90",
      "pan = 150, tilt = 81",
      "pan = 150, tilt = 72",
      "pan = 150, tilt = 63",
      "pan = 150, tilt = 54",
      "pan = 135, tilt = 60",
      "pan = 120, tilt = 66",
      "pan = 105, tilt = 72",
      "Tilt mode: steer by tilting the MPU-6050",
      "pan = 96, tilt = 84",
      "pan = 104, tilt = 79",
      "pan = 111, tilt = 75",
      "pan = 103, tilt = 88",
    ],
  },
  {
    id: "visitor-counter", needs: [["pir"], ["shiftreg"], ["sevenseg"], ["buzzer"]], name: "Visitor counter", level: "Intermediate", mins: 40, tags: ["games", "sensors"],
    sum: "A motion sensor counts people walking past and chirps for each one. A 74HC595 shift register drives a 7-segment digit with just three wires, and the count survives a power cut.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    vars: {
      esp32: { PIR: "27", SER: "23", CLK: "18", LATCH: "19", BUZZ: "25", BTN: "0" },
      esp32s3: { PIR: "4", SER: "5", CLK: "6", LATCH: "7", BUZZ: "10", BTN: "0" },
      esp32c3: { PIR: "10", SER: "4", CLK: "5", LATCH: "6", BUZZ: "7", BTN: "9" },
    },
    pins: ["5V", "3V3", "GND", "%PIR%", "%SER%", "%CLK%", "%LATCH%", "%BUZZ%", "%BTN%"], libs: ["Preferences (built in)"], baud: 115200,
    parts: [
      [1, "ESP32 dev board", BOM.esp32DevKit],
      [1, "PIR motion sensor (HC-SR501 type)", BOM.pirSensor],
      [1, "74HC595 shift register", BOM.shiftRegister595],
      [1, "Single 7-segment LED digit, common cathode or common anode"],
      [8, "330 Ω resistors, one per segment"],
      [1, "0.1 µF ceramic capacitor"],
      [1, "Passive buzzer or piezo", BOM.piezoBuzzer],
      [1, "Breadboard and jumper wires"],
    ],
    wiring: [
      ["PIR VCC", "5V", "The HC-SR501 needs 5 V or more, but its OUT pin only goes to 3.3 V"],
      ["PIR GND", "GND", ""],
      ["PIR OUT", "GPIO %PIR%", ""],
      ["74HC595 VCC (pin 16)", "3V3", ""],
      ["0.1 µF capacitor", "3V3 to GND", "Right at the chip, across pins 16 and 8"],
      ["74HC595 GND (pin 8)", "GND", ""],
      ["74HC595 SER (pin 14)", "GPIO %SER%", "Data in"],
      ["74HC595 SRCLK (pin 11)", "GPIO %CLK%", "Shift clock"],
      ["74HC595 RCLK (pin 12)", "GPIO %LATCH%", "Latch: shows the new pattern"],
      ["74HC595 OE (pin 13)", "GND", "Outputs always on"],
      ["74HC595 MR (pin 10)", "3V3", "Never clear the register"],
      ["74HC595 Q0 to Q6 (pins 15, 1 to 6)", "Digit segments a to g", "Each through its own 330 Ω resistor"],
      ["74HC595 Q7 (pin 7)", "Digit decimal point", "Through 330 Ω"],
      ["Digit common pin", "GND or 3V3", "GND for common cathode, 3V3 for common anode (then set COMMON_ANODE)"],
      ["Buzzer +", "GPIO %BUZZ%", ""],
      ["Buzzer -", "GND", ""],
    ],
    code: R`// Visitor counter: a PIR sensor counts people walking past, a 74HC595 shift
// register drives a 7-segment digit, and a piezo chirps for each visitor.
// The digit shows the last digit of the count; after each visit it spells out
// the whole number, one digit at a time. The count survives a power cut.
#include <Preferences.h>

const int PIR_PIN = %PIR%;
const int SER_PIN = %SER%;      // 74HC595 SER (DS), pin 14
const int CLOCK_PIN = %CLK%;    // 74HC595 SRCLK (SHCP), pin 11
const int LATCH_PIN = %LATCH%;  // 74HC595 RCLK (STCP), pin 12
const int BUZZER = %BUZZ%;
const int BUTTON = %BTN%;       // the BOOT button: hold 3 s to reset the count

const bool COMMON_ANODE = false;     // set true for a common-anode digit (common pin to 3V3)
const unsigned long WARMUP_MS = 30000;  // a PIR needs about 30 s after power-up to settle
const unsigned long REARM_MS = 2000;    // quiet time after a visit before the next one counts

// Segments a to g on the 595's outputs Q0 to Q6, the decimal point on Q7.
const uint8_t DIGITS[10] = {
  0b00111111, 0b00000110, 0b01011011, 0b01001111, 0b01100110,
  0b01101101, 0b01111101, 0b00000111, 0b01111111, 0b01101111,
};
const uint8_t DOT = 0b10000000;

Preferences prefs;
uint32_t count = 0;
bool wasHigh = false;
unsigned long lastLow = 0;

void show(uint8_t segments) {
  if (COMMON_ANODE) segments = ~segments;  // a common-anode segment lights when its pin is low
  digitalWrite(LATCH_PIN, LOW);
  shiftOut(SER_PIN, CLOCK_PIN, MSBFIRST, segments);
  digitalWrite(LATCH_PIN, HIGH);  // the new pattern appears on the outputs all at once
}

void showCount() {
  show(DIGITS[count % 10]);
}

// Spell the whole count, one digit at a time, with the dot on the last one.
void spellCount() {
  char text[12];
  snprintf(text, sizeof(text), "%lu", (unsigned long)count);
  for (int i = 0; text[i]; i++) {
    uint8_t seg = DIGITS[text[i] - '0'];
    if (!text[i + 1]) seg |= DOT;
    show(0);
    delay(120);
    show(seg);
    delay(450);
  }
  showCount();
}

void chirp() {
  tone(BUZZER, 1800, 50);
  delay(70);
  tone(BUZZER, 2400, 50);
}

void setup() {
  Serial.begin(115200);
  pinMode(PIR_PIN, INPUT);
  pinMode(SER_PIN, OUTPUT);
  pinMode(CLOCK_PIN, OUTPUT);
  pinMode(LATCH_PIN, OUTPUT);
  pinMode(BUTTON, INPUT_PULLUP);

  prefs.begin("visitors", false);
  count = prefs.getUInt("count", 0);
  Serial.printf("Visitor counter. Warming up the PIR for %lu s.\n", WARMUP_MS / 1000);

  // Warm-up: a spinning segment, so you know it is not counting yet.
  const uint8_t spin[] = {0b00000001, 0b00000010, 0b00000100, 0b00001000, 0b00010000, 0b00100000};
  for (unsigned long start = millis(); millis() - start < WARMUP_MS;) {
    show(spin[(millis() / 120) % 6]);
    delay(20);
  }
  showCount();
  lastLow = millis();
  Serial.println("Counting.");
}

void loop() {
  const bool motion = digitalRead(PIR_PIN) == HIGH;
  const unsigned long now = millis();

  if (!motion) {
    if (wasHigh) lastLow = now;
    wasHigh = false;
  } else if (!wasHigh) {
    wasHigh = true;
    // A new visit only counts after REARM_MS of quiet, so one person is one count.
    if (now - lastLow >= REARM_MS) {
      count++;
      prefs.putUInt("count", count);
      Serial.printf("count = %lu\n", (unsigned long)count);
      chirp();
      spellCount();
    }
  }

  // Hold BOOT for three seconds to start again from zero.
  if (digitalRead(BUTTON) == LOW) {
    const unsigned long pressed = now;
    while (digitalRead(BUTTON) == LOW) {
      if (millis() - pressed > 3000) {
        count = 0;
        prefs.putUInt("count", 0);
        Serial.println("Count reset.");
        showCount();
        while (digitalRead(BUTTON) == LOW) delay(10);
        break;
      }
      delay(10);
    }
  }
  delay(20);
}`,
    open: ["Not tested on hardware yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    notes: [
      "The shift register turns three ESP32 pins into eight outputs: the sketch clocks one byte into SER with SRCLK, then pulses RCLK so all eight segments change at once.",
      "Not sure whether your digit is common cathode or common anode? Wire the common pin to GND and run it. If everything except the right segments lights, move the common pin to 3V3 and set COMMON_ANODE to true.",
      "Use 330 Ω per segment, not one shared resistor: an 8 lights at once and the 74HC595 can only supply about 70 mA in total.",
      "On the HC-SR501, turn the time knob fully anticlockwise (shortest hold) and set the jumper to single trigger (L) if it has one. The sketch also waits 2 s of quiet before counting the next visitor.",
      "A PIR needs about 30 s after power-up to settle and may trigger at random until then. The digit spins while it warms up.",
      "Hold BOOT for three seconds to reset the count. Do not hold it while the board starts: that puts it into download mode.",
      "On the C3 the PIR uses GPIO 10 and the shift register GPIO 4, 5 and 6; GPIO 9 is the BOOT button itself.",
    ],
    sample: [
      "Visitor counter. Warming up the PIR for 30 s.",
      "Counting.",
      "count = 41",
      "count = 42",
      "count = 43",
      "count = 44",
      "count = 45",
      "count = 46",
      "count = 47",
    ],
  },
  {
    id: "auto-fan", needs: [["dcmotor"], ["transistor"], ["ldr"]], name: "Automatic fan", level: "Intermediate", mins: 30, tags: ["sensors", "motion"],
    sum: "A small DC motor fan that speeds up as the room gets brighter, or warmer with a DS18B20. The ESP32 drives it through a transistor with smooth, silent PWM.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    vars: {
      esp32: { MOTOR: "25", LDR: "34", OW: "4" },
      esp32s3: { MOTOR: "5", LDR: "2", OW: "4" },
      esp32c3: { MOTOR: "5", LDR: "3", OW: "4" },
    },
    pins: ["5V", "3V3", "GND", "%MOTOR%", "%LDR%", "%OW%"], libs: ["OneWire", "DallasTemperature"], baud: 115200,
    parts: [
      [1, "ESP32 dev board", BOM.esp32DevKit],
      [1, "Small DC motor (130 size) with a propeller or fan blade"],
      [1, "NPN transistor, PN2222 or 2N2222", BOM.pn2222],
      [1, "1N4001 diode", BOM.diode1n4001],
      [1, "470 Ω resistor, for the transistor's base"],
      [1, "Photoresistor (light sensor)", BOM.photocell],
      [1, "10 kΩ resistor, for the light sensor"],
      [1, "Optional: DS18B20 temperature probe", BOM.ds18b20],
      [1, "Optional: 4.7 kΩ resistor for the DS18B20", BOM.resistor4k7],
      [8, "Jumper wires"],
    ],
    wiring: [
      ["Motor +", "5V", "From USB or a separate 5 V supply, never from a GPIO pin"],
      ["Motor -", "Transistor collector", ""],
      ["Transistor emitter", "GND", "Check your transistor's pin order before wiring: a PN2222A is emitter, base, collector with the flat side facing you, but many parts sold as 2N2222 (such as P2N2222A) are collector, base, emitter"],
      ["Transistor base, through 470 Ω", "GPIO %MOTOR%", "About 5 mA of base current, enough to switch the motor fully on"],
      ["1N4001 across the motor", "Stripe to motor +, other end to motor -", "Catches the voltage spike when the motor switches off. Backwards it shorts the supply"],
      ["Photoresistor", "3V3 to GPIO %LDR%", "Either way round"],
      ["10 kΩ resistor", "GPIO %LDR% to GND", "With the photoresistor, brighter light gives a higher reading"],
      ["Optional: DS18B20 VDD (red)", "3V3", ""],
      ["Optional: DS18B20 GND (black)", "GND", ""],
      ["Optional: DS18B20 DATA (yellow)", "GPIO %OW%", "Then set SOURCE to USE_TEMPERATURE"],
      ["Optional: 4.7 kΩ pull-up resistor", "GPIO %OW% to 3V3", "Holds the probe's data line high"],
    ],
    code: R`// Automatic fan: a small DC motor spins faster as the light gets brighter (a
// sunny window warms a room), or as a DS18B20 reads warmer if you wire one and
// set SOURCE to USE_TEMPERATURE. The motor runs through an NPN transistor with
// a flyback diode; the ESP32 pin only sends the PWM signal.
#include <OneWire.h>
#include <DallasTemperature.h>

const int MOTOR_PIN = %MOTOR%;  // to the transistor's base, through 470 Ω
const int LDR_PIN = %LDR%;      // ADC1 pin: photoresistor and 10 kΩ divider
const int TEMP_PIN = %OW%;      // optional DS18B20 data line (4.7 kΩ pull-up to 3V3)

enum Source { USE_LIGHT, USE_TEMPERATURE };
const Source SOURCE = USE_LIGHT;

const int PWM_HZ = 20000;  // above hearing, so the motor does not whine
const int PWM_BITS = 8;    // duty from 0 to 255
const int MIN_DUTY = 90;   // below this the motor hums but does not turn; tune for yours

// Light mode: fan off in the dark, full speed in bright light (percent of the ADC range).
const int LIGHT_OFF = 20, LIGHT_FULL = 80;
// Temperature mode: fan off below TEMP_OFF, full speed at TEMP_FULL (°C).
const float TEMP_OFF = 24.0, TEMP_FULL = 30.0;

OneWire oneWire(TEMP_PIN);
DallasTemperature probe(&oneWire);
int lastDuty = 0;

// Duty from 0 (off) to 1 (full) for a reading between the off and full points.
float fraction(float value, float off, float full) {
  return constrain((value - off) / (full - off), 0.0f, 1.0f);
}

void setDuty(float f) {
  int duty = f <= 0 ? 0 : MIN_DUTY + (int)roundf(f * (255 - MIN_DUTY));
  if (duty > 0 && lastDuty == 0) {
    ledcWrite(MOTOR_PIN, 255);  // a short kick gets a stopped motor turning
    delay(150);
  }
  ledcWrite(MOTOR_PIN, duty);
  lastDuty = duty;
}

void setup() {
  Serial.begin(115200);
  ledcAttach(MOTOR_PIN, PWM_HZ, PWM_BITS);  // Arduino-ESP32 core 3.x LEDC API
  ledcWrite(MOTOR_PIN, 0);
  analogSetPinAttenuation(LDR_PIN, ADC_11db);
  if (SOURCE == USE_TEMPERATURE) {
    probe.begin();
    if (probe.getDeviceCount() == 0) Serial.println("No DS18B20 found: check the data wire and the 4.7 kΩ pull-up");
  }
  Serial.println(SOURCE == USE_LIGHT ? "Auto fan: following the light" : "Auto fan: following the temperature");
}

void loop() {
  float f;
  if (SOURCE == USE_LIGHT) {
    long sum = 0;
    for (int i = 0; i < 16; i++) sum += analogRead(LDR_PIN);
    const int light = (int)roundf(sum / 16.0f * 100.0f / 4095.0f);
    f = fraction(light, LIGHT_OFF, LIGHT_FULL);
    setDuty(f);
    Serial.printf("light = %d%%, duty = %d%%\n", light, lastDuty * 100 / 255);
  } else {
    probe.requestTemperatures();
    const float c = probe.getTempCByIndex(0);
    if (c == DEVICE_DISCONNECTED_C) {
      setDuty(1);  // fail safe: run the fan if the sensor is lost
      Serial.println("sensor lost: fan on full");
    } else {
      f = fraction(c, TEMP_OFF, TEMP_FULL);
      setDuty(f);
      Serial.printf("temp_c = %.1f, duty = %d%%\n", c, lastDuty * 100 / 255);
    }
  }
  delay(500);
}`,
    open: ["Not tested on hardware yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    notes: [
      "Never run a motor straight from a GPIO pin. The transistor switches the motor's current from the 5 V supply; the pin only drives the transistor's base through 470 Ω. With 1 kΩ the transistor may not switch fully on and runs warm.",
      "The diode matters: a motor is a coil, and when the transistor switches it off the coil kicks back a voltage spike. The diode, stripe towards 5 V, gives that spike somewhere harmless to go.",
      "A PN2222 handles a small 130 motor. A bigger motor, or one that stalls, can draw more than its 600 mA limit and get hot: use a logic-level MOSFET instead.",
      "PWM runs at 20 kHz so the motor does not whine. Below MIN_DUTY a motor hums without turning; tune it until the slowest setting still spins, and the sketch gives a stopped motor a short full-power kick.",
      "A 9 V battery is a poor supply for this: it sags quickly under a motor's load. A USB power bank or a 5 V adapter lasts far longer.",
      "Light mode suits a sunny window that warms a room. For a real temperature fan, wire the DS18B20 and set SOURCE to USE_TEMPERATURE; if the sensor is lost the fan runs at full speed to be safe.",
    ],
    sample: [
      "Auto fan: following the light",
      "light = 12%, duty = 0%",
      "light = 18%, duty = 0%",
      "light = 26%, duty = 41%",
      "light = 35%, duty = 51%",
      "light = 47%, duty = 64%",
      "light = 58%, duty = 76%",
      "light = 66%, duty = 85%",
      "light = 74%, duty = 93%",
      "light = 83%, duty = 100%",
      "light = 88%, duty = 100%",
      "light = 71%, duty = 90%",
      "light = 52%, duty = 69%",
      "light = 30%, duty = 46%",
      "light = 15%, duty = 0%",
    ],
  },
  {
    id: "rfid-reader", needs: [["rc522"], ["led"], ["buzzer"]], name: "RFID card reader", level: "Intermediate", mins: 30, tags: ["input"], added: "2026-11-13",
    sum: "Tap a card or key fob to read its ID. A master card adds and removes cards from an allowed list that survives a power cut, with a green or red light and a beep.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    vars: {
      esp32: { SCK: "18", MISO: "19", MOSI: "23", SS: "21", RST: "22", LEDG: "16", LEDR: "17", BUZZ: "25" },
      esp32s3: { SCK: "12", MISO: "13", MOSI: "11", SS: "10", RST: "14", LEDG: "4", LEDR: "5", BUZZ: "6" },
      esp32c3: { SCK: "4", MISO: "5", MOSI: "6", SS: "7", RST: "10", LEDG: "0", LEDR: "1", BUZZ: "3" },
    },
    pins: ["3V3", "GND", "%SCK%", "%MISO%", "%MOSI%", "%SS%", "%RST%", "%LEDG%", "%LEDR%", "%BUZZ%"],
    libs: ["MFRC522", "SPI (built in)", "Preferences (built in)"], baud: 115200,
    parts: [
      [1, "ESP32 dev board", BOM.esp32DevKit],
      [1, "RC522 RFID reader module (13.56 MHz), with a card and a key fob"],
      [2, "LEDs: green and red"],
      [2, "220 Ω resistors"],
      [1, "Passive buzzer or piezo", BOM.piezoBuzzer],
      [14, "Jumper wires"],
    ],
    wiring: [
      ["RC522 VCC (3.3V)", "3V3", "3.3 V only: the RC522 is not 5 V tolerant"],
      ["RC522 GND", "GND", ""],
      ["RC522 RST", "GPIO %RST%", ""],
      ["RC522 SDA (SS)", "GPIO %SS%", "On the RC522 the pin labelled SDA is the SPI chip select"],
      ["RC522 SCK", "GPIO %SCK%", ""],
      ["RC522 MOSI", "GPIO %MOSI%", ""],
      ["RC522 MISO", "GPIO %MISO%", ""],
      ["Green LED anode, through 220 Ω", "GPIO %LEDG%", "The anode is the longer leg"],
      ["Green LED cathode", "GND", ""],
      ["Red LED anode, through 220 Ω", "GPIO %LEDR%", ""],
      ["Red LED cathode", "GND", ""],
      ["Buzzer +", "GPIO %BUZZ%", ""],
      ["Buzzer -", "GND", ""],
    ],
    code: R`// RFID card reader: tap a card to see its ID. The first card tapped becomes the
// master card; tap the master, then any card, to add it to or remove it from the
// allowed list. The list is kept in flash, so it survives a power cut.
#include <SPI.h>
#include <MFRC522.h>
#include <Preferences.h>

const int PIN_SCK = %SCK%, PIN_MISO = %MISO%, PIN_MOSI = %MOSI%, PIN_SS = %SS%, PIN_RST = %RST%;
const int LED_OK = %LEDG%;   // green
const int LED_NO = %LEDR%;   // red
const int BUZZER = %BUZZ%;
const int MAX_CARDS = 20;

MFRC522 rfid(PIN_SS, PIN_RST);
Preferences prefs;
String master;
String allowed[MAX_CARDS];
int count = 0;
bool learning = false;  // after the master card, the next card is added or removed

String uidText(const MFRC522::Uid& uid) {
  String s;
  for (byte i = 0; i < uid.size; i++) {
    if (i) s += ':';
    if (uid.uidByte[i] < 0x10) s += '0';
    s += String(uid.uidByte[i], HEX);
  }
  s.toUpperCase();
  return s;
}

void save() {
  prefs.putString("master", master);
  prefs.putInt("count", count);
  for (int i = 0; i < count; i++) prefs.putString(("c" + String(i)).c_str(), allowed[i]);
}

void load() {
  master = prefs.getString("master", "");
  count = constrain(prefs.getInt("count", 0), 0, MAX_CARDS);
  for (int i = 0; i < count; i++) allowed[i] = prefs.getString(("c" + String(i)).c_str(), "");
}

int find(const String& uid) {
  for (int i = 0; i < count; i++) {
    if (allowed[i] == uid) return i;
  }
  return -1;
}

void signal(bool ok, int beeps) {
  digitalWrite(ok ? LED_OK : LED_NO, HIGH);
  for (int i = 0; i < beeps; i++) {
    tone(BUZZER, ok ? 2000 : 400, 120);
    delay(180);
  }
  delay(400);
  digitalWrite(LED_OK, LOW);
  digitalWrite(LED_NO, LOW);
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_OK, OUTPUT);
  pinMode(LED_NO, OUTPUT);
  prefs.begin("rfid", false);
  load();
  SPI.begin(PIN_SCK, PIN_MISO, PIN_MOSI, PIN_SS);
  rfid.PCD_Init();
  delay(10);
  const byte version = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  if (version == 0x00 || version == 0xFF) {
    Serial.println("RC522 not found: check 3V3, GND and the SPI wires");
  } else {
    Serial.printf("RC522 ready, chip version 0x%02X\n", version);
  }
  if (master.isEmpty()) {
    Serial.println("No master card yet: tap one to make it the master");
  } else {
    Serial.printf("Master card %s, %d allowed cards\n", master.c_str(), count);
  }
  Serial.println("Tap a card");
}

void loop() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;
  const String uid = uidText(rfid.uid);
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  if (master.isEmpty()) {
    master = uid;
    save();
    Serial.printf("card %s is now the master card\n", uid.c_str());
    signal(true, 3);
    return;
  }
  if (uid == master) {
    learning = !learning;
    Serial.println(learning ? "learn mode: tap a card to add or remove it" : "learn mode off");
    signal(true, 2);
    return;
  }
  if (learning) {
    learning = false;
    const int i = find(uid);
    if (i >= 0) {
      allowed[i] = allowed[--count];
      Serial.printf("card %s removed, %d allowed\n", uid.c_str(), count);
      signal(false, 1);
    } else if (count < MAX_CARDS) {
      allowed[count++] = uid;
      Serial.printf("card %s added, %d allowed\n", uid.c_str(), count);
      signal(true, 1);
    } else {
      Serial.println("the allowed list is full");
      signal(false, 3);
    }
    save();
    return;
  }
  if (find(uid) >= 0) {
    Serial.printf("card %s allowed\n", uid.c_str());
    signal(true, 1);
  } else {
    Serial.printf("card %s denied\n", uid.c_str());
    signal(false, 2);
  }
}
`,
    open: ["Not tested on hardware yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    notes: [
      "The RC522 runs on 3.3 V only. Its pins are not 5 V tolerant, so power it from 3V3 and never from 5V.",
      "The pin labelled SDA on the RC522 is the SPI chip select here, not I2C. IRQ stays unconnected.",
      "The first card tapped after a fresh flash becomes the master card. Erasing the whole flash clears the master and the allowed list.",
      "The RC522 reads common 13.56 MHz MIFARE cards and fobs. 125 kHz access cards, the kind many offices use, need a different reader.",
      "Card IDs are not secret: anyone can read them, and some cards can be cloned. Fine for a demo or a toy lock, not for real security.",
    ],
    sample: [
      "RC522 ready, chip version 0x92",
      "No master card yet: tap one to make it the master",
      "Tap a card",
      "card 3A:1F:9C:44 is now the master card",
      "learn mode: tap a card to add or remove it",
      "card 04:8B:2C:6A added, 1 allowed",
      "card 04:8B:2C:6A allowed",
      "card D3:77:10:2E denied",
      "learn mode: tap a card to add or remove it",
      "card D3:77:10:2E added, 2 allowed",
      "card D3:77:10:2E allowed",
    ],
  },
  {
    id: "ir-remote", needs: [["irreceiver"], ["led"]], name: "IR remote decoder", level: "Starter", mins: 20, tags: ["input", "lights"], added: "2026-11-13",
    sum: "Point any TV or kit remote at an IR receiver and see each button's protocol and code on the bench. Teach it three buttons and they switch three LEDs.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    vars: {
      esp32: { IR: "4", LA: "16", LB: "17", LC: "18" },
      esp32s3: { IR: "4", LA: "5", LB: "6", LC: "7" },
      esp32c3: { IR: "10", LA: "0", LB: "1", LC: "3" },
    },
    pins: ["3V3", "GND", "%IR%", "%LA%", "%LB%", "%LC%"],
    libs: ["IRremoteESP8266", "Preferences (built in)"], baud: 115200,
    parts: [
      [1, "ESP32 dev board", BOM.esp32DevKit],
      [1, "IR receiver: a VS1838B or TSOP38238 on its own, or a 3-pin receiver module"],
      [1, "Any infrared remote control: a TV remote or the one from a starter kit"],
      [3, "LEDs: red, green and yellow"],
      [3, "220 Ω resistors"],
      [10, "Jumper wires"],
    ],
    wiring: [
      ["IR receiver VCC", "3V3", "Most receivers and modules work at 3.3 V. Check the pin order on yours: it differs between parts"],
      ["IR receiver GND", "GND", ""],
      ["IR receiver OUT", "GPIO %IR%", ""],
      ["Red LED anode, through 220 Ω", "GPIO %LA%", "The anode is the longer leg"],
      ["Red LED cathode", "GND", ""],
      ["Green LED anode, through 220 Ω", "GPIO %LB%", ""],
      ["Green LED cathode", "GND", ""],
      ["Yellow LED anode, through 220 Ω", "GPIO %LC%", ""],
      ["Yellow LED cathode", "GND", ""],
    ],
    code: R`// IR remote decoder: prints each button's protocol and code, and toggles three
// LEDs with three buttons you teach it. Type "learn" on the bench to teach again.
#include <IRremoteESP8266.h>
#include <IRrecv.h>
#include <IRutils.h>
#include <Preferences.h>

const uint16_t IR_PIN = %IR%;
const int LEDS[3] = {%LA%, %LB%, %LC%};
const char* NAMES[3] = {"red", "green", "yellow"};

IRrecv irrecv(IR_PIN, 1024, 15, true);
decode_results results;
Preferences prefs;
uint64_t learned[3];
bool lit[3];
int learning = 0;  // how many buttons are still to learn, counting down from 3

void startLearning() {
  learning = 3;
  Serial.println("learn: press three different buttons for the red, green and yellow LED");
}

void setup() {
  Serial.begin(115200);
  for (int i = 0; i < 3; i++) pinMode(LEDS[i], OUTPUT);
  prefs.begin("ir", false);
  for (int i = 0; i < 3; i++) learned[i] = prefs.getULong64(("b" + String(i)).c_str(), 0);
  irrecv.enableIRIn();
  Serial.printf("IR remote decoder, receiver on GPIO %d\n", IR_PIN);
  if (learned[0] == 0 || learned[1] == 0 || learned[2] == 0) startLearning();
  else Serial.println("Buttons learned: type learn to teach new ones");
}

void loop() {
  if (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line == "learn") startLearning();
  }
  if (!irrecv.decode(&results)) return;
  if (results.repeat || results.decode_type == decode_type_t::UNKNOWN) {
    irrecv.resume();
    return;
  }
  const uint64_t code = results.value;
  Serial.printf("protocol %s, address 0x%X, command 0x%X, code 0x%s\n", typeToString(results.decode_type).c_str(),
                (unsigned)results.address, (unsigned)results.command, uint64ToString(code, 16).c_str());

  if (learning > 0) {
    const int slot = 3 - learning;
    bool used = false;
    for (int i = 0; i < slot; i++) used = used || learned[i] == code;
    if (used) {
      Serial.println("that button is taken: press a different one");
    } else {
      learned[slot] = code;
      prefs.putULong64(("b" + String(slot)).c_str(), code);
      Serial.printf("%s LED learned\n", NAMES[slot]);
      if (--learning == 0) Serial.println("learned all three buttons");
    }
  } else {
    for (int i = 0; i < 3; i++) {
      if (learned[i] != code) continue;
      lit[i] = !lit[i];
      digitalWrite(LEDS[i], lit[i] ? HIGH : LOW);
      Serial.printf("%s LED %s\n", NAMES[i], lit[i] ? "on" : "off");
    }
  }
  irrecv.resume();
}
`,
    open: ["Not tested on hardware yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    notes: [
      "Bare VS1838B and TSOP-style receivers have different pin orders. Look up yours, or use a 3-pin module with the pins labelled.",
      "Most receivers run fine at 3.3 V. A receiver powered from 5 V would send 5 V into the ESP32, so keep it on 3V3.",
      "Held buttons send repeat codes, which the sketch ignores, so holding a button does not flicker the LED.",
      "Some remotes, air conditioners in particular, send very long codes. The decoder still prints them; the LEDs just need a different button.",
      "Keep the receiver out of direct sunlight and away from bright lamps: both are full of infrared and drown out the remote.",
    ],
    sample: [
      "IR remote decoder, receiver on GPIO 4",
      "learn: press three different buttons for the red, green and yellow LED",
      "protocol NEC, address 0x0, command 0x45, code 0xFFA25D",
      "red LED learned",
      "protocol NEC, address 0x0, command 0x46, code 0xFF629D",
      "green LED learned",
      "protocol NEC, address 0x0, command 0x47, code 0xFFE21D",
      "yellow LED learned",
      "learned all three buttons",
      "protocol NEC, address 0x0, command 0x45, code 0xFFA25D",
      "red LED on",
      "protocol SAMSUNG, address 0x7, command 0x2, code 0xE0E040BF",
    ],
  },
  {
    id: "stepper-28byj", needs: [["stepper"]], name: "Stepper motor control", level: "Intermediate", mins: 25, tags: ["motion"], added: "2026-11-13",
    sum: "Drive the 28BYJ-48 stepper from almost every starter kit through its ULN2003 board: smooth acceleration, exact positions, and commands typed on the bench.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    vars: {
      esp32: { INA: "16", INB: "17", INC: "18", IND: "19" },
      esp32s3: { INA: "4", INB: "5", INC: "6", IND: "7" },
      esp32c3: { INA: "4", INB: "5", INC: "6", IND: "7" },
    },
    pins: ["GND", "%INA%", "%INB%", "%INC%", "%IND%"],
    libs: ["AccelStepper"], baud: 115200,
    parts: [
      [1, "ESP32 dev board", BOM.esp32DevKit],
      [1, "28BYJ-48 5 V stepper motor"],
      [1, "ULN2003 stepper driver board"],
      [1, "5 V supply for the motor, such as a USB power bank or a 5 V adapter"],
      [8, "Jumper wires"],
    ],
    wiring: [
      ["ULN2003 IN1", "GPIO %INA%", ""],
      ["ULN2003 IN2", "GPIO %INB%", ""],
      ["ULN2003 IN3", "GPIO %INC%", ""],
      ["ULN2003 IN4", "GPIO %IND%", ""],
      ["28BYJ-48 plug", "ULN2003 socket", "The white plug is keyed: it fits one way"],
      ["ULN2003 +", "5 V supply +", "Not the ESP32's 3V3 pin. The motor draws about 240 mA"],
      ["ULN2003 -", "GND", ""],
      ["5 V supply -", "GND", "Joins the motor supply's ground to the ESP32's"],
    ],
    code: R`// 28BYJ-48 stepper through a ULN2003 board, with acceleration (AccelStepper).
// Commands on the bench: go <steps> (negative goes back), speed <rpm>, home.
#include <AccelStepper.h>

const int IN1 = %INA%, IN2 = %INB%, IN3 = %INC%, IN4 = %IND%;
// Half steps: nominally 4096 per turn of the output shaft. The gearbox is really
// about 63.68:1, so a full turn is closer to 4076.
const float STEPS_PER_REV = 4096;
const float MAX_RPM = 15;  // above this the motor stalls and just buzzes

// The 28BYJ-48 needs the coils energised in the order IN1, IN3, IN2, IN4.
AccelStepper stepper(AccelStepper::HALF4WIRE, IN1, IN3, IN2, IN4);
unsigned long lastReport = 0;
bool moving = false;

void setRpm(float rpm) {
  rpm = constrain(rpm, 1.0f, MAX_RPM);
  stepper.setMaxSpeed(rpm * STEPS_PER_REV / 60);
  Serial.printf("speed %.1f rpm\n", rpm);
}

void command(String line) {
  line.trim();
  if (line.startsWith("go ")) {
    const long steps = line.substring(3).toInt();
    stepper.enableOutputs();
    stepper.move(steps);
    Serial.printf("going %ld steps\n", steps);
  } else if (line.startsWith("speed ")) {
    setRpm(line.substring(6).toFloat());
  } else if (line == "home") {
    stepper.enableOutputs();
    stepper.moveTo(0);
    Serial.println("going home");
  } else if (line.length()) {
    Serial.println("commands: go <steps>, speed <rpm>, home");
  }
}

void setup() {
  Serial.begin(115200);
  stepper.setAcceleration(800);
  setRpm(10);
  stepper.disableOutputs();
  Serial.println("Stepper ready. Commands: go <steps>, speed <rpm>, home");
  Serial.printf("One turn is about %.0f steps\n", STEPS_PER_REV);
}

void loop() {
  if (Serial.available()) command(Serial.readStringUntil('\n'));
  stepper.run();
  const bool now = stepper.distanceToGo() != 0;
  if (now && millis() - lastReport >= 200) {
    lastReport = millis();
    Serial.printf("position = %ld, target = %ld\n", stepper.currentPosition(), stepper.targetPosition());
  }
  if (moving && !now) {
    Serial.printf("position = %ld, target = %ld\n", stepper.currentPosition(), stepper.targetPosition());
    Serial.println("arrived");
    stepper.disableOutputs();  // the coils get warm if left on
  }
  moving = now;
}
`,
    open: ["Not tested on hardware yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    notes: [
      "Power the ULN2003 board from a 5 V supply, never from the ESP32's 3V3 pin. Join the supply's ground to the ESP32's ground, or the board will not see the step signals.",
      "In half steps the output shaft turns once in nominally 4096 steps. The gearbox is really about 63.68:1, so expect a full turn to be closer to 4076, and allow for a little backlash when changing direction.",
      "Around 15 rpm is the most a 28BYJ-48 manages. Ask for more and it buzzes without turning; the sketch caps the speed there.",
      "The coils are switched off once the motor arrives, so it stays cool. It can then be turned by hand, which loses the position: use home before relying on it again.",
      "The four LEDs on the ULN2003 board show which coils are on: a slow chase means the wiring is right.",
    ],
    sample: [
      "speed 10.0 rpm",
      "Stepper ready. Commands: go <steps>, speed <rpm>, home",
      "One turn is about 4096 steps",
      "going 2048 steps",
      "position = 61, target = 2048",
      "position = 245, target = 2048",
      "position = 552, target = 2048",
      "position = 892, target = 2048",
      "position = 1233, target = 2048",
      "position = 1573, target = 2048",
      "position = 1880, target = 2048",
      "position = 2048, target = 2048",
      "arrived",
      "going home",
      "position = 1987, target = 0",
      "position = 1803, target = 0",
    ],
  },
  {
    id: "keypad-lock", needs: [["keypad"], ["servo"], ["buzzer"]], name: "Keypad code lock", level: "Intermediate", mins: 35, tags: ["input", "motion", "games"], added: "2026-11-13",
    sum: "A 4x4 keypad and a servo latch make a code lock. Change the code from the keypad; wrong guesses lock it out for longer each time.",
    boards: ["esp32", "esp32s3"],
    vars: {
      esp32: { RA: "32", RB: "33", RC: "25", RD: "26", CA: "27", CB: "4", CC: "16", CD: "17", SERVO: "18", BUZZ: "19" },
      esp32s3: { RA: "4", RB: "5", RC: "6", RD: "7", CA: "15", CB: "16", CC: "17", CD: "10", SERVO: "11", BUZZ: "12" },
    },
    pins: ["5V", "GND", "%RA%", "%RB%", "%RC%", "%RD%", "%CA%", "%CB%", "%CC%", "%CD%", "%SERVO%", "%BUZZ%"],
    libs: ["Keypad", "ESP32Servo", "Preferences (built in)"], baud: 115200,
    parts: [
      [1, "ESP32 dev board", BOM.esp32DevKit],
      [1, "4x4 membrane keypad"],
      [1, "Micro servo, SG90 or SG92R class, as the latch", BOM.microServo],
      [1, "Passive buzzer or piezo", BOM.piezoBuzzer],
      [14, "Jumper wires"],
    ],
    wiring: [
      ["Keypad R1 (pin 1)", "GPIO %RA%", "Pins counted from the left with the keys facing you"],
      ["Keypad R2 (pin 2)", "GPIO %RB%", ""],
      ["Keypad R3 (pin 3)", "GPIO %RC%", ""],
      ["Keypad R4 (pin 4)", "GPIO %RD%", ""],
      ["Keypad C1 (pin 5)", "GPIO %CA%", ""],
      ["Keypad C2 (pin 6)", "GPIO %CB%", ""],
      ["Keypad C3 (pin 7)", "GPIO %CC%", ""],
      ["Keypad C4 (pin 8)", "GPIO %CD%", ""],
      ["Servo red (power)", "5V", "One micro servo is fine from USB"],
      ["Servo brown or black (ground)", "GND", ""],
      ["Servo orange or yellow (signal)", "GPIO %SERVO%", ""],
      ["Buzzer +", "GPIO %BUZZ%", ""],
      ["Buzzer -", "GND", ""],
    ],
    code: R`// Keypad code lock: type the code and # to open the servo latch.
// * starts a code change: old code #, new code #. C clears, A locks again.
// Wrong codes lock the keypad out, for longer each time.
#include <Keypad.h>
#include <ESP32Servo.h>
#include <Preferences.h>

const byte ROWS = 4, COLS = 4;
char KEYS[ROWS][COLS] = {
  {'1', '2', '3', 'A'},
  {'4', '5', '6', 'B'},
  {'7', '8', '9', 'C'},
  {'*', '0', '#', 'D'},
};
byte rowPins[ROWS] = {%RA%, %RB%, %RC%, %RD%};
byte colPins[COLS] = {%CA%, %CB%, %CC%, %CD%};
const int SERVO_PIN = %SERVO%, BUZZER = %BUZZ%;
const int LOCKED_ANGLE = 0, OPEN_ANGLE = 90;
const unsigned long RELOCK_MS = 5000;

Keypad keypad = Keypad(makeKeymap(KEYS), rowPins, colPins, ROWS, COLS);
Servo latch;
Preferences prefs;
String code, entry;
enum Mode { ENTER, CHANGE_OLD, CHANGE_NEW } mode = ENTER;
int wrong = 0;
unsigned long lockedUntil = 0, openedAt = 0;
bool isOpen = false;

void beep(int hz, int ms) {
  tone(BUZZER, hz, ms);
  delay(ms + 30);
}

void setOpen(bool on) {
  isOpen = on;
  latch.write(on ? OPEN_ANGLE : LOCKED_ANGLE);
  openedAt = millis();
  Serial.println(on ? "unlocked" : "locked");
}

void wrongCode() {
  wrong++;
  beep(300, 400);
  if (wrong >= 3) {
    const unsigned long seconds = min(300UL, 10UL << min(wrong - 3, 5));  // 10 s, 20 s, 40 s ... up to 5 min
    lockedUntil = millis() + seconds * 1000;
    Serial.printf("wrong code, keypad locked out for %lu s\n", seconds);
  } else {
    Serial.printf("wrong code, %d tries before a lockout\n", 3 - wrong);
  }
}

void finish() {
  if (mode == ENTER) {
    if (entry == code) {
      wrong = 0;
      beep(2000, 120);
      setOpen(true);
    } else {
      wrongCode();
    }
  } else if (mode == CHANGE_OLD) {
    if (entry == code) {
      mode = CHANGE_NEW;
      Serial.println("enter the new code, then #");
      beep(1500, 80);
    } else {
      mode = ENTER;
      wrongCode();
    }
  } else {
    if (entry.length() >= 4) {
      code = entry;
      prefs.putString("code", code);
      Serial.printf("code changed, %u digits\n", code.length());
      beep(2000, 120);
      beep(2500, 120);
    } else {
      Serial.println("a code needs at least 4 digits: not changed");
      beep(300, 300);
    }
    mode = ENTER;
  }
  entry = "";
}

void setup() {
  Serial.begin(115200);
  prefs.begin("lock", false);
  code = prefs.getString("code", "1234");
  latch.attach(SERVO_PIN);
  setOpen(false);
  Serial.printf("Keypad lock ready, code length %u. Type the code and #\n", code.length());
  if (code == "1234") Serial.println("Still on the default code 1234: press * to change it");
}

void loop() {
  if (isOpen && millis() - openedAt > RELOCK_MS) setOpen(false);
  const char key = keypad.getKey();
  if (!key) return;
  if (millis() < lockedUntil) {
    Serial.printf("locked out for %lu more s\n", (lockedUntil - millis()) / 1000 + 1);
    beep(300, 100);
    return;
  }
  beep(1200, 30);
  if (key >= '0' && key <= '9') {
    if (entry.length() < 12) entry += key;
    Serial.printf("entry %u digits\n", entry.length());  // never print the digits themselves
  } else if (key == '#') {
    finish();
  } else if (key == '*') {
    mode = CHANGE_OLD;
    entry = "";
    Serial.println("change code: enter the current code, then #");
  } else if (key == 'C') {
    entry = "";
    mode = ENTER;
    Serial.println("cleared");
  } else if (key == 'A' && isOpen) {
    setOpen(false);
  }
}
`,
    open: ["Not tested on hardware yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    notes: [
      "The keypad needs eight GPIOs, plus the servo and the buzzer. The ESP32-C3 DevKitM has only eight pins free of boot, USB and console duties, so this project is for the classic ESP32 and the S3.",
      "Most 4x4 membrane keypads put the four row wires first and the four column wires last, counting from the left with the keys facing you. If keys come out mixed up, swap the row and column groups in the sketch.",
      "The default code is 1234. Press *, type 1234 and #, then the new code (4 to 12 digits) and #. It is saved in flash.",
      "After three wrong codes the keypad locks out for 10 s, then 20 s, 40 s and so on, up to 5 minutes. A correct code resets the count.",
      "The serial output never shows the digits typed, only how many. This is a toy lock: anyone with the board and a USB cable can reflash it.",
    ],
    sample: [
      "locked",
      "Keypad lock ready, code length 4. Type the code and #",
      "Still on the default code 1234: press * to change it",
      "entry 1 digits",
      "entry 2 digits",
      "entry 3 digits",
      "entry 4 digits",
      "unlocked",
      "locked",
      "entry 1 digits",
      "entry 2 digits",
      "entry 3 digits",
      "entry 4 digits",
      "wrong code, 2 tries before a lockout",
    ],
  },
  {
    id: "ph-display", needs: [["oled"]], name: "ProbeHarbor readout display", level: "Intermediate", mins: 20, tags: ["probeharbor", "display", "wireless"],
    probeharbor: "reads",
    sum: "Show your ProbeHarbor sensors on a small OLED by the door: each probe's latest reading, how old it is, and a flashing warning for freezing, water or lost power.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    vars: {
      esp32: { SDA: "21", SCL: "22", BTN: "0" },
      esp32s3: { SDA: "8", SCL: "9", BTN: "0" },
      esp32c3: { SDA: "6", SCL: "7", BTN: "9" },
    },
    pins: ["3V3", "GND", "%SDA%", "%SCL%", "%BTN%"],
    libs: ["ArduinoJson", "Adafruit SSD1306", "Adafruit GFX Library", "WiFi (built in)", "HTTPClient (built in)"],
    baud: 115200,
    parts: [
      [1, "ESP32 dev board", BOM.esp32DevKit],
      [1, "0.96 inch SSD1306 OLED, I2C, address 0x3C"],
      [4, "Jumper wires"],
    ],
    wiring: [
      ["OLED VCC", "3V3", ""],
      ["OLED GND", "GND", ""],
      ["OLED SDA", "GPIO %SDA%", "Same I2C pins as the other OLED projects"],
      ["OLED SCL", "GPIO %SCL%", ""],
      ["BOOT button", "GPIO %BTN%", "Already on the board. Press it to show the next sensor"],
    ],
    code: R`// ProbeHarbor readout: shows your ProbeHarbor sensors on an OLED, one per page.
// Reads a ProbeHarbor share link (read-only, works on the free plan) once a minute.
// Libraries: ArduinoJson, Adafruit SSD1306, Adafruit GFX.
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>
#include <time.h>

// ---- Your settings ----
const char* WIFI_SSID = "your-wifi";
const char* WIFI_PASS = "your-password";
// ProbeHarbor: Dashboard, Share, create a live link, copy its readings address.
const char* SHARE_URL = "https://probeharbor.dev/api/share/YOUR_SHARE_TOKEN/readings";
const unsigned REFRESH_SECONDS = 60;  // ProbeHarbor allows 60 requests a minute per link
const unsigned PAGE_SECONDS = 5;      // how long each sensor stays on screen
const float FREEZE_F = 35.0;          // temperatures at or below this flash a warning
// Probes meant to be cold (a freezer, a fridge) never raise the freeze warning.
// Any sensor or device whose name contains one of these words is left out.
const char* COLD_ON_PURPOSE[] = {"Freezer", "Fridge"};
const unsigned STALE_MINUTES = 30;    // readings older than this are marked stale
String wifiSsid, wifiPass, shareUrl;

// ---- Pins ----
const int SDA_PIN = %SDA%;
const int SCL_PIN = %SCL%;
const int BUTTON = %BTN%;  // the BOOT button: next sensor

// Root certificates for probeharbor.dev: Google Trust Services R1 and R4, and
// Let's Encrypt ISRG X1 and X2. Cloudflare issues the site's certificate from one of these.
const char* ROOT_CAS = R"PEM(
-----BEGIN CERTIFICATE-----
MIIFVzCCAz+gAwIBAgINAgPlk28xsBNJiGuiFzANBgkqhkiG9w0BAQwFADBHMQsw
CQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2VzIExMQzEU
MBIGA1UEAxMLR1RTIFJvb3QgUjEwHhcNMTYwNjIyMDAwMDAwWhcNMzYwNjIyMDAw
MDAwWjBHMQswCQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZp
Y2VzIExMQzEUMBIGA1UEAxMLR1RTIFJvb3QgUjEwggIiMA0GCSqGSIb3DQEBAQUA
A4ICDwAwggIKAoICAQC2EQKLHuOhd5s73L+UPreVp0A8of2C+X0yBoJx9vaMf/vo
27xqLpeXo4xL+Sv2sfnOhB2x+cWX3u+58qPpvBKJXqeqUqv4IyfLpLGcY9vXmX7w
Cl7raKb0xlpHDU0QM+NOsROjyBhsS+z8CZDfnWQpJSMHobTSPS5g4M/SCYe7zUjw
TcLCeoiKu7rPWRnWr4+wB7CeMfGCwcDfLqZtbBkOtdh+JhpFAz2weaSUKK0Pfybl
qAj+lug8aJRT7oM6iCsVlgmy4HqMLnXWnOunVmSPlk9orj2XwoSPwLxAwAtcvfaH
szVsrBhQf4TgTM2S0yDpM7xSma8ytSmzJSq0SPly4cpk9+aCEI3oncKKiPo4Zor8
Y/kB+Xj9e1x3+naH+uzfsQ55lVe0vSbv1gHR6xYKu44LtcXFilWr06zqkUspzBmk
MiVOKvFlRNACzqrOSbTqn3yDsEB750Orp2yjj32JgfpMpf/VjsPOS+C12LOORc92
wO1AK/1TD7Cn1TsNsYqiA94xrcx36m97PtbfkSIS5r762DL8EGMUUXLeXdYWk70p
aDPvOmbsB4om3xPXV2V4J95eSRQAogB/mqghtqmxlbCluQ0WEdrHbEg8QOB+DVrN
VjzRlwW5y0vtOUucxD/SVRNuJLDWcfr0wbrM7Rv1/oFB2ACYPTrIrnqYNxgFlQID
AQABo0IwQDAOBgNVHQ8BAf8EBAMCAYYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4E
FgQU5K8rJnEaK0gnhS9SZizv8IkTcT4wDQYJKoZIhvcNAQEMBQADggIBAJ+qQibb
C5u+/x6Wki4+omVKapi6Ist9wTrYggoGxval3sBOh2Z5ofmmWJyq+bXmYOfg6LEe
QkEzCzc9zolwFcq1JKjPa7XSQCGYzyI0zzvFIoTgxQ6KfF2I5DUkzps+GlQebtuy
h6f88/qBVRRiClmpIgUxPoLW7ttXNLwzldMXG+gnoot7TiYaelpkttGsN/H9oPM4
7HLwEXWdyzRSjeZ2axfG34arJ45JK3VmgRAhpuo+9K4l/3wV3s6MJT/KYnAK9y8J
ZgfIPxz88NtFMN9iiMG1D53Dn0reWVlHxYciNuaCp+0KueIHoI17eko8cdLiA6Ef
MgfdG+RCzgwARWGAtQsgWSl4vflVy2PFPEz0tv/bal8xa5meLMFrUKTX5hgUvYU/
Z6tGn6D/Qqc6f1zLXbBwHSs09dR2CQzreExZBfMzQsNhFRAbd03OIozUhfJFfbdT
6u9AWpQKXCBfTkBdYiJ23//OYb2MI3jSNwLgjt7RETeJ9r/tSQdirpLsQBqvFAnZ
0E6yove+7u7Y/9waLd64NnHi/Hm3lCXRSHNboTXns5lndcEZOitHTtNCjv0xyBZm
2tIMPNuzjsmhDYAPexZ3FL//2wmUspO8IFgV6dtxQ/PeEMMA3KgqlbbC1j+Qa3bb
bP6MvPJwNQzcmRk13NfIRmPVNnGuV/u3gm3c
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
MIICCTCCAY6gAwIBAgINAgPlwGjvYxqccpBQUjAKBggqhkjOPQQDAzBHMQswCQYD
VQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2VzIExMQzEUMBIG
A1UEAxMLR1RTIFJvb3QgUjQwHhcNMTYwNjIyMDAwMDAwWhcNMzYwNjIyMDAwMDAw
WjBHMQswCQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2Vz
IExMQzEUMBIGA1UEAxMLR1RTIFJvb3QgUjQwdjAQBgcqhkjOPQIBBgUrgQQAIgNi
AATzdHOnaItgrkO4NcWBMHtLSZ37wWHO5t5GvWvVYRg1rkDdc/eJkTBa6zzuhXyi
QHY7qca4R9gq55KRanPpsXI5nymfopjTX15YhmUPoYRlBtHci8nHc8iMai/lxKvR
HYqjQjBAMA4GA1UdDwEB/wQEAwIBhjAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQW
BBSATNbrdP9JNqPV2Py1PsVq8JQdjDAKBggqhkjOPQQDAwNpADBmAjEA6ED/g94D
9J+uHXqnLrmvT/aDHQ4thQEd0dlq7A/Cr8deVl5c1RxYIigL9zC2L7F8AjEA8GE8
p/SgguMh1YQdc4acLa/KNJvxn7kjNuK8YAOdgLOaVsjh4rsUecrNIdSUtUlD
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4
WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu
ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY
MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc
h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+
0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U
A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW
T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH
B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC
B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv
KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn
OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn
jh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw
qHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI
rU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV
HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq
hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL
ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ
3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK
NFtY2PwByVS5uCbMiogziUwthDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5
ORAzI4JMPJ+GslWYHb4phowim57iaztXOoJwTdwJx4nLCgdNbOhdjsnvzqvHu7Ur
TkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIuvtd7u+Nxe5AW0wdeRlN8NwdC
jNPElpzVmbUq4JUagEiuTDkHzsxHpFKVK7q4+63SM1N95R1NbdWhscdCb+ZAJzVc
oyi3B43njTOQ5yOf+1CceWxG1bQVs5ZufpsMljq4Ui0/1lvh+wjChP4kqKOJ2qxq
4RgqsahDYVvTH9w7jXbyLeiNdd8XM2w9U/t7y0Ff/9yi0GE44Za4rF2LN9d11TPA
mRGunUHBcnWEvgJBQl9nJEiU0Zsnvgc/ubhPgXRR4Xq37Z0j4r7g1SgEEzwxA57d
emyPxgcYxn/eR44/KJ4EBs+lVDR3veyJm+kXQ99b21/+jh5Xos1AnX5iItreGCc=
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
MIICGzCCAaGgAwIBAgIQQdKd0XLq7qeAwSxs6S+HUjAKBggqhkjOPQQDAzBPMQsw
CQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJuZXQgU2VjdXJpdHkgUmVzZWFyY2gg
R3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBYMjAeFw0yMDA5MDQwMDAwMDBaFw00
MDA5MTcxNjAwMDBaME8xCzAJBgNVBAYTAlVTMSkwJwYDVQQKEyBJbnRlcm5ldCBT
ZWN1cml0eSBSZXNlYXJjaCBHcm91cDEVMBMGA1UEAxMMSVNSRyBSb290IFgyMHYw
EAYHKoZIzj0CAQYFK4EEACIDYgAEzZvVn4CDCuwJSvMWSj5cz3es3mcFDR0HttwW
+1qLFNvicWDEukWVEYmO6gbf9yoWHKS5xcUy4APgHoIYOIvXRdgKam7mAHf7AlF9
ItgKbppbd9/w+kHsOdx1ymgHDB/qo0IwQDAOBgNVHQ8BAf8EBAMCAQYwDwYDVR0T
AQH/BAUwAwEB/zAdBgNVHQ4EFgQUfEKWrt5LSDv6kviejM9ti6lyN5UwCgYIKoZI
zj0EAwMDaAAwZQIwe3lORlCEwkSHRhtFcP9Ymd70/aTSVaYgLXTWNLxBo1BfASdW
tL4ndQavEi51mI38AjEAi/V3bNTIZargCyzuFJ0nN6T5U6VR5CmD1/iQMVtCnwr1
/q4AaOeMSQ+2b1tbFfLn
-----END CERTIFICATE-----
)PEM";

Adafruit_SSD1306 oled(128, 64, &Wire, -1);

struct Reading {
  char device[24];
  char label[24];
  char kind[14];
  char unit[10];
  bool hasNum, hasBool;
  float num;
  bool flag;
  time_t at;
};
const int MAX_READINGS = 16;
Reading readings[MAX_READINGS];
int count = 0, page = 0;
char status[40] = "Starting";
unsigned long lastFetch = 0, lastPage = 0, retryAfterMs = 0;

${benchSettings(["wifi_ssid", "wifi_pass", "share_url"])}

// Days since 1970-01-01 for a civil date (Howard Hinnant's algorithm), so we can
// turn "2026-11-12T15:50:44Z" into a UTC timestamp without timegm().
long daysFromCivil(int y, unsigned m, unsigned d) {
  y -= m <= 2;
  const long era = (y >= 0 ? y : y - 399) / 400;
  const unsigned yoe = (unsigned)(y - era * 400);
  const unsigned doy = (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1;
  const unsigned doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
  return era * 146097 + (long)doe - 719468;
}

time_t parseTime(const char* s) {
  int Y, M, D, h, m, sec;
  if (!s || sscanf(s, "%4d-%2d-%2d%*c%2d:%2d:%2d", &Y, &M, &D, &h, &m, &sec) != 6) return 0;
  time_t t = (time_t)daysFromCivil(Y, M, D) * 86400 + h * 3600 + m * 60 + sec;
  // Optional offset after the seconds: Z, +HH, +HH:MM, -HHMM ...
  const char* p = s + 19;
  while (*p == '.' || isdigit((unsigned char)*p)) p++;
  if (*p == '+' || *p == '-') {
    int oh = 0, om = 0;
    sscanf(p + 1, "%2d%*[:]%2d", &oh, &om);
    if (om == 0) sscanf(p + 1, "%2d%2d", &oh, &om);
    const long off = oh * 3600L + om * 60L;
    t += (*p == '+') ? -off : off;
  }
  return t;
}

void copyText(char* to, size_t size, const char* from) {
  snprintf(to, size, "%s", from ? from : "");
}

// The OLED's font has no ° or µ: draw ° with the font's degree sign, spell the rest in ASCII.
void printUnit(const char* unit) {
  for (const char* p = unit; *p; p++) {
    if ((uint8_t)p[0] == 0xC2 && (uint8_t)p[1] == 0xB0) { oled.write(248); p++; }      // °
    else if ((uint8_t)p[0] == 0xC2 && (uint8_t)p[1] == 0xB5) { oled.write('u'); p++; }  // µ
    else if ((uint8_t)p[0] == 0xC2 && (uint8_t)p[1] == 0xB3) { oled.write('3'); p++; }  // ³
    else if ((uint8_t)p[0] < 0x80) oled.write(p[0]);
  }
}

const char* boolWord(const Reading& r) {
  if (!strcmp(r.kind, "door")) return r.flag ? "OPEN" : "CLOSED";
  if (!strcmp(r.kind, "power")) return r.flag ? "ON" : "OFF";
  if (!strcmp(r.kind, "flood")) return r.flag ? "WET" : "DRY";
  if (!strcmp(r.kind, "motion")) return r.flag ? "MOTION" : "CLEAR";
  return r.flag ? "YES" : "NO";
}

// The things ProbeHarbor exists to catch: freezing, water, lost power.
// Case-insensitive "does text contain word".
bool containsWord(const char* text, const char* word) {
  const size_t n = strlen(word);
  for (const char* t = text; *t; t++) {
    size_t i = 0;
    while (i < n && t[i] && tolower((unsigned char)t[i]) == tolower((unsigned char)word[i])) i++;
    if (i == n) return true;
  }
  return false;
}

bool coldOnPurpose(const Reading& r) {
  for (const char* w : COLD_ON_PURPOSE) {
    if (containsWord(r.label, w) || containsWord(r.device, w)) return true;
  }
  return false;
}

bool alarming(const Reading& r) {
  if (r.hasNum && !strcmp(r.kind, "temperature")) {
    if (coldOnPurpose(r)) return false;
    const bool celsius = strstr(r.unit, "C") != nullptr;
    return r.num <= (celsius ? (FREEZE_F - 32) * 5 / 9 : FREEZE_F);
  }
  if (r.hasBool && !strcmp(r.kind, "flood")) return r.flag;
  if (r.hasBool && !strcmp(r.kind, "power")) return !r.flag;
  return false;
}

long ageMinutes(const Reading& r) {
  const time_t now = time(nullptr);
  if (now < 1700000000 || r.at == 0) return -1;  // clock not set yet
  return (long)(now - r.at) / 60;
}

void fetchReadings() {
  WiFiClientSecure tls;
  tls.setCACert(ROOT_CAS);
  HTTPClient http;
  http.useHTTP10(true);  // a plain body, so ArduinoJson can read it as it arrives
  const char* keep[] = {"Retry-After"};
  http.collectHeaders(keep, 1);
  if (!http.begin(tls, shareUrl)) {
    copyText(status, sizeof(status), "Bad SHARE_URL");
    return;
  }
  const int code = http.GET();
  if (code == 200) {
    JsonDocument filter;
    JsonObject f = filter["readings"].add<JsonObject>();
    for (const char* k : {"device", "label", "kind", "unit", "value_num", "value_bool", "recorded_at"}) f[k] = true;
    JsonDocument doc;
    const DeserializationError err = deserializeJson(doc, http.getStream(), DeserializationOption::Filter(filter));
    if (err) {
      snprintf(status, sizeof(status), "Bad reply: %s", err.c_str());
    } else {
      count = 0;
      for (JsonObject r : doc["readings"].as<JsonArray>()) {
        if (count == MAX_READINGS) break;
        Reading& x = readings[count++];
        copyText(x.device, sizeof(x.device), r["device"] | "");
        copyText(x.label, sizeof(x.label), r["label"] | "");
        copyText(x.kind, sizeof(x.kind), r["kind"] | "generic");
        copyText(x.unit, sizeof(x.unit), r["unit"] | "");
        x.hasNum = r["value_num"].is<float>();
        x.num = r["value_num"] | 0.0f;
        x.hasBool = r["value_bool"].is<bool>();
        x.flag = r["value_bool"] | false;
        x.at = parseTime(r["recorded_at"] | "");
      }
      snprintf(status, sizeof(status), "%d sensors", count);
      if (page >= count) page = 0;
      for (int i = 0; i < count; i++) {
        const Reading& r = readings[i];
        // "Garage: Freezer_probe = 4.2 °F (at 15:50 UTC)": one name per sensor, so the bench plots each one.
        char name[sizeof(r.label)];
        copyText(name, sizeof(name), r.label);
        for (char* c = name; *c; c++) if (!isalnum((unsigned char)*c)) *c = '_';
        Serial.printf("%s: %s = ", r.device, name);
        if (r.hasNum) Serial.printf("%.1f %s", r.num, r.unit);
        else if (r.hasBool) Serial.print(boolWord(r));
        else Serial.print("no value");
        if (r.at) {
          struct tm t;
          gmtime_r(&r.at, &t);
          Serial.printf(" (at %02d:%02d UTC)", t.tm_hour, t.tm_min);
        }
        Serial.println();
        if (alarming(r)) Serial.printf("ALERT %s: %s\n", r.device, r.label);
      }
    }
  } else if (code == 404) {
    copyText(status, sizeof(status), "Link invalid or expired");
  } else if (code == 429) {
    retryAfterMs = 1000UL * (unsigned long)max(60L, http.header("Retry-After").toInt());
    copyText(status, sizeof(status), "Too many requests");
  } else {
    snprintf(status, sizeof(status), "HTTP %d", code);
  }
  if (code != 200) Serial.printf("ProbeHarbor: %s\n", status);
  http.end();
}

void draw() {
  oled.clearDisplay();
  oled.setTextColor(SSD1306_WHITE);
  oled.setTextSize(1);
  oled.setCursor(0, 0);
  if (count == 0) {
    oled.println("ProbeHarbor");
    oled.println();
    oled.println(status);
    oled.display();
    return;
  }
  const Reading& r = readings[page];
  const bool alarm = alarming(r);
  // Flash alarming readings by inverting the screen every other second.
  oled.invertDisplay(alarm && (millis() / 1000) % 2);
  oled.printf("%.21s\n%.21s\n", r.device, r.label);
  oled.setTextSize(r.hasNum ? 3 : 2);
  oled.setCursor(0, 24);
  if (r.hasNum) {
    oled.print(r.num, fabs(r.num) < 100 ? 1 : 0);
    oled.setTextSize(1);
    oled.print(' ');
    printUnit(r.unit);
  } else if (r.hasBool) {
    oled.print(boolWord(r));
  } else {
    oled.print("--");
  }
  oled.setTextSize(1);
  oled.setCursor(0, 56);
  const long age = ageMinutes(r);
  if (age >= (long)STALE_MINUTES) oled.printf("STALE %ldm", age);
  else if (age >= 0) oled.printf("%ldm ago", age);
  if (alarm) oled.print(strcmp(r.kind, "temperature") ? "  ALERT" : "  FREEZE");
  oled.setCursor(104, 56);
  oled.printf("%d/%d", page + 1, count);
  oled.display();
}

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON, INPUT_PULLUP);
  Wire.begin(SDA_PIN, SCL_PIN);
  if (!oled.begin(SSD1306_SWITCHCAPVCC, 0x3C)) Serial.println("OLED not found at 0x3C: check SDA, SCL and power");
  oled.cp437(true);
  copyText(status, sizeof(status), "Waiting for settings");
  draw();
  benchSettingsBoot();
  wifiSsid = benchSetting("wifi_ssid", WIFI_SSID);
  wifiPass = benchSetting("wifi_pass", WIFI_PASS);
  shareUrl = benchSetting("share_url", SHARE_URL);
  benchNeeds("Wi-Fi name", wifiSsid, "your-wifi", "WIFI_SSID");
  benchNeeds("ProbeHarbor share link", shareUrl, "https://probeharbor.dev/api/share/YOUR_SHARE_TOKEN/readings", "SHARE_URL");
  copyText(status, sizeof(status), "Joining Wi-Fi");
  draw();
  WiFi.begin(wifiSsid.c_str(), wifiPass.c_str());
  while (WiFi.status() != WL_CONNECTED) delay(250);
  Serial.printf("wifi ok %s\n", WiFi.localIP().toString().c_str());
  configTime(0, 0, "pool.ntp.org", "time.google.com");  // UTC, for "minutes ago"
  copyText(status, sizeof(status), "Fetching readings");
  draw();
}

void loop() {
  benchSettingsPoll();
  const unsigned long now = millis();
  const unsigned long every = retryAfterMs ? retryAfterMs : REFRESH_SECONDS * 1000UL;
  if (lastFetch == 0 || now - lastFetch >= every) {
    lastFetch = now ? now : 1;
    retryAfterMs = 0;
    if (WiFi.status() == WL_CONNECTED) fetchReadings();
    else {
      copyText(status, sizeof(status), "Wi-Fi lost, retrying");
      WiFi.reconnect();
    }
  }
  if (digitalRead(BUTTON) == LOW) {  // next sensor
    page = count ? (page + 1) % count : 0;
    lastPage = now;
    while (digitalRead(BUTTON) == LOW) delay(10);
  }
  if (count && now - lastPage >= PAGE_SECONDS * 1000UL) {
    page = (page + 1) % count;
    lastPage = now;
  }
  draw();
  delay(50);
}
`,
    notes: [
      "It reads a ProbeHarbor share link, which is read-only and works on the free plan. In ProbeHarbor, open Dashboard, Share, create a live link and paste its readings address into SHARE_URL. The display can only read; it never holds a key that can change your account.",
      "Use a live link, not a history link: a history link also sends seven days of chart points, which is far more than this board needs to download every minute.",
      "It refreshes once a minute. ProbeHarbor allows 60 requests a minute per link, and if it ever answers 429 the sketch waits as long as the server asks.",
      "The connection is checked against the root certificates of Google Trust Services and Let's Encrypt, which Cloudflare uses for probeharbor.dev. If ProbeHarbor ever moves to another certificate authority, the display shows an HTTP error and needs that root added.",
      "Temperatures at or below FREEZE_F (35 °F, or the same in °C when the sensor reports Celsius), water on a flood sensor and lost power flash the screen. Probes meant to be cold are left out of the freeze warning: any sensor or device named with a word from COLD_ON_PURPOSE (Freezer and Fridge to start with). Readings older than STALE_MINUTES are marked stale, which usually means the probe has gone quiet.",
      "Door, power, flood and motion sensors show OPEN or CLOSED, ON or OFF, WET or DRY and MOTION or CLEAR, as on the ProbeHarbor dashboard.",
    ],
    open: ["Not tested on hardware or against a real ProbeHarbor share link yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    settings: [
      ...WIFI,
      {
        key: "share_url",
        label: "ProbeHarbor share link",
        kind: "url",
        hint: "Dashboard, Share, create a live link, then paste its readings address.",
        required: true,
      },
    ],
    sample: [
      "wifi ok 192.168.1.73",
      "Garage: Freezer_probe = 4.2 °F (at 15:49 UTC)",
      "Garage: Garage_air = 33.8 °F (at 15:49 UTC)",
      "ALERT Garage: Garage air",
      "Garage: Door = CLOSED (at 15:44 UTC)",
      "Crawlspace: Pipe_probe = 41.5 °F (at 15:48 UTC)",
      "Crawlspace: Leak_pads = DRY (at 15:48 UTC)",
      "Garage: Freezer_probe = 4.1 °F (at 15:51 UTC)",
      "Garage: Garage_air = 34.4 °F (at 15:51 UTC)",
      "ALERT Garage: Garage air",
      "Garage: Door = CLOSED (at 15:44 UTC)",
      "Crawlspace: Pipe_probe = 41.3 °F (at 15:50 UTC)",
      "Crawlspace: Leak_pads = DRY (at 15:50 UTC)",
      "Garage: Freezer_probe = 4.3 °F (at 15:51 UTC)",
      "Garage: Garage_air = 35.1 °F (at 15:51 UTC)",
      "Garage: Door = OPEN (at 15:52 UTC)",
      "Crawlspace: Pipe_probe = 41.2 °F (at 15:50 UTC)",
      "Crawlspace: Leak_pads = DRY (at 15:50 UTC)",
      "Garage: Freezer_probe = 4.2 °F (at 15:53 UTC)",
      "Garage: Garage_air = 35.9 °F (at 15:53 UTC)",
      "Garage: Door = CLOSED (at 15:53 UTC)",
      "Crawlspace: Pipe_probe = 41.0 °F (at 15:52 UTC)",
      "Crawlspace: Leak_pads = DRY (at 15:52 UTC)",
    ],
  },
  {
    id: "ph-lcd", needs: [["lcd1602"], ["encoder"]], name: "ProbeHarbor on a 16x2 LCD", level: "Intermediate", mins: 40, tags: ["probeharbor", "display", "wireless", "input"],
    probeharbor: "reads",
    sum: "Your ProbeHarbor sensors on the classic 16x2 character LCD. Turn a rotary encoder to step through them, press it for the device and the reading's age, and watch for the ! that marks freezing, water or lost power.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    vars: {
      esp32: { RS: "13", EN: "14", DA: "25", DB: "26", DC: "27", DD: "33", ENCA: "18", ENCB: "19", ENCSW: "23", SWNOTE: "", BL: "4", BLTO: "GPIO 4", SWTO: "GPIO 23" },
      esp32s3: { RS: "4", EN: "5", DA: "6", DB: "7", DC: "15", DD: "16", ENCA: "17", ENCB: "18", ENCSW: "8", SWNOTE: "", BL: "9", BLTO: "GPIO 9", SWTO: "GPIO 8" },
      esp32c3: { RS: "0", EN: "1", DA: "3", DB: "4", DC: "5", DD: "10", ENCA: "6", ENCB: "7", ENCSW: "9", SWNOTE: " (the board's BOOT button: the C3 has no spare pin)", BL: "-1", BLTO: "Not used on the C3: wire the backlight to 5 V", SWTO: "Not wired on the C3: press the BOOT button instead" },
    },
    pins: ["5V", "3V3", "GND", "%RS%", "%EN%", "%DA%", "%DB%", "%DC%", "%DD%", "%ENCA%", "%ENCB%", "%ENCSW%", "%BL%"],
    libs: ["ArduinoJson", "LiquidCrystal", "WiFi (built in)", "HTTPClient (built in)"],
    baud: 115200,
    parts: [
      [1, "ESP32 dev board", BOM.esp32DevKit],
      [1, "16x2 character LCD (HD44780), 5 V"],
      [1, "10 kΩ trimmer potentiometer, for the contrast"],
      [1, "Rotary encoder with push button (EC11 or a KY-040 board)"],
      [1, "Optional: NPN transistor (2N2222, BC547 or similar) and 1 kΩ resistor, to blink the backlight"],
      [16, "Jumper wires and a breadboard"],
    ],
    wiring: [
      ["LCD 1 VSS", "GND", ""],
      ["LCD 2 VDD", "5V", "The LCD runs on 5 V"],
      ["LCD 3 V0", "Trimmer wiper", "Turn the trimmer until the characters show"],
      ["Trimmer, outer pin", "5V", ""],
      ["Trimmer, other outer pin", "GND", ""],
      ["LCD 4 RS", "GPIO %RS%", ""],
      ["LCD 5 RW", "GND", "Always. Tied low, the LCD only listens and never sends 5 V back to the ESP32"],
      ["LCD 6 E", "GPIO %EN%", ""],
      ["LCD 11 D4", "GPIO %DA%", "4-bit mode: D0 to D3 stay unconnected"],
      ["LCD 12 D5", "GPIO %DB%", ""],
      ["LCD 13 D6", "GPIO %DC%", ""],
      ["LCD 14 D7", "GPIO %DD%", ""],
      ["LCD 15 A (backlight +)", "5V", "Many modules have the backlight resistor on board; if yours does not, add about 100 Ω"],
      ["LCD 16 K (backlight -)", "GND", "For the optional blink, K goes to the transistor's collector instead"],
      ["Optional: blink transistor collector", "LCD 16 K (backlight -)", "An NPN such as a PN2222, so the alarm can blink the backlight"],
      ["Optional: blink transistor emitter", "GND", ""],
      ["Optional: blink transistor base, through 1 kΩ", "%BLTO%", ""],
      ["Encoder A / CLK", "GPIO %ENCA%", "Internal pull-ups are used"],
      ["Encoder B / DT", "GPIO %ENCB%", ""],
      ["Encoder middle pin (C), or KY-040 GND", "GND", "The encoder's common pin"],
      ["Encoder push switch / SW", "%SWTO%", ""],
      ["Encoder push switch, other leg", "GND", "A KY-040 board already joins it to GND"],
      ["KY-040 board + (if you have one)", "3V3", "Never 5 V: its pull-ups would put 5 V on the GPIOs"],
    ],
    code: R`// ProbeHarbor on a 16x2 LCD: turn the knob to step through your sensors,
// press it for the device name and how old the reading is.
// Reads a ProbeHarbor share link (read-only, works on the free plan) once a minute.
// Libraries: ArduinoJson, LiquidCrystal.
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <LiquidCrystal.h>
#include <ArduinoJson.h>
#include <time.h>

// ---- Your settings ----
const char* WIFI_SSID = "your-wifi";
const char* WIFI_PASS = "your-password";
// ProbeHarbor: Dashboard, Share, create a live link, copy its readings address.
const char* SHARE_URL = "https://probeharbor.dev/api/share/YOUR_SHARE_TOKEN/readings";
const unsigned REFRESH_SECONDS = 60;  // ProbeHarbor allows 60 requests a minute per link
const float FREEZE_F = 35.0;          // temperatures at or below this raise the alarm
// Probes meant to be cold (a freezer, a fridge) never raise the freeze warning.
// Any sensor or device whose name contains one of these words is left out.
const char* COLD_ON_PURPOSE[] = {"Freezer", "Fridge"};
const unsigned STALE_MINUTES = 30;    // readings older than this are marked stale
String wifiSsid, wifiPass, shareUrl;

// ---- Pins ----
LiquidCrystal lcd(%RS%, %EN%, %DA%, %DB%, %DC%, %DD%);  // RS, E, D4, D5, D6, D7
const int ENC_A = %ENCA%;       // encoder CLK / A
const int ENC_B = %ENCB%;       // encoder DT / B
const int ENC_SW = %ENCSW%;     // encoder push button%SWNOTE%
const int BACKLIGHT = %BL%;     // transistor that switches the backlight, or -1 if it is wired to 5 V

// Root certificates for probeharbor.dev: Google Trust Services R1 and R4, and
// Let's Encrypt ISRG X1 and X2. Cloudflare issues the site's certificate from one of these.
const char* ROOT_CAS = R"PEM(
-----BEGIN CERTIFICATE-----
MIIFVzCCAz+gAwIBAgINAgPlk28xsBNJiGuiFzANBgkqhkiG9w0BAQwFADBHMQsw
CQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2VzIExMQzEU
MBIGA1UEAxMLR1RTIFJvb3QgUjEwHhcNMTYwNjIyMDAwMDAwWhcNMzYwNjIyMDAw
MDAwWjBHMQswCQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZp
Y2VzIExMQzEUMBIGA1UEAxMLR1RTIFJvb3QgUjEwggIiMA0GCSqGSIb3DQEBAQUA
A4ICDwAwggIKAoICAQC2EQKLHuOhd5s73L+UPreVp0A8of2C+X0yBoJx9vaMf/vo
27xqLpeXo4xL+Sv2sfnOhB2x+cWX3u+58qPpvBKJXqeqUqv4IyfLpLGcY9vXmX7w
Cl7raKb0xlpHDU0QM+NOsROjyBhsS+z8CZDfnWQpJSMHobTSPS5g4M/SCYe7zUjw
TcLCeoiKu7rPWRnWr4+wB7CeMfGCwcDfLqZtbBkOtdh+JhpFAz2weaSUKK0Pfybl
qAj+lug8aJRT7oM6iCsVlgmy4HqMLnXWnOunVmSPlk9orj2XwoSPwLxAwAtcvfaH
szVsrBhQf4TgTM2S0yDpM7xSma8ytSmzJSq0SPly4cpk9+aCEI3oncKKiPo4Zor8
Y/kB+Xj9e1x3+naH+uzfsQ55lVe0vSbv1gHR6xYKu44LtcXFilWr06zqkUspzBmk
MiVOKvFlRNACzqrOSbTqn3yDsEB750Orp2yjj32JgfpMpf/VjsPOS+C12LOORc92
wO1AK/1TD7Cn1TsNsYqiA94xrcx36m97PtbfkSIS5r762DL8EGMUUXLeXdYWk70p
aDPvOmbsB4om3xPXV2V4J95eSRQAogB/mqghtqmxlbCluQ0WEdrHbEg8QOB+DVrN
VjzRlwW5y0vtOUucxD/SVRNuJLDWcfr0wbrM7Rv1/oFB2ACYPTrIrnqYNxgFlQID
AQABo0IwQDAOBgNVHQ8BAf8EBAMCAYYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4E
FgQU5K8rJnEaK0gnhS9SZizv8IkTcT4wDQYJKoZIhvcNAQEMBQADggIBAJ+qQibb
C5u+/x6Wki4+omVKapi6Ist9wTrYggoGxval3sBOh2Z5ofmmWJyq+bXmYOfg6LEe
QkEzCzc9zolwFcq1JKjPa7XSQCGYzyI0zzvFIoTgxQ6KfF2I5DUkzps+GlQebtuy
h6f88/qBVRRiClmpIgUxPoLW7ttXNLwzldMXG+gnoot7TiYaelpkttGsN/H9oPM4
7HLwEXWdyzRSjeZ2axfG34arJ45JK3VmgRAhpuo+9K4l/3wV3s6MJT/KYnAK9y8J
ZgfIPxz88NtFMN9iiMG1D53Dn0reWVlHxYciNuaCp+0KueIHoI17eko8cdLiA6Ef
MgfdG+RCzgwARWGAtQsgWSl4vflVy2PFPEz0tv/bal8xa5meLMFrUKTX5hgUvYU/
Z6tGn6D/Qqc6f1zLXbBwHSs09dR2CQzreExZBfMzQsNhFRAbd03OIozUhfJFfbdT
6u9AWpQKXCBfTkBdYiJ23//OYb2MI3jSNwLgjt7RETeJ9r/tSQdirpLsQBqvFAnZ
0E6yove+7u7Y/9waLd64NnHi/Hm3lCXRSHNboTXns5lndcEZOitHTtNCjv0xyBZm
2tIMPNuzjsmhDYAPexZ3FL//2wmUspO8IFgV6dtxQ/PeEMMA3KgqlbbC1j+Qa3bb
bP6MvPJwNQzcmRk13NfIRmPVNnGuV/u3gm3c
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
MIICCTCCAY6gAwIBAgINAgPlwGjvYxqccpBQUjAKBggqhkjOPQQDAzBHMQswCQYD
VQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2VzIExMQzEUMBIG
A1UEAxMLR1RTIFJvb3QgUjQwHhcNMTYwNjIyMDAwMDAwWhcNMzYwNjIyMDAwMDAw
WjBHMQswCQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2Vz
IExMQzEUMBIGA1UEAxMLR1RTIFJvb3QgUjQwdjAQBgcqhkjOPQIBBgUrgQQAIgNi
AATzdHOnaItgrkO4NcWBMHtLSZ37wWHO5t5GvWvVYRg1rkDdc/eJkTBa6zzuhXyi
QHY7qca4R9gq55KRanPpsXI5nymfopjTX15YhmUPoYRlBtHci8nHc8iMai/lxKvR
HYqjQjBAMA4GA1UdDwEB/wQEAwIBhjAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQW
BBSATNbrdP9JNqPV2Py1PsVq8JQdjDAKBggqhkjOPQQDAwNpADBmAjEA6ED/g94D
9J+uHXqnLrmvT/aDHQ4thQEd0dlq7A/Cr8deVl5c1RxYIigL9zC2L7F8AjEA8GE8
p/SgguMh1YQdc4acLa/KNJvxn7kjNuK8YAOdgLOaVsjh4rsUecrNIdSUtUlD
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4
WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu
ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY
MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc
h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+
0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U
A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW
T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH
B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC
B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv
KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn
OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn
jh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw
qHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI
rU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV
HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq
hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL
ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ
3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK
NFtY2PwByVS5uCbMiogziUwthDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5
ORAzI4JMPJ+GslWYHb4phowim57iaztXOoJwTdwJx4nLCgdNbOhdjsnvzqvHu7Ur
TkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIuvtd7u+Nxe5AW0wdeRlN8NwdC
jNPElpzVmbUq4JUagEiuTDkHzsxHpFKVK7q4+63SM1N95R1NbdWhscdCb+ZAJzVc
oyi3B43njTOQ5yOf+1CceWxG1bQVs5ZufpsMljq4Ui0/1lvh+wjChP4kqKOJ2qxq
4RgqsahDYVvTH9w7jXbyLeiNdd8XM2w9U/t7y0Ff/9yi0GE44Za4rF2LN9d11TPA
mRGunUHBcnWEvgJBQl9nJEiU0Zsnvgc/ubhPgXRR4Xq37Z0j4r7g1SgEEzwxA57d
emyPxgcYxn/eR44/KJ4EBs+lVDR3veyJm+kXQ99b21/+jh5Xos1AnX5iItreGCc=
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
MIICGzCCAaGgAwIBAgIQQdKd0XLq7qeAwSxs6S+HUjAKBggqhkjOPQQDAzBPMQsw
CQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJuZXQgU2VjdXJpdHkgUmVzZWFyY2gg
R3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBYMjAeFw0yMDA5MDQwMDAwMDBaFw00
MDA5MTcxNjAwMDBaME8xCzAJBgNVBAYTAlVTMSkwJwYDVQQKEyBJbnRlcm5ldCBT
ZWN1cml0eSBSZXNlYXJjaCBHcm91cDEVMBMGA1UEAxMMSVNSRyBSb290IFgyMHYw
EAYHKoZIzj0CAQYFK4EEACIDYgAEzZvVn4CDCuwJSvMWSj5cz3es3mcFDR0HttwW
+1qLFNvicWDEukWVEYmO6gbf9yoWHKS5xcUy4APgHoIYOIvXRdgKam7mAHf7AlF9
ItgKbppbd9/w+kHsOdx1ymgHDB/qo0IwQDAOBgNVHQ8BAf8EBAMCAQYwDwYDVR0T
AQH/BAUwAwEB/zAdBgNVHQ4EFgQUfEKWrt5LSDv6kviejM9ti6lyN5UwCgYIKoZI
zj0EAwMDaAAwZQIwe3lORlCEwkSHRhtFcP9Ymd70/aTSVaYgLXTWNLxBo1BfASdW
tL4ndQavEi51mI38AjEAi/V3bNTIZargCyzuFJ0nN6T5U6VR5CmD1/iQMVtCnwr1
/q4AaOeMSQ+2b1tbFfLn
-----END CERTIFICATE-----
)PEM";

struct Reading {
  char device[24];
  char label[24];
  char kind[14];
  char unit[10];
  bool hasNum, hasBool;
  float num;
  bool flag;
  time_t at;
};
const int MAX_READINGS = 16;
Reading readings[MAX_READINGS];
int count = 0, page = 0;
char status[40] = "Starting";
unsigned long lastFetch = 0, retryAfterMs = 0;
bool detailView = false;  // true while the device name and age are shown

// ---- Rotary encoder: a table of valid Gray-code steps, so contact bounce cancels out ----
volatile int encSteps = 0;
uint8_t encState = 0;
const int8_t ENC_TABLE[16] = {0, -1, 1, 0, 1, 0, 0, -1, -1, 0, 0, 1, 0, 1, -1, 0};
portMUX_TYPE encLock = portMUX_INITIALIZER_UNLOCKED;

// A small background task samples the encoder every millisecond. That is quick
// enough for a knob turned by hand, and it keeps counting while loop() waits on
// ProbeHarbor, without the interrupt and fast-RAM rules an ISR would need.
void pollEncoder(void*) {
  for (;;) {
    encState = (uint8_t)(((encState << 2) | (digitalRead(ENC_A) << 1) | digitalRead(ENC_B)) & 0x0F);
    const int8_t step = ENC_TABLE[encState];
    if (step) {
      taskENTER_CRITICAL(&encLock);
      encSteps += step;
      taskEXIT_CRITICAL(&encLock);
    }
    vTaskDelay(1);
  }
}

// Most EC11 / KY-040 encoders give four steps per click.
int takeClicks() {
  taskENTER_CRITICAL(&encLock);
  const int clicks = encSteps / 4;
  encSteps -= clicks * 4;
  taskEXIT_CRITICAL(&encLock);
  return clicks;
}

${benchSettings(["wifi_ssid", "wifi_pass", "share_url"])}

// Days since 1970-01-01 for a civil date (Howard Hinnant's algorithm), so we can
// turn "2026-11-12T15:50:44Z" into a UTC timestamp without timegm().
long daysFromCivil(int y, unsigned m, unsigned d) {
  y -= m <= 2;
  const long era = (y >= 0 ? y : y - 399) / 400;
  const unsigned yoe = (unsigned)(y - era * 400);
  const unsigned doy = (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1;
  const unsigned doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
  return era * 146097 + (long)doe - 719468;
}

time_t parseTime(const char* s) {
  int Y, M, D, h, m, sec;
  if (!s || sscanf(s, "%4d-%2d-%2d%*c%2d:%2d:%2d", &Y, &M, &D, &h, &m, &sec) != 6) return 0;
  time_t t = (time_t)daysFromCivil(Y, M, D) * 86400 + h * 3600 + m * 60 + sec;
  // Optional offset after the seconds: Z, +HH, +HH:MM, -HHMM ...
  const char* p = s + 19;
  while (*p == '.' || isdigit((unsigned char)*p)) p++;
  if (*p == '+' || *p == '-') {
    int oh = 0, om = 0;
    sscanf(p + 1, "%2d%*[:]%2d", &oh, &om);
    if (om == 0) sscanf(p + 1, "%2d%2d", &oh, &om);
    const long off = oh * 3600L + om * 60L;
    t += (*p == '+') ? -off : off;
  }
  return t;
}

void copyText(char* to, size_t size, const char* from) {
  snprintf(to, size, "%s", from ? from : "");
}

const char* boolWord(const Reading& r) {
  if (!strcmp(r.kind, "door")) return r.flag ? "OPEN" : "CLOSED";
  if (!strcmp(r.kind, "power")) return r.flag ? "ON" : "OFF";
  if (!strcmp(r.kind, "flood")) return r.flag ? "WET" : "DRY";
  if (!strcmp(r.kind, "motion")) return r.flag ? "MOTION" : "CLEAR";
  return r.flag ? "YES" : "NO";
}

// The things ProbeHarbor exists to catch: freezing, water, lost power.
// Case-insensitive "does text contain word".
bool containsWord(const char* text, const char* word) {
  const size_t n = strlen(word);
  for (const char* t = text; *t; t++) {
    size_t i = 0;
    while (i < n && t[i] && tolower((unsigned char)t[i]) == tolower((unsigned char)word[i])) i++;
    if (i == n) return true;
  }
  return false;
}

bool coldOnPurpose(const Reading& r) {
  for (const char* w : COLD_ON_PURPOSE) {
    if (containsWord(r.label, w) || containsWord(r.device, w)) return true;
  }
  return false;
}

bool alarming(const Reading& r) {
  if (r.hasNum && !strcmp(r.kind, "temperature")) {
    if (coldOnPurpose(r)) return false;
    const bool celsius = strstr(r.unit, "C") != nullptr;
    return r.num <= (celsius ? (FREEZE_F - 32) * 5 / 9 : FREEZE_F);
  }
  if (r.hasBool && !strcmp(r.kind, "flood")) return r.flag;
  if (r.hasBool && !strcmp(r.kind, "power")) return !r.flag;
  return false;
}

long ageMinutes(const Reading& r) {
  const time_t now = time(nullptr);
  if (now < 1700000000 || r.at == 0) return -1;  // clock not set yet
  return (long)(now - r.at) / 60;
}

void fetchReadings() {
  WiFiClientSecure tls;
  tls.setCACert(ROOT_CAS);
  HTTPClient http;
  http.useHTTP10(true);  // a plain body, so ArduinoJson can read it as it arrives
  const char* keep[] = {"Retry-After"};
  http.collectHeaders(keep, 1);
  if (!http.begin(tls, shareUrl)) {
    copyText(status, sizeof(status), "Bad SHARE_URL");
    return;
  }
  const int code = http.GET();
  if (code == 200) {
    JsonDocument filter;
    JsonObject f = filter["readings"].add<JsonObject>();
    for (const char* k : {"device", "label", "kind", "unit", "value_num", "value_bool", "recorded_at"}) f[k] = true;
    JsonDocument doc;
    const DeserializationError err = deserializeJson(doc, http.getStream(), DeserializationOption::Filter(filter));
    if (err) {
      snprintf(status, sizeof(status), "Bad reply: %s", err.c_str());
    } else {
      count = 0;
      for (JsonObject r : doc["readings"].as<JsonArray>()) {
        if (count == MAX_READINGS) break;
        Reading& x = readings[count++];
        copyText(x.device, sizeof(x.device), r["device"] | "");
        copyText(x.label, sizeof(x.label), r["label"] | "");
        copyText(x.kind, sizeof(x.kind), r["kind"] | "generic");
        copyText(x.unit, sizeof(x.unit), r["unit"] | "");
        x.hasNum = r["value_num"].is<float>();
        x.num = r["value_num"] | 0.0f;
        x.hasBool = r["value_bool"].is<bool>();
        x.flag = r["value_bool"] | false;
        x.at = parseTime(r["recorded_at"] | "");
      }
      snprintf(status, sizeof(status), "%d sensors", count);
      if (page >= count) page = 0;
      for (int i = 0; i < count; i++) {
        const Reading& r = readings[i];
        // "Garage: Freezer_probe = 4.2 °F (at 15:50 UTC)": one name per sensor, so the bench plots each one.
        char name[sizeof(r.label)];
        copyText(name, sizeof(name), r.label);
        for (char* c = name; *c; c++) if (!isalnum((unsigned char)*c)) *c = '_';
        Serial.printf("%s: %s = ", r.device, name);
        if (r.hasNum) Serial.printf("%.1f %s", r.num, r.unit);
        else if (r.hasBool) Serial.print(boolWord(r));
        else Serial.print("no value");
        if (r.at) {
          struct tm t;
          gmtime_r(&r.at, &t);
          Serial.printf(" (at %02d:%02d UTC)", t.tm_hour, t.tm_min);
        }
        Serial.println();
        if (alarming(r)) Serial.printf("ALERT %s: %s\n", r.device, r.label);
      }
    }
  } else if (code == 404) {
    copyText(status, sizeof(status), "Link invalid or expired");
  } else if (code == 429) {
    retryAfterMs = 1000UL * (unsigned long)max(60L, http.header("Retry-After").toInt());
    copyText(status, sizeof(status), "Too many requests");
  } else {
    snprintf(status, sizeof(status), "HTTP %d", code);
  }
  if (code != 200) Serial.printf("ProbeHarbor: %s\n", status);
  http.end();
}

// The LCD's character set has a degree sign (0xDF) and a micro sign (0xE4).
void printUnit(const char* unit) {
  for (const char* p = unit; *p; p++) {
    if ((uint8_t)p[0] == 0xC2 && (uint8_t)p[1] == 0xB0) { lcd.write((uint8_t)0xDF); p++; }       // °
    else if ((uint8_t)p[0] == 0xC2 && (uint8_t)p[1] == 0xB5) { lcd.write((uint8_t)0xE4); p++; }  // µ
    else if ((uint8_t)p[0] == 0xC2 && (uint8_t)p[1] == 0xB3) { lcd.write('3'); p++; }             // ³
    else if ((uint8_t)p[0] < 0x80) lcd.write(p[0]);
  }
}

// Print text padded or cut to exactly \`width\` characters, so old text never lingers.
void printFixed(const char* text, int width) {
  int n = 0;
  for (; text[n] && n < width; n++) lcd.write(text[n]);
  for (; n < width; n++) lcd.write(' ');
}

void draw() {
  static char shown[2][17] = {"", ""};
  char top[17], bottom[17];
  if (count == 0) {
    snprintf(top, sizeof(top), "ProbeHarbor");
    snprintf(bottom, sizeof(bottom), "%.16s", status);
  } else {
    const Reading& r = readings[page];
    const bool alarm = alarming(r);
    const long age = ageMinutes(r);
    if (!detailView) {
      // Top: the sensor's label, with "!" at the end when it is alarming.
      snprintf(top, sizeof(top), "%-15.15s%c", r.label, alarm ? '!' : ' ');
      bottom[0] = 0;  // drawn below, because of the unit characters
    } else {
      snprintf(top, sizeof(top), "%.16s", r.device);
      if (age >= (long)STALE_MINUTES) snprintf(bottom, sizeof(bottom), "STALE %ldm", age);
      else if (age >= 0) snprintf(bottom, sizeof(bottom), "%ldm ago", age);
      else snprintf(bottom, sizeof(bottom), "time not set");
    }
    // Blink the backlight while the shown sensor is alarming, if a transistor drives it.
    if (BACKLIGHT >= 0) digitalWrite(BACKLIGHT, alarm && (millis() / 500) % 2 ? LOW : HIGH);
  }
  if (strcmp(top, shown[0])) {
    lcd.setCursor(0, 0);
    printFixed(top, 16);
    snprintf(shown[0], sizeof(shown[0]), "%s", top);
  }
  if (count > 0 && !detailView) {
    const Reading& r = readings[page];
    char value[17], pos[8];
    if (r.hasNum) snprintf(value, sizeof(value), "%.1f ", r.num);
    else if (r.hasBool) snprintf(value, sizeof(value), "%s", boolWord(r));
    else snprintf(value, sizeof(value), "--");
    snprintf(pos, sizeof(pos), "%d/%d", page + 1, count);
    char key[40];
    snprintf(key, sizeof(key), "%s|%s|%s", value, r.unit, pos);
    if (strcmp(key, shown[1])) {  // only redraw when something changed: no flicker
      lcd.setCursor(0, 1);
      printFixed("", 16);
      lcd.setCursor(0, 1);
      lcd.print(value);
      if (r.hasNum) printUnit(r.unit);
      lcd.setCursor(16 - (int)strlen(pos), 1);
      lcd.print(pos);
      snprintf(shown[1], sizeof(shown[1]), "%.16s", key);
    }
  } else if (strcmp(bottom, shown[1])) {
    lcd.setCursor(0, 1);
    printFixed(bottom, 16);
    snprintf(shown[1], sizeof(shown[1]), "%s", bottom);
  }
}

void setup() {
  Serial.begin(115200);
  lcd.begin(16, 2);
  if (BACKLIGHT >= 0) {
    pinMode(BACKLIGHT, OUTPUT);
    digitalWrite(BACKLIGHT, HIGH);
  }
  pinMode(ENC_A, INPUT_PULLUP);
  pinMode(ENC_B, INPUT_PULLUP);
  pinMode(ENC_SW, INPUT_PULLUP);
  encState = (uint8_t)((digitalRead(ENC_A) << 1) | digitalRead(ENC_B));
  xTaskCreate(pollEncoder, "encoder", 2048, nullptr, 2, nullptr);  // above loop()'s priority
  copyText(status, sizeof(status), "Waiting for settings");
  draw();
  benchSettingsBoot();
  wifiSsid = benchSetting("wifi_ssid", WIFI_SSID);
  wifiPass = benchSetting("wifi_pass", WIFI_PASS);
  shareUrl = benchSetting("share_url", SHARE_URL);
  benchNeeds("Wi-Fi name", wifiSsid, "your-wifi", "WIFI_SSID");
  benchNeeds("ProbeHarbor share link", shareUrl, "https://probeharbor.dev/api/share/YOUR_SHARE_TOKEN/readings", "SHARE_URL");
  copyText(status, sizeof(status), "Joining Wi-Fi");
  draw();
  WiFi.begin(wifiSsid.c_str(), wifiPass.c_str());
  while (WiFi.status() != WL_CONNECTED) delay(250);
  Serial.printf("wifi ok %s\n", WiFi.localIP().toString().c_str());
  configTime(0, 0, "pool.ntp.org", "time.google.com");  // UTC, for "minutes ago"
  copyText(status, sizeof(status), "Fetching");
  draw();
}

void loop() {
  benchSettingsPoll();
  const unsigned long now = millis();
  const unsigned long every = retryAfterMs ? retryAfterMs : REFRESH_SECONDS * 1000UL;
  if (lastFetch == 0 || now - lastFetch >= every) {
    lastFetch = now ? now : 1;
    retryAfterMs = 0;
    if (WiFi.status() == WL_CONNECTED) fetchReadings();
    else {
      copyText(status, sizeof(status), "Wi-Fi lost");
      WiFi.reconnect();
    }
  }
  const int clicks = takeClicks();
  if (clicks && count) page = ((page + clicks) % count + count) % count;
  static bool wasDown = false;
  const bool down = digitalRead(ENC_SW) == LOW;
  if (down && !wasDown) detailView = !detailView;  // press: toggle the detail view
  wasDown = down;
  draw();
  delay(20);
}
`,
    notes: [
      "Probes meant to be cold, such as a freezer or fridge, are left out of the freeze warning: name them with a word from COLD_ON_PURPOSE (Freezer and Fridge to start with) or add your own.",
      "It reads a ProbeHarbor share link, which is read-only and works on the free plan. In ProbeHarbor, open Dashboard, Share, create a live link and paste its readings address into SHARE_URL.",
      "The HD44780 runs on 5 V but accepts the ESP32's 3.3 V signals, because it treats anything above 2.2 V as high. That only works one way, which is why RW goes to GND: the LCD never drives its data pins, so no 5 V reaches the ESP32.",
      "Blank or solid blocks on the top row usually means the contrast: turn the trimmer slowly from one end to the other.",
      "A small background task reads the encoder every millisecond against a table of valid Gray-code steps, so a bouncy contact cancels itself out instead of skipping sensors, and turns still count while the board is fetching from ProbeHarbor. If one click moves two sensors, change the 4 in takeClicks() to 2.",
      "On a 16x2 an alarm shows as ! at the end of the sensor's name. With the optional transistor the backlight also blinks while that sensor is on screen. Without it, BACKLIGHT is -1 and the backlight simply stays on.",
      "The ESP32-C3 has eight pins free of boot, USB and serial duties, and this project needs nine, so on the C3 the board's BOOT button stands in for the encoder's push switch and the backlight blink is left out. Do not hold BOOT while the board resets.",
      "GPIO 14 on the classic ESP32 wiggles briefly at power-up. On the LCD's E pin that is harmless: the screen is cleared when the sketch starts.",
    ],
    open: ["Not tested on hardware or against a real ProbeHarbor share link yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    settings: [
      ...WIFI,
      {
        key: "share_url",
        label: "ProbeHarbor share link",
        kind: "url",
        hint: "Dashboard, Share, create a live link, then paste its readings address.",
        required: true,
      },
    ],
    sample: [
      "wifi ok 192.168.1.74",
      "Garage: Freezer_probe = 4.2 °F (at 15:49 UTC)",
      "Garage: Garage_air = 33.8 °F (at 15:49 UTC)",
      "ALERT Garage: Garage air",
      "Crawlspace: Pipe_probe = 41.5 °F (at 15:48 UTC)",
      "Garage: Freezer_probe = 4.1 °F (at 15:50 UTC)",
      "Garage: Garage_air = 34.4 °F (at 15:50 UTC)",
      "ALERT Garage: Garage air",
      "Crawlspace: Pipe_probe = 41.3 °F (at 15:50 UTC)",
      "Garage: Freezer_probe = 4.3 °F (at 15:51 UTC)",
      "Garage: Garage_air = 35.6 °F (at 15:51 UTC)",
      "Crawlspace: Pipe_probe = 41.2 °F (at 15:51 UTC)",
    ],
  },
  {
    id: "ph-motion", needs: [["pir"], ["rgbled", "led"]], name: "PIR motion sensor for ProbeHarbor", level: "Starter", mins: 25, tags: ["probeharbor", "sensors", "wireless"],
    probeharbor: "sends",
    sum: "An HC-SR501 PIR sensor reports motion in the garage, shed or workshop to ProbeHarbor, with an RGB LED that glows green when quiet, red on motion and blue if Wi-Fi or ProbeHarbor is unreachable.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    vars: {
      esp32: { PIR: "27", LR: "25", LG: "26", LB: "33" },
      esp32s3: { PIR: "4", LR: "5", LG: "6", LB: "7" },
      esp32c3: { PIR: "4", LR: "5", LG: "6", LB: "7" },
    },
    pins: ["5V", "GND", "%PIR%", "%LR%", "%LG%", "%LB%"],
    libs: ["WiFi (built in)", "HTTPClient (built in)"],
    baud: 115200,
    parts: [
      [1, "ESP32 dev board", BOM.esp32DevKit],
      [1, "HC-SR501 PIR motion sensor"],
      [1, "RGB LED, common cathode or common anode (or three single LEDs)"],
      [3, "220 Ω resistors, one per LED colour"],
      [8, "Jumper wires"],
    ],
    wiring: [
      ["PIR VCC", "5V", "The HC-SR501 needs 4.5 V or more; it has its own 3.3 V regulator"],
      ["PIR OUT", "GPIO %PIR%", "Its output is 3.3 V when high, safe for the ESP32 as it is"],
      ["PIR GND", "GND", ""],
      ["RGB red", "GPIO %LR%", "Through 220 Ω"],
      ["RGB green", "GPIO %LG%", "Through 220 Ω"],
      ["RGB blue", "GPIO %LB%", "Through 220 Ω"],
      ["RGB common leg (the longest)", "GND", "A common-anode LED needs 3V3 here instead, and COMMON_ANODE set to true"],
    ],
    code: R`// PIR motion to ProbeHarbor: an HC-SR501 reports motion to a ProbeHarbor push
// device, and an RGB LED shows what is happening.
// Green: quiet. Red: motion. Blue: Wi-Fi or ProbeHarbor trouble. Green blinking: PIR warming up.
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>

// ---- Your settings ----
const char* WIFI_SSID = "your-wifi";
const char* WIFI_PASS = "your-password";
// ProbeHarbor: Dashboard, Devices, add a push device, copy its ingest address.
const char* INGEST_URL = "https://probeharbor.dev/api/ingest/YOUR_DEVICE_KEY";
// ProbeHarbor reads a true/false value whose name contains "motion" as a motion sensor.
const char* SENSOR_KEY = "motion1";
const unsigned long HEARTBEAT_MS = 5UL * 60UL * 1000UL;  // re-send the state every 5 minutes
const unsigned long MIN_GAP_MS = 10UL * 1000UL;          // never post more often than this
const unsigned long WARMUP_MS = 60UL * 1000UL;           // the HC-SR501 settles for about a minute
${benchSettings(["wifi_ssid", "wifi_pass", "ingest_url", "sensor_key"])}
String wifiSsid, wifiPass, ingestUrl, sensorKey;

// ---- Pins ----
const int PIR_PIN = %PIR%;
const int LED_R = %LR%, LED_G = %LG%, LED_B = %LB%;
const bool COMMON_ANODE = false;  // true if the LED's long leg goes to 3V3 instead of GND

// Root certificates for probeharbor.dev: Google Trust Services R1 and R4, and
// Let's Encrypt ISRG X1 and X2. Cloudflare issues the site's certificate from one of these.
const char* ROOT_CAS = R"PEM(
-----BEGIN CERTIFICATE-----
MIIFVzCCAz+gAwIBAgINAgPlk28xsBNJiGuiFzANBgkqhkiG9w0BAQwFADBHMQsw
CQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2VzIExMQzEU
MBIGA1UEAxMLR1RTIFJvb3QgUjEwHhcNMTYwNjIyMDAwMDAwWhcNMzYwNjIyMDAw
MDAwWjBHMQswCQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZp
Y2VzIExMQzEUMBIGA1UEAxMLR1RTIFJvb3QgUjEwggIiMA0GCSqGSIb3DQEBAQUA
A4ICDwAwggIKAoICAQC2EQKLHuOhd5s73L+UPreVp0A8of2C+X0yBoJx9vaMf/vo
27xqLpeXo4xL+Sv2sfnOhB2x+cWX3u+58qPpvBKJXqeqUqv4IyfLpLGcY9vXmX7w
Cl7raKb0xlpHDU0QM+NOsROjyBhsS+z8CZDfnWQpJSMHobTSPS5g4M/SCYe7zUjw
TcLCeoiKu7rPWRnWr4+wB7CeMfGCwcDfLqZtbBkOtdh+JhpFAz2weaSUKK0Pfybl
qAj+lug8aJRT7oM6iCsVlgmy4HqMLnXWnOunVmSPlk9orj2XwoSPwLxAwAtcvfaH
szVsrBhQf4TgTM2S0yDpM7xSma8ytSmzJSq0SPly4cpk9+aCEI3oncKKiPo4Zor8
Y/kB+Xj9e1x3+naH+uzfsQ55lVe0vSbv1gHR6xYKu44LtcXFilWr06zqkUspzBmk
MiVOKvFlRNACzqrOSbTqn3yDsEB750Orp2yjj32JgfpMpf/VjsPOS+C12LOORc92
wO1AK/1TD7Cn1TsNsYqiA94xrcx36m97PtbfkSIS5r762DL8EGMUUXLeXdYWk70p
aDPvOmbsB4om3xPXV2V4J95eSRQAogB/mqghtqmxlbCluQ0WEdrHbEg8QOB+DVrN
VjzRlwW5y0vtOUucxD/SVRNuJLDWcfr0wbrM7Rv1/oFB2ACYPTrIrnqYNxgFlQID
AQABo0IwQDAOBgNVHQ8BAf8EBAMCAYYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4E
FgQU5K8rJnEaK0gnhS9SZizv8IkTcT4wDQYJKoZIhvcNAQEMBQADggIBAJ+qQibb
C5u+/x6Wki4+omVKapi6Ist9wTrYggoGxval3sBOh2Z5ofmmWJyq+bXmYOfg6LEe
QkEzCzc9zolwFcq1JKjPa7XSQCGYzyI0zzvFIoTgxQ6KfF2I5DUkzps+GlQebtuy
h6f88/qBVRRiClmpIgUxPoLW7ttXNLwzldMXG+gnoot7TiYaelpkttGsN/H9oPM4
7HLwEXWdyzRSjeZ2axfG34arJ45JK3VmgRAhpuo+9K4l/3wV3s6MJT/KYnAK9y8J
ZgfIPxz88NtFMN9iiMG1D53Dn0reWVlHxYciNuaCp+0KueIHoI17eko8cdLiA6Ef
MgfdG+RCzgwARWGAtQsgWSl4vflVy2PFPEz0tv/bal8xa5meLMFrUKTX5hgUvYU/
Z6tGn6D/Qqc6f1zLXbBwHSs09dR2CQzreExZBfMzQsNhFRAbd03OIozUhfJFfbdT
6u9AWpQKXCBfTkBdYiJ23//OYb2MI3jSNwLgjt7RETeJ9r/tSQdirpLsQBqvFAnZ
0E6yove+7u7Y/9waLd64NnHi/Hm3lCXRSHNboTXns5lndcEZOitHTtNCjv0xyBZm
2tIMPNuzjsmhDYAPexZ3FL//2wmUspO8IFgV6dtxQ/PeEMMA3KgqlbbC1j+Qa3bb
bP6MvPJwNQzcmRk13NfIRmPVNnGuV/u3gm3c
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
MIICCTCCAY6gAwIBAgINAgPlwGjvYxqccpBQUjAKBggqhkjOPQQDAzBHMQswCQYD
VQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2VzIExMQzEUMBIG
A1UEAxMLR1RTIFJvb3QgUjQwHhcNMTYwNjIyMDAwMDAwWhcNMzYwNjIyMDAwMDAw
WjBHMQswCQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2Vz
IExMQzEUMBIGA1UEAxMLR1RTIFJvb3QgUjQwdjAQBgcqhkjOPQIBBgUrgQQAIgNi
AATzdHOnaItgrkO4NcWBMHtLSZ37wWHO5t5GvWvVYRg1rkDdc/eJkTBa6zzuhXyi
QHY7qca4R9gq55KRanPpsXI5nymfopjTX15YhmUPoYRlBtHci8nHc8iMai/lxKvR
HYqjQjBAMA4GA1UdDwEB/wQEAwIBhjAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQW
BBSATNbrdP9JNqPV2Py1PsVq8JQdjDAKBggqhkjOPQQDAwNpADBmAjEA6ED/g94D
9J+uHXqnLrmvT/aDHQ4thQEd0dlq7A/Cr8deVl5c1RxYIigL9zC2L7F8AjEA8GE8
p/SgguMh1YQdc4acLa/KNJvxn7kjNuK8YAOdgLOaVsjh4rsUecrNIdSUtUlD
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4
WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu
ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY
MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc
h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+
0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U
A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW
T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH
B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC
B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv
KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn
OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn
jh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw
qHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI
rU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV
HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq
hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL
ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ
3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK
NFtY2PwByVS5uCbMiogziUwthDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5
ORAzI4JMPJ+GslWYHb4phowim57iaztXOoJwTdwJx4nLCgdNbOhdjsnvzqvHu7Ur
TkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIuvtd7u+Nxe5AW0wdeRlN8NwdC
jNPElpzVmbUq4JUagEiuTDkHzsxHpFKVK7q4+63SM1N95R1NbdWhscdCb+ZAJzVc
oyi3B43njTOQ5yOf+1CceWxG1bQVs5ZufpsMljq4Ui0/1lvh+wjChP4kqKOJ2qxq
4RgqsahDYVvTH9w7jXbyLeiNdd8XM2w9U/t7y0Ff/9yi0GE44Za4rF2LN9d11TPA
mRGunUHBcnWEvgJBQl9nJEiU0Zsnvgc/ubhPgXRR4Xq37Z0j4r7g1SgEEzwxA57d
emyPxgcYxn/eR44/KJ4EBs+lVDR3veyJm+kXQ99b21/+jh5Xos1AnX5iItreGCc=
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
MIICGzCCAaGgAwIBAgIQQdKd0XLq7qeAwSxs6S+HUjAKBggqhkjOPQQDAzBPMQsw
CQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJuZXQgU2VjdXJpdHkgUmVzZWFyY2gg
R3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBYMjAeFw0yMDA5MDQwMDAwMDBaFw00
MDA5MTcxNjAwMDBaME8xCzAJBgNVBAYTAlVTMSkwJwYDVQQKEyBJbnRlcm5ldCBT
ZWN1cml0eSBSZXNlYXJjaCBHcm91cDEVMBMGA1UEAxMMSVNSRyBSb290IFgyMHYw
EAYHKoZIzj0CAQYFK4EEACIDYgAEzZvVn4CDCuwJSvMWSj5cz3es3mcFDR0HttwW
+1qLFNvicWDEukWVEYmO6gbf9yoWHKS5xcUy4APgHoIYOIvXRdgKam7mAHf7AlF9
ItgKbppbd9/w+kHsOdx1ymgHDB/qo0IwQDAOBgNVHQ8BAf8EBAMCAQYwDwYDVR0T
AQH/BAUwAwEB/zAdBgNVHQ4EFgQUfEKWrt5LSDv6kviejM9ti6lyN5UwCgYIKoZI
zj0EAwMDaAAwZQIwe3lORlCEwkSHRhtFcP9Ymd70/aTSVaYgLXTWNLxBo1BfASdW
tL4ndQavEi51mI38AjEAi/V3bNTIZargCyzuFJ0nN6T5U6VR5CmD1/iQMVtCnwr1
/q4AaOeMSQ+2b1tbFfLn
-----END CERTIFICATE-----
)PEM";

bool motion = false;          // debounced PIR state
int sentState = -1;           // last state ProbeHarbor accepted
unsigned long lastPost = 0, changedAt = 0, retryAfterMs = 0;
bool trouble = false;

void setColor(uint8_t r, uint8_t g, uint8_t b) {
  if (COMMON_ANODE) { r = 255 - r; g = 255 - g; b = 255 - b; }
  analogWrite(LED_R, r);
  analogWrite(LED_G, g);
  analogWrite(LED_B, b);
}

// Returns the HTTP status, or a negative number if the request never got an answer.
int postMotion(bool on) {
  WiFiClientSecure tls;
  tls.setCACert(ROOT_CAS);
  HTTPClient http;
  const char* keep[] = {"Retry-After"};
  http.collectHeaders(keep, 1);
  if (!http.begin(tls, ingestUrl)) return -1;
  http.addHeader("Content-Type", "application/json");
  char body[64];
  snprintf(body, sizeof(body), "{\"%s\":%s}", sensorKey.c_str(), on ? "true" : "false");
  const int code = http.POST(body);
  if (code == 429) retryAfterMs = 1000UL * (unsigned long)max(10L, http.header("Retry-After").toInt());
  http.end();
  return code;
}

void setup() {
  Serial.begin(115200);
  pinMode(PIR_PIN, INPUT);  // the HC-SR501 drives its output high and low itself
  pinMode(LED_R, OUTPUT);
  pinMode(LED_G, OUTPUT);
  pinMode(LED_B, OUTPUT);
  setColor(0, 0, 80);
  benchSettingsBoot();
  wifiSsid = benchSetting("wifi_ssid", WIFI_SSID);
  wifiPass = benchSetting("wifi_pass", WIFI_PASS);
  ingestUrl = benchSetting("ingest_url", INGEST_URL);
  sensorKey = benchSetting("sensor_key", SENSOR_KEY);
  if (sensorKey.length() == 0 || sensorKey.length() > 24) sensorKey = SENSOR_KEY;  // keep the JSON body small
  benchNeeds("Wi-Fi name", wifiSsid, "your-wifi", "WIFI_SSID");
  benchNeeds("ProbeHarbor ingest address", ingestUrl, "https://probeharbor.dev/api/ingest/YOUR_DEVICE_KEY", "INGEST_URL");
  WiFi.begin(wifiSsid.c_str(), wifiPass.c_str());
  while (WiFi.status() != WL_CONNECTED) delay(250);
  Serial.printf("wifi ok %s\n", WiFi.localIP().toString().c_str());
}

void loop() {
  benchSettingsPoll();
  const unsigned long now = millis();

  // Debounce: the PIR output has to hold a new level for 200 ms.
  const bool raw = digitalRead(PIR_PIN) == HIGH;
  static bool lastRaw = false;
  static unsigned long rawSince = 0;
  if (raw != lastRaw) { lastRaw = raw; rawSince = now; }
  if (raw != motion && now - rawSince >= 200) {
    motion = raw;
    changedAt = now;
    Serial.printf("motion = %d\n", motion ? 1 : 0);
  }

  const bool warming = now < WARMUP_MS;
  if (warming) setColor(0, (now / 300) % 2 ? 60 : 0, 0);
  else if (trouble) setColor(0, 0, 160);
  else if (motion) setColor(200, 0, 0);
  else setColor(0, 60, 0);
  if (warming) return;

  if (WiFi.status() != WL_CONNECTED) {
    trouble = true;
    static unsigned long lastTry = 0;
    if (now - lastTry > 10000) { lastTry = now; WiFi.reconnect(); }
    return;
  }

  const bool changed = (int)motion != sentState;
  const bool heartbeat = now - lastPost >= HEARTBEAT_MS;
  const unsigned long gap = retryAfterMs ? retryAfterMs : MIN_GAP_MS;
  if ((changed || heartbeat) && (lastPost == 0 || now - lastPost >= gap)) {
    lastPost = now;
    retryAfterMs = 0;
    const int code = postMotion(motion);
    trouble = code < 200 || code >= 300;
    if (!trouble) sentState = motion;
    Serial.printf("posted %s %s\n", motion ? "motion" : "quiet", trouble ? "FAILED" : "ok");
    if (trouble) Serial.printf("ProbeHarbor answered HTTP %d\n", code);
  }
}
`,
    notes: [
      "In ProbeHarbor, add a push device and paste its ingest address into INGEST_URL. The sketch sends {\"motion1\": true} or false: ProbeHarbor files a true/false value whose name contains motion as a motion sensor, shown as MOTION or CLEAR.",
      "It posts when motion starts and stops, and again every 5 minutes so ProbeHarbor knows the sensor is alive. Posts are at least 10 seconds apart, well inside ProbeHarbor's 60 a minute, and if ProbeHarbor answers 429 it waits as long as asked.",
      "The HC-SR501 has two orange trimmers. Sx sets sensitivity, roughly 3 to 7 metres. Tx sets how long the output stays high after motion, from about 3 seconds to about 5 minutes: turn it fully anticlockwise for the shortest time, so ProbeHarbor sees each visit separately.",
      "Set the jumper to H (repeat trigger): the output then stays high as long as something keeps moving, instead of dropping out mid-visit. L gives one fixed pulse per trigger.",
      "After power-up the sensor needs about a minute to settle and may trigger on its own. The LED blinks green during that minute and nothing is sent.",
      "Which leg is common? On most 5 mm RGB LEDs it is the longest. If green shows as everything-but-green, you have a common-anode LED: set COMMON_ANODE to true and move the common leg to 3V3.",
      "PIR sensors see warm moving bodies, so heaters, sunlight on a wall or a draught from a vent can trigger them. Point it away from windows and heat sources.",
    ],
    open: ["Not tested on hardware or with ProbeHarbor yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    settings: [
      ...WIFI,
      {
        key: "ingest_url",
        label: "ProbeHarbor ingest address",
        kind: "url",
        hint: "Dashboard, Devices, add a push device, then copy its ingest address.",
        required: true,
      },
      { key: "sensor_key", label: "Sensor name", kind: "text", hint: "A name containing \"motion\" shows up as a motion sensor." },
    ],
    sample: [
      "wifi ok 192.168.1.75",
      "posted quiet ok",
      "motion = 1",
      "posted motion ok",
      "motion = 0",
      "posted quiet ok",
      "motion = 1",
      "posted motion ok",
      "motion = 0",
      "posted quiet ok",
      "motion = 1",
      "posted motion ok",
      "motion = 0",
      "posted quiet ok",
    ],
  },
  {
    id: "nrf24-link", needs: [["nrf24"]], name: "Arduino Uno to ESP32 radio link", level: "Intermediate", mins: 45, tags: ["wireless", "sensors"],
    sum: "Give an old Arduino Uno a radio: two nRF24L01+ modules carry a light sensor and a button from the Uno to an ESP32, which plots them on the bench and serves them on a web page.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    vars: {
      esp32: { SCK: "18", MISO: "19", MOSI: "23", CSN: "21", CE: "22" },
      esp32s3: { SCK: "12", MISO: "13", MOSI: "11", CSN: "10", CE: "9" },
      esp32c3: { SCK: "4", MISO: "5", MOSI: "6", CSN: "7", CE: "10" },
    },
    pins: ["3V3", "GND", "%SCK%", "%MISO%", "%MOSI%", "%CSN%", "%CE%"],
    libs: ["RF24", "WiFi (built in)", "WebServer (built in)"],
    baud: 115200,
    parts: [
      [1, "ESP32 dev board", BOM.esp32DevKit],
      [1, "Arduino Uno"],
      [2, "nRF24L01+ modules"],
      [2, "10 µF capacitors, one across each module's VCC and GND"],
      [1, "Photoresistor (light sensor) and a 10 kΩ resistor"],
      [1, "Push button"],
      [16, "Jumper wires"],
    ],
    wiring: [
      ["ESP32 nRF24 VCC", "3V3", "3.3 V only: 5 V destroys it"],
      ["10 µF capacitor", "3V3 to GND", "Right at the module, longer leg (+) to 3V3. The radio misbehaves without it"],
      ["ESP32 nRF24 GND", "GND", ""],
      ["ESP32 nRF24 SCK", "GPIO %SCK%", ""],
      ["ESP32 nRF24 MISO", "GPIO %MISO%", ""],
      ["ESP32 nRF24 MOSI", "GPIO %MOSI%", ""],
      ["ESP32 nRF24 CSN", "GPIO %CSN%", ""],
      ["ESP32 nRF24 CE", "GPIO %CE%", "IRQ stays unconnected"],
      ["Uno nRF24 VCC", "Uno 3.3V", "Again 3.3 V only"],
      ["Uno 10 µF capacitor", "Uno 3.3V to GND", "Right at the Uno's module, longer leg (+) to 3.3V"],
      ["Uno nRF24 GND", "Uno GND", ""],
      ["Uno nRF24 SCK / MISO / MOSI", "Uno 13 / 12 / 11", "The Uno's fixed SPI pins"],
      ["Uno nRF24 CSN / CE", "Uno 10 / 9", ""],
      ["Photoresistor", "Uno 5V to A0", "Brighter light, higher number"],
      ["10 kΩ resistor", "Uno A0 to GND", "The divider's bottom resistor"],
      ["Push button", "Uno 2 to GND", "Uses the Uno's internal pull-up"],
    ],
    code: R`// nRF24L01+ receiver on the ESP32: hears an Arduino Uno across the room or garage,
// prints what it sends for the bench plotter, and shows it on a small web page.
// Libraries: RF24 (by TMRh20). The Uno's sketch is further down this page.
#include <SPI.h>
#include <RF24.h>
#include <WiFi.h>
#include <WebServer.h>

const char* WIFI_SSID = "your-wifi";
const char* WIFI_PASS = "your-password";
${benchSettings(["wifi_ssid", "wifi_pass"])}

// ---- Pins ----
const int PIN_SCK = %SCK%, PIN_MISO = %MISO%, PIN_MOSI = %MOSI%;
const int PIN_CSN = %CSN%, PIN_CE = %CE%;

// Must match the Uno's sketch exactly.
const uint8_t ADDRESS[6] = "BNCH1";
const uint8_t CHANNEL = 108;  // 2.508 GHz, above the Wi-Fi channels

// The packet. Packed and fixed-size so the Uno (8-bit) and the ESP32 (32-bit) agree on its layout.
struct __attribute__((packed)) Packet {
  uint32_t seq;     // counts up with every packet
  uint16_t light;   // photoresistor, 0 (dark) to 1023 (bright)
  uint8_t button;   // 1 while the button is held
};

RF24 radio(PIN_CE, PIN_CSN);
WebServer server(80);
Packet last = {};
uint32_t received = 0, lost = 0;
unsigned long lastHeard = 0;

void handleRoot() {
  const unsigned long age = lastHeard ? (millis() - lastHeard) / 1000 : 0;
  char page[900];
  snprintf(page, sizeof(page),
           "<!doctype html><meta name=viewport content='width=device-width'>"
           "<meta http-equiv=refresh content=2><title>Radio link</title>"
           "<body style='font:18px system-ui;margin:2em'><h1>Uno over nRF24</h1>"
           "<p>Light: <b>%u</b> of 1023<p>Button: <b>%s</b>"
           "<p>Packets: %lu received, %lu missed<p>%s</body>",
           last.light, last.button ? "pressed" : "up", (unsigned long)received, (unsigned long)lost,
           lastHeard ? (age < 5 ? "The Uno is talking." : "No packets for a while: is the Uno on?") : "Waiting for the first packet.");
  server.send(200, "text/html", page);
}

void handleJson() {
  char json[160];
  snprintf(json, sizeof(json), "{\"light\":%u,\"button\":%u,\"seq\":%lu,\"received\":%lu,\"lost\":%lu}",
           last.light, last.button, (unsigned long)last.seq, (unsigned long)received, (unsigned long)lost);
  server.send(200, "application/json", json);
}

void setup() {
  Serial.begin(115200);
  SPI.begin(PIN_SCK, PIN_MISO, PIN_MOSI, PIN_CSN);
  if (!radio.begin(&SPI)) {
    Serial.println("nRF24 not found: check 3.3 V, the 10 uF capacitor and the SPI wires");
    while (true) delay(1000);
  }
  radio.setChannel(CHANNEL);
  radio.setDataRate(RF24_250KBPS);  // slower, but reaches further and tolerates noise
  radio.setPALevel(RF24_PA_LOW);    // raise to RF24_PA_HIGH for longer range
  radio.setPayloadSize(sizeof(Packet));
  radio.openReadingPipe(1, ADDRESS);
  radio.startListening();
  Serial.println("radio listening");

  benchSettingsBoot();
  const String wifiSsid = benchSetting("wifi_ssid", WIFI_SSID), wifiPass = benchSetting("wifi_pass", WIFI_PASS);
  benchNeeds("Wi-Fi name", wifiSsid, "your-wifi", "WIFI_SSID");
  WiFi.begin(wifiSsid.c_str(), wifiPass.c_str());
  for (int i = 0; i < 40 && WiFi.status() != WL_CONNECTED; i++) delay(250);
  if (WiFi.status() == WL_CONNECTED) {
    server.on("/", handleRoot);
    server.on("/data.json", handleJson);
    server.begin();
    Serial.printf("web page at http://%s/\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("Wi-Fi not joined; the radio still works on the serial port");
  }
}

void loop() {
  benchSettingsPoll();
  if (WiFi.status() == WL_CONNECTED) server.handleClient();
  while (radio.available()) {
    Packet p;
    radio.read(&p, sizeof(p));
    if (received > 0 && p.seq > last.seq + 1) lost += p.seq - last.seq - 1;
    last = p;
    received++;
    lastHeard = millis();
    Serial.printf("light = %u  button = %u\n", p.light, p.button);
  }
  static unsigned long lastReport = 0;
  if (millis() - lastReport >= 10000) {
    lastReport = millis();
    Serial.printf("missed = %lu\n", (unsigned long)lost);
  }
}
`,
    extraCode: {
      title: "Transmitter, Arduino sketch for the Uno",
      board: "Arduino Uno",
      code: R`// nRF24L01+ transmitter on an Arduino Uno: sends the photoresistor and a button
// to the ESP32 twice a second, and straight away when the button changes.
// Libraries: RF24 (by TMRh20). Board: Arduino Uno.
#include <SPI.h>
#include <RF24.h>

const int PIN_CE = 9, PIN_CSN = 10;  // SPI itself is fixed on the Uno: 11 MOSI, 12 MISO, 13 SCK
const int LIGHT_PIN = A0;            // photoresistor divider
const int BUTTON_PIN = 2;            // button to GND

const uint8_t ADDRESS[6] = "BNCH1";
const uint8_t CHANNEL = 108;

struct __attribute__((packed)) Packet {
  uint32_t seq;
  uint16_t light;
  uint8_t button;
};

RF24 radio(PIN_CE, PIN_CSN);
Packet p = {};
unsigned long lastSend = 0;

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  if (!radio.begin()) {
    Serial.println(F("nRF24 not found: check 3.3 V, the 10 uF capacitor and the SPI wires"));
    while (true) {}
  }
  radio.setChannel(CHANNEL);
  radio.setDataRate(RF24_250KBPS);
  radio.setPALevel(RF24_PA_LOW);
  radio.setPayloadSize(sizeof(Packet));
  radio.openWritingPipe(ADDRESS);
  radio.stopListening();
  Serial.println(F("radio sending"));
}

void loop() {
  const uint8_t button = digitalRead(BUTTON_PIN) == LOW;
  if (button != p.button || millis() - lastSend >= 500) {
    lastSend = millis();
    p.seq++;
    p.light = analogRead(LIGHT_PIN);
    p.button = button;
    const bool ok = radio.write(&p, sizeof(p));  // true when the ESP32 acknowledged it
    Serial.print(F("sent "));
    Serial.print(p.seq);
    Serial.println(ok ? F(" ok") : F(" no ack"));
  }
}
`,
    },
    notes: [
      "Upload the ESP32 sketch to the ESP32 and the Uno sketch (further down) to the Uno. Both use the RF24 library by TMRh20 from the Library Manager. The ESP32 prints its web address on the bench; open it on a phone to watch the light level.",
      "nRF24L01+ modules run on 3.3 V only. The Uno's 3.3V pin can supply a plain module like these (around 12 mA while sending), but not the long-range versions with an antenna and amplifier, which need their own 3.3 V regulator.",
      "The Uno's signals are 5 V. Nordic's datasheet lists the nRF24L01+ inputs as 5 V tolerant, and wiring them straight to an Uno is how most guides do it, but it is the module's supply, not its inputs, that must stay at 3.3 V. If a module behaves oddly, a level shifter on SCK, MOSI, CSN and CE is the careful fix.",
      "Most nRF24 trouble is power: the module draws short bursts that a long jumper cannot supply. The 10 µF capacitor right across VCC and GND fixes most 'not found' and dropped-packet problems.",
      "Both sketches use channel 108 (2.508 GHz), above the Wi-Fi channels, and 250 kbit/s, which reaches further than the default. Change CHANNEL on both if you run two links side by side.",
      "The packet is a packed struct with fixed-size fields, so the 8-bit Uno and the 32-bit ESP32 agree on its layout. Keep the two structs identical if you add fields.",
      "On the bench, light and button are charted as they arrive, and missed counts packets that never made it.",
    ],
    open: ["Not tested on hardware yet. The ESP32 sketch compiles for every board listed with Arduino-ESP32 core 3.3.12, and the Uno sketch compiles for the Arduino Uno (PlatformIO Atmel AVR 5.3.0)."],
    settings: [
      ...WIFI,
    ],
    sample: [
      "radio listening",
      "web page at http://192.168.1.76/",
      "light = 612  button = 0",
      "light = 615  button = 0",
      "light = 598  button = 0",
      "light = 402  button = 0",
      "light = 233  button = 1",
      "light = 230  button = 1",
      "light = 236  button = 0",
      "light = 410  button = 0",
      "missed = 0",
      "light = 588  button = 0",
      "light = 603  button = 0",
      "light = 611  button = 0",
      "missed = 1",
      "light = 608  button = 0",
      "light = 606  button = 0",
      "missed = 1",
    ],
  },
  {
    id: "led-matrix", needs: [["max7219"]], name: "Scrolling LED matrix", level: "Starter", mins: 20, tags: ["display", "lights"], added: "2026-11-13",
    sum: "Scroll your own text across a chain of MAX7219 8x8 LED matrix modules. Type a new message on the bench and it scrolls straight away.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    vars: {
      esp32: { DIN: "23", CLK: "18", CS: "5" },
      esp32s3: { DIN: "11", CLK: "12", CS: "10" },
      esp32c3: { DIN: "6", CLK: "4", CS: "7" },
    },
    pins: ["5V", "GND", "%DIN%", "%CLK%", "%CS%"],
    libs: ["MD_Parola", "MD_MAX72XX"], baud: 115200,
    parts: [
      [1, "ESP32 dev board", BOM.esp32DevKit],
      [1, "MAX7219 4-in-1 LED matrix module, FC-16 style (four 8x8 matrices)"],
      [1, "Optional: 74AHCT125 level shifter, for modules that miss the 3.3 V data signal", BOM.levelShifter],
      [5, "Jumper wires"],
    ],
    wiring: [
      ["Matrix VCC", "5V", "Keep the brightness low on USB power: four modules flat out draw close to 1 A"],
      ["Matrix GND", "GND", ""],
      ["Matrix DIN", "GPIO %DIN%", "Data into the first module, at the end with DIN printed on it"],
      ["Matrix CS", "GPIO %CS%", "Also labelled LOAD"],
      ["Matrix CLK", "GPIO %CLK%", ""],
    ],
    code: R`// Scrolling text on MAX7219 LED matrix modules (the common 4-in-1 FC-16 boards).
// Type in the bench: text Hello there | bright 0-15 | speed 10-500
#include <MD_Parola.h>
#include <MD_MAX72xx.h>

// FC16_HW suits the common blue 4-in-1 boards. If letters come out mirrored,
// upside down or in the wrong module order, try PAROLA_HW, GENERIC_HW or ICSTATION_HW.
#define HARDWARE_TYPE MD_MAX72XX::FC16_HW
const uint8_t MODULES = 4;  // 8x8 modules chained together
const uint8_t DATA_PIN = %DIN%;
const uint8_t CLK_PIN = %CLK%;
const uint8_t CS_PIN = %CS%;

MD_Parola matrix(HARDWARE_TYPE, DATA_PIN, CLK_PIN, CS_PIN, MODULES);

char message[128] = "ESP32 Bench";
uint8_t brightness = 2;  // 0 to 15: low is kind to a USB port
uint16_t speedMs = 50;   // ms per column, lower is faster
uint32_t passes = 0;
String line;

void startScroll() {
  matrix.displayClear();
  matrix.displayText(message, PA_LEFT, speedMs, 0, PA_SCROLL_LEFT, PA_SCROLL_LEFT);
}

void help() {
  Serial.println("commands: text <message>, bright <0-15>, speed <10-500>");
}

void handle(const String& cmd) {
  if (cmd.startsWith("text ")) {
    cmd.substring(5).toCharArray(message, sizeof message);
    startScroll();
    Serial.printf("text: %s\n", message);
  } else if (cmd.startsWith("bright ")) {
    brightness = (uint8_t)constrain(cmd.substring(7).toInt(), 0L, 15L);
    matrix.setIntensity(brightness);
    Serial.printf("brightness = %u\n", (unsigned)brightness);
  } else if (cmd.startsWith("speed ")) {
    speedMs = (uint16_t)constrain(cmd.substring(6).toInt(), 10L, 500L);
    matrix.setSpeed(speedMs);
    Serial.printf("speed = %u ms\n", (unsigned)speedMs);
  } else if (cmd.length()) {
    help();
  }
}

void setup() {
  Serial.begin(115200);
  matrix.begin();
  matrix.setIntensity(brightness);
  startScroll();
  Serial.printf("matrix ready: %u modules, FC16_HW, DIN %u CLK %u CS %u\n",
                (unsigned)MODULES, (unsigned)DATA_PIN, (unsigned)CLK_PIN, (unsigned)CS_PIN);
  help();
}

void loop() {
  if (matrix.displayAnimate()) {  // true once the text has scrolled off
    matrix.displayReset();
    Serial.printf("passes = %lu\n", (unsigned long)++passes);
  }
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      line.trim();
      handle(line);
      line = "";
    } else if (line.length() < 120) {
      line += c;
    }
  }
}`,
    open: ["Not tested on hardware yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    notes: [
      "The module runs on 5 V, but the ESP32's data lines are 3.3 V. That is just under the MAX7219's rated high level when it runs on 5 V. Most modules work anyway; if the display shows garbage or stays dark, put a 74AHCT125 level shifter on DIN, CLK and CS, or try powering the matrix from 3.3 V at low brightness.",
      "Each lit LED adds current. Four modules at full brightness can draw close to 1 A, more than a computer's USB port should give. The sketch starts at brightness 2; for a bright sign, use a separate 5 V supply with its GND joined to the ESP32's GND.",
      "Modules chain: DOUT of one goes to DIN of the next, with VCC, GND, CS and CLK shared. Change MODULES to match how many 8x8 blocks you have.",
      "If the text is mirrored, upside down or the modules run in the wrong order, the hardware type is wrong. FC16_HW suits most cheap 4-in-1 boards; the others are PAROLA_HW, GENERIC_HW and ICSTATION_HW.",
      "The sketch drives the pins in software, so any free GPIOs work. The ones chosen are the board's usual SPI pins, which keeps the wiring familiar.",
    ],
    sample: [
      "matrix ready: 4 modules, FC16_HW, DIN %DIN% CLK %CLK% CS %CS%",
      "commands: text <message>, bright <0-15>, speed <10-500>",
      "passes = 1",
      "passes = 2",
      "text: Hello from the bench",
      "passes = 3",
      "brightness = 6",
      "passes = 4",
      "passes = 5",
    ],
  },
  {
    id: "rtc-clock", needs: [["ds3231"]], name: "DS3231 real-time clock", level: "Starter", mins: 20, tags: ["logging"], added: "2026-11-13",
    sum: "Keep accurate time without Wi-Fi using a DS3231 clock module and its coin cell, with a daily alarm that beeps and the chip's own temperature for the plotter.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    vars: {
      esp32: { SDA: "21", SCL: "22", BUZZ: "25" },
      esp32s3: { SDA: "8", SCL: "9", BUZZ: "4" },
      esp32c3: { SDA: "6", SCL: "7", BUZZ: "5" },
    },
    pins: ["3V3", "GND", "%SDA%", "%SCL%", "%BUZZ%"],
    libs: ["RTClib (Adafruit)", "Wire (built in)"], baud: 115200,
    parts: [
      [1, "ESP32 dev board", BOM.esp32DevKit],
      [1, "DS3231 real-time clock module", BOM.rtcDs3231],
      [1, "CR2032 coin cell, or LIR2032 if your module charges the cell"],
      [1, "Optional: passive buzzer or piezo, for the alarm", BOM.piezoBuzzer],
      [6, "Jumper wires"],
    ],
    wiring: [
      ["RTC VCC", "3V3", "3.3 V also keeps the common ZS-042 module from charging its coin cell; see the notes"],
      ["RTC GND", "GND", ""],
      ["RTC SDA", "GPIO %SDA%", "The module has its own pull-ups"],
      ["RTC SCL", "GPIO %SCL%", ""],
      ["Optional: buzzer +", "GPIO %BUZZ%", ""],
      ["Optional: buzzer -", "GND", ""],
    ],
    code: R`// DS3231 real-time clock: keeps the time without Wi-Fi, on its coin cell through power cuts.
// Type in the bench: set 2026-11-13 14:30:00 | alarm 07:30 | alarm off | now
#include <Wire.h>
#include <RTClib.h>

const int SDA_PIN = %SDA%, SCL_PIN = %SCL%;
const int BUZZER = %BUZZ%;  // optional passive buzzer for the alarm

RTC_DS3231 rtc;
bool found = false;
uint32_t lastPrint = 0, lastTry = 0;
String line;

void printDate(const DateTime& t) {
  Serial.printf("date %04d-%02d-%02d\n", t.year(), t.month(), t.day());
}

void help() {
  Serial.println("commands: set YYYY-MM-DD HH:MM:SS, alarm HH:MM, alarm off, now");
}

bool connectRtc() {
  found = rtc.begin(&Wire);
  if (!found) {
    Serial.println("DS3231 not found at 0x68: check SDA, SCL and power");
    return false;
  }
  if (rtc.lostPower()) {
    rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
    Serial.println("RTC lost power: time set from when the sketch was compiled. Correct it with set");
  }
  rtc.disable32K();
  rtc.writeSqwPinMode(DS3231_OFF);  // SQW pin as the alarm output, not a square wave
  rtc.clearAlarm(1);
  rtc.clearAlarm(2);
  rtc.disableAlarm(2);
  printDate(rtc.now());
  return true;
}

void handle(const String& cmd) {
  int y, mo, d, h, mi, s;
  if (sscanf(cmd.c_str(), "set %d-%d-%d %d:%d:%d", &y, &mo, &d, &h, &mi, &s) == 6) {
    rtc.adjust(DateTime(y, mo, d, h, mi, s));
    Serial.println("time set");
    printDate(rtc.now());
  } else if (cmd == "alarm off") {
    rtc.disableAlarm(1);
    rtc.clearAlarm(1);
    Serial.println("alarm off");
  } else if (sscanf(cmd.c_str(), "alarm %d:%d", &h, &mi) == 2) {
    rtc.clearAlarm(1);
    rtc.setAlarm1(DateTime(2000, 1, 1, h, mi, 0), DS3231_A1_Hour);  // every day at h:mi
    Serial.printf("alarm set for %02d:%02d every day\n", h, mi);
  } else if (cmd == "now") {
    printDate(rtc.now());
  } else if (cmd.length()) {
    help();
  }
}

void setup() {
  Serial.begin(115200);
  Wire.begin(SDA_PIN, SCL_PIN);
  connectRtc();
  help();
}

void loop() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      line.trim();
      if (found) handle(line);
      line = "";
    } else if (line.length() < 60) {
      line += c;
    }
  }
  if (!found) {
    if (millis() - lastTry > 5000) {
      lastTry = millis();
      connectRtc();
    }
    return;
  }
  if (millis() - lastPrint >= 1000) {
    lastPrint = millis();
    DateTime t = rtc.now();
    // The DS3231 measures its own temperature to correct the crystal; it updates every 64 s.
    Serial.printf("%02d:%02d:%02d  temp_c = %.2f\n", t.hour(), t.minute(), t.second(), rtc.getTemperature());
    if (t.hour() == 0 && t.minute() == 0 && t.second() == 0) printDate(t);
  }
  if (rtc.alarmFired(1)) {
    rtc.clearAlarm(1);
    DateTime t = rtc.now();
    Serial.printf("ALARM %02d:%02d\n", t.hour(), t.minute());
    for (int i = 0; i < 3; i++) {
      tone(BUZZER, 2000, 200);
      delay(400);
    }
  }
}`,
    open: ["Not tested on hardware yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    notes: [
      "On first start, or after the coin cell ran flat, the clock is set from the time the sketch was compiled. Send set 2026-11-13 14:30:00 (your own date and time) on the bench to correct it; it then keeps time through power cuts on the coin cell.",
      "The popular ZS-042 module has a resistor and diode that trickle-charge the coin cell from VCC, meant for a rechargeable LIR2032. Never let it charge a normal CR2032. Powered from 3.3 V, as here, the diode drop leaves too little voltage to charge a 3 V cell, so a CR2032 is safe. If you run the module from 5 V with a CR2032, remove the charging diode or its resistor first, or fit an LIR2032.",
      "The DS3231 is accurate to about two seconds a day without any network, because it measures its own temperature and corrects its crystal. That temperature is what the sketch prints; it is the chip's, roughly the room's, updated every 64 seconds.",
      "Alarm 1 fires once a day at the time you set. The sketch asks the clock over I2C whether it has fired, so the SQW pin can stay unconnected; wire it to a GPIO only if you want an interrupt or to wake from deep sleep.",
      "DS3231 modules usually also carry an AT24C32 memory chip at address 0x57. The I2C scanner project will show both.",
    ],
    sample: [
      "date 2026-11-13",
      "commands: set YYYY-MM-DD HH:MM:SS, alarm HH:MM, alarm off, now",
      "14:30:00  temp_c = 23.50",
      "14:30:01  temp_c = 23.50",
      "14:30:02  temp_c = 23.50",
      "alarm set for 14:31 every day",
      "14:30:03  temp_c = 23.75",
      "14:30:04  temp_c = 23.75",
      "14:30:05  temp_c = 23.75",
      "ALARM 14:31",
      "14:31:01  temp_c = 23.75",
    ],
  },
  {
    id: "tft-display", needs: [["tft"]], name: "Colour TFT dashboard", level: "Intermediate", mins: 25, tags: ["display"], added: "2026-11-13",
    sum: "Drive a 2 inch ST7789 colour screen: a sweeping colour gauge, a bouncing ball and a live frame-rate counter, with no sensors or Wi-Fi needed.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    vars: {
      esp32: { SCK: "18", MOSI: "23", CS: "5", DC: "16", RST: "17", BL: "4" },
      esp32s3: { SCK: "12", MOSI: "11", CS: "10", DC: "9", RST: "8", BL: "7" },
      esp32c3: { SCK: "4", MOSI: "6", CS: "7", DC: "10", RST: "1", BL: "3" },
    },
    pins: ["3V3", "GND", "%SCK%", "%MOSI%", "%CS%", "%DC%", "%RST%", "%BL%"],
    libs: ["Adafruit ST7735 and ST7789 Library", "Adafruit GFX Library", "SPI (built in)"], baud: 115200,
    parts: [
      [1, "ESP32 dev board", BOM.esp32DevKit],
      [1, "2.0 inch 320 by 240 ST7789 SPI TFT display", BOM.tftSt7789],
      [8, "Jumper wires"],
    ],
    wiring: [
      ["TFT VCC", "3V3", ""],
      ["TFT GND", "GND", ""],
      ["TFT SCL", "GPIO %SCK%", "SPI clock, despite the name"],
      ["TFT SDA", "GPIO %MOSI%", "SPI data, despite the name"],
      ["TFT RST", "GPIO %RST%", "Labelled RES on some boards"],
      ["TFT DC", "GPIO %DC%", "Labelled RS or A0 on some boards"],
      ["TFT CS", "GPIO %CS%", ""],
      ["TFT BLK", "GPIO %BL%", "Backlight, also labelled BL or LED. High is on"],
    ],
    code: R`// ST7789 colour TFT dashboard: a sweeping gauge, a bouncing ball and the frame rate.
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>

// 2.0 inch boards are 240 by 320. For 1.3 and 1.54 inch boards set both to 240.
const int TFT_W = 240, TFT_H = 320;
const int SCK_PIN = %SCK%, MOSI_PIN = %MOSI%, CS_PIN = %CS%, DC_PIN = %DC%, RST_PIN = %RST%, BL_PIN = %BL%;

Adafruit_ST7789 tft(CS_PIN, DC_PIN, RST_PIN);  // hardware SPI, on the pins given to SPI.begin

const int GX = TFT_W / 2, GY = 120, GR = 90;  // gauge centre and radius
const int TOP = GY + 34, BOTTOM = TFT_H - 26;  // the ball's box
const int R = 10;                              // ball radius

float gaugeValue = 0, gaugeStep = 0.008f;
int needleX = GX, needleY = GY - GR + 16;
float ballX = 60, ballY = TOP + 40, vx = 2.6f, vy = 1.9f;
int lastBallX = 60, lastBallY = TOP + 40;
uint32_t frames = 0, lastSecond = 0;
float fps = 0;

uint16_t gaugeColour(float f) {  // green at 0, red at 1
  return tft.color565((uint8_t)(255 * f), (uint8_t)(255 * (1 - f)), 40);
}

void drawFace() {
  tft.fillScreen(ST77XX_BLACK);
  tft.setTextColor(ST77XX_WHITE, ST77XX_BLACK);
  tft.setTextSize(2);
  tft.setCursor(8, 8);
  tft.print("ESP32 Bench");
  for (int a = 0; a <= 180; a += 5) {
    float rad = radians(180.0f + a);
    uint16_t c = gaugeColour(a / 180.0f);
    for (int w = 0; w < 4; w++) {
      tft.drawLine(GX + cosf(rad) * (GR - 10 + w), GY + sinf(rad) * (GR - 10 + w),
                   GX + cosf(rad) * (GR + w), GY + sinf(rad) * (GR + w), c);
    }
  }
  tft.drawRect(0, TOP - 2, TFT_W, BOTTOM - TOP + 4, ST77XX_WHITE);
}

void drawNeedle() {
  tft.drawLine(GX, GY, needleX, needleY, ST77XX_BLACK);  // rub out the old one
  float rad = radians(180.0f + gaugeValue * 180.0f);
  needleX = GX + cosf(rad) * (GR - 16);
  needleY = GY + sinf(rad) * (GR - 16);
  tft.drawLine(GX, GY, needleX, needleY, gaugeColour(gaugeValue));
  tft.fillCircle(GX, GY, 5, ST77XX_WHITE);
  tft.setTextSize(3);
  tft.setCursor(GX - 27, GY + 6);
  tft.printf("%3d", (int)(gaugeValue * 100));
}

void drawBall() {
  ballX += vx;
  ballY += vy;
  if (ballX < R + 1 || ballX > TFT_W - R - 2) vx = -vx;
  if (ballY < TOP + R + 1 || ballY > BOTTOM - R - 1) vy = -vy;
  tft.fillCircle(lastBallX, lastBallY, R, ST77XX_BLACK);
  lastBallX = (int)ballX;
  lastBallY = (int)ballY;
  tft.fillCircle(lastBallX, lastBallY, R, tft.color565(255, 180, (frames * 3) & 255));
}

void setup() {
  Serial.begin(115200);
  pinMode(BL_PIN, OUTPUT);
  digitalWrite(BL_PIN, HIGH);  // backlight on
  SPI.begin(SCK_PIN, -1, MOSI_PIN, CS_PIN);  // before init, so the display uses these pins
  tft.init(TFT_W, TFT_H);
  tft.setSPISpeed(40000000);
  tft.setRotation(0);
  drawFace();
  Serial.printf("TFT ready: %dx%d ST7789\n", TFT_W, TFT_H);
}

void loop() {
  gaugeValue += gaugeStep;
  if (gaugeValue > 1 || gaugeValue < 0) {
    gaugeStep = -gaugeStep;
    gaugeValue += gaugeStep;
  }
  drawNeedle();
  drawBall();
  frames++;

  uint32_t now = millis();
  if (now - lastSecond >= 1000) {
    fps = frames * 1000.0f / (now - lastSecond);
    frames = 0;
    lastSecond = now;
    tft.setTextSize(2);
    tft.setCursor(8, TFT_H - 20);
    tft.printf("%5.1f fps  up %lus   ", fps, (unsigned long)(now / 1000));
    Serial.printf("fps = %.1f, uptime_s = %lu\n", fps, (unsigned long)(now / 1000));
  }
}`,
    open: ["Not tested on hardware yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    notes: [
      "The pins called SCL and SDA on these boards are SPI clock and data, not I2C. They go to the board's SPI clock and MOSI pins.",
      "Set TFT_W and TFT_H to your screen: 240 by 320 for 2.0 inch boards, 240 by 240 for 1.3 and 1.54 inch ones. Many 1.3 inch boards have no CS pin; tie nothing and pass -1 as CS in the constructor.",
      "If the colours look like a photo negative, add tft.invertDisplay(false) after tft.init. IPS panels differ.",
      "The display runs on 3.3 V logic, so it connects straight to the ESP32. Boards with a regulator are also happy on 5 V VCC, but the signals stay 3.3 V either way.",
      "This sketch uses Adafruit's ST7789 library because it works straight from the Library Manager. TFT_eSPI is faster but needs its own setup file edited for every board and pin layout, which does not suit a copy-and-paste sketch.",
      "The frame rate goes to the bench once a second, so the plotter charts it. Drawing only what moved, as this sketch does, is what keeps it smooth.",
    ],
    sample: [
      "TFT ready: 240x320 ST7789",
      "fps = 38.2, uptime_s = 1",
      "fps = 41.7, uptime_s = 2",
      "fps = 41.6, uptime_s = 3",
      "fps = 41.8, uptime_s = 4",
      "fps = 41.5, uptime_s = 5",
      "fps = 41.7, uptime_s = 6",
    ],
  },
  {
    id: "sd-logger", needs: [["sdcard"], ["ldr"]], name: "MicroSD data logger", level: "Intermediate", mins: 25, tags: ["logging", "sensors"], added: "2026-11-13",
    sum: "Log readings to a microSD card as a CSV file you can open in a spreadsheet: light level, free memory and, on the S3 and C3, the chip's own temperature. A new file every boot.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    vars: {
      esp32: { SCK: "18", MISO: "19", MOSI: "23", CS: "5", LDR: "34" },
      esp32s3: { SCK: "12", MISO: "13", MOSI: "11", CS: "10", LDR: "1" },
      esp32c3: { SCK: "4", MISO: "5", MOSI: "6", CS: "7", LDR: "0" },
    },
    pins: ["5V", "3V3", "GND", "%SCK%", "%MISO%", "%MOSI%", "%CS%", "%LDR%"],
    libs: ["SD (built in)", "SPI (built in)"], baud: 115200,
    parts: [
      [1, "ESP32 dev board", BOM.esp32DevKit],
      [1, "MicroSD card module", BOM.microSdBreakout],
      [1, "MicroSD card, 32 GB or smaller, formatted FAT32"],
      [1, "Photoresistor", BOM.photocell],
      [1, "10 kΩ resistor, for the light sensor"],
      [9, "Jumper wires"],
    ],
    wiring: [
      ["SD module VCC", "5V", "For modules with a regulator. A bare 3.3 V breakout without one needs 3.3 V instead: see the notes"],
      ["SD module GND", "GND", ""],
      ["SD module SCK", "GPIO %SCK%", ""],
      ["SD module MOSI", "GPIO %MOSI%", ""],
      ["SD module MISO", "GPIO %MISO%", ""],
      ["SD module CS", "GPIO %CS%", ""],
      ["Photoresistor", "3V3 to GPIO %LDR%", "One leg to 3V3, the other to the pin"],
      ["10 kΩ resistor", "GPIO %LDR% to GND", "With the photoresistor, brighter light gives a higher reading"],
    ],
    code: R`// Log readings to a microSD card as CSV: a new file each boot, saved every 30 s.
// Type in the bench: dump (print the current file) | files (list the card)
#include <SPI.h>
#include <SD.h>
#include "soc/soc_caps.h"

const int SCK_PIN = %SCK%, MISO_PIN = %MISO%, MOSI_PIN = %MOSI%, CS_PIN = %CS%;
const int LIGHT_PIN = %LDR%;   // photoresistor and 10 kOhm divider, an ADC1 pin
const uint32_t LOG_MS = 5000;  // one row every 5 s
const uint32_t FLUSH_EVERY = 6;  // save to the card every 6 rows, so 30 s

File logFile;
char path[16] = "";
bool cardOk = false;
uint32_t lastLog = 0, lastTry = 0, rows = 0;
String line;

float chipTemp() {
#if SOC_TEMP_SENSOR_SUPPORTED
  return temperatureRead();  // the chip's own die temperature, warmer than the room
#else
  return NAN;  // the classic ESP32 has no usable internal temperature sensor
#endif
}

bool openCard() {
  SD.end();
  if (!SD.begin(CS_PIN, SPI, 4000000)) {
    Serial.println("SD card not found: check the wiring, the CS pin and that the card is FAT32");
    return false;
  }
  for (int i = 1; i < 1000; i++) {  // the first free name: /log001.csv, /log002.csv...
    snprintf(path, sizeof path, "/log%03d.csv", i);
    if (!SD.exists(path)) break;
  }
  logFile = SD.open(path, FILE_WRITE);
  if (!logFile) {
    Serial.printf("could not create %s: the card may be full or write-protected\n", path);
    return false;
  }
  logFile.println("ms,light,heap_free,chip_temp_c");
  logFile.flush();
  Serial.printf("card %llu MB, %llu MB free\n", SD.totalBytes() / 1048576ULL,
                (SD.totalBytes() - SD.usedBytes()) / 1048576ULL);
  Serial.printf("logging to %s every %lu s\n", path, (unsigned long)(LOG_MS / 1000));
  rows = 0;
  return true;
}

void dumpFile() {
  if (!cardOk) return;
  logFile.close();
  File f = SD.open(path, FILE_READ);
  Serial.printf("--- %s ---\n", path);
  while (f && f.available()) Serial.write(f.read());
  f.close();
  Serial.println("--- end ---");
  logFile = SD.open(path, FILE_APPEND);
}

void listFiles() {
  if (!cardOk) return;
  File root = SD.open("/");
  for (File f = root.openNextFile(); f; f = root.openNextFile()) {
    Serial.printf("%s  %lu bytes\n", f.name(), (unsigned long)f.size());
    f.close();
  }
  root.close();
}

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  SPI.begin(SCK_PIN, MISO_PIN, MOSI_PIN, CS_PIN);
  cardOk = openCard();
  Serial.println("commands: dump, files");
}

void loop() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      line.trim();
      if (line == "dump") dumpFile();
      else if (line == "files") listFiles();
      else if (line.length()) Serial.println("commands: dump, files");
      line = "";
    } else if (line.length() < 20) {
      line += c;
    }
  }

  if (!cardOk) {  // card missing or removed: try again every 10 s
    if (millis() - lastTry > 10000) {
      lastTry = millis();
      cardOk = openCard();
    }
    return;
  }
  if (millis() - lastLog < LOG_MS) return;
  lastLog = millis();

  int light = analogRead(LIGHT_PIN);
  uint32_t heap = ESP.getFreeHeap();
  float temp = chipTemp();
  char tempText[12] = "";
  if (!isnan(temp)) snprintf(tempText, sizeof tempText, "%.1f", temp);

  char row[64];
  int n = snprintf(row, sizeof row, "%lu,%d,%lu,%s", (unsigned long)millis(), light, (unsigned long)heap, tempText);
  if (logFile.println(row) < (size_t)n) {
    Serial.println("write failed: the card is full or was removed");
    logFile.close();
    cardOk = false;
    return;
  }
  // Rows wait in memory until a flush writes them to the card. Pulling the card or
  // the power loses at most the rows since the last flush; flushing every row would
  // wear the card and slow the logging.
  if (++rows % FLUSH_EVERY == 0) logFile.flush();
  if (isnan(temp)) Serial.printf("light = %d, heap_free = %lu\n", light, (unsigned long)heap);
  else Serial.printf("light = %d, heap_free = %lu, chip_temp_c = %.1f\n", light, (unsigned long)heap, temp);
}`,
    open: ["Not tested on hardware yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    notes: [
      "SD modules come in two kinds. The common blue module with a small three-pin regulator chip and a level-shifter chip wants 5 V on VCC: at 3.3 V its regulator leaves the card underpowered. A bare 3.3 V breakout has no regulator and must go to 3V3, never 5 V. Adafruit's breakout works on either.",
      "Format the card FAT32. Cards larger than 32 GB come as exFAT and usually need reformatting with a FAT32 tool first.",
      "Each boot starts a new file, /log001.csv, /log002.csv and so on, so restarts never overwrite old data. Send files on the bench to list them and dump to print the current one.",
      "Rows are saved to the card every 30 seconds. Unplugging the power or the card can lose up to the last 30 seconds; the rest of the file is safe. That keeps card wear down compared with saving every row.",
      "The chip temperature column only fills on the ESP32-S3 and ESP32-C3, which have an internal sensor. It reads the chip's die, several degrees above the room. The classic ESP32 leaves the column empty.",
      "If the card is removed or fills up, the sketch says so on the bench and tries again every 10 seconds, starting a new file when it succeeds.",
      "Open the file in a spreadsheet: the ms column is milliseconds since boot. For real dates, add the DS3231 real-time clock project's clock and log its time instead.",
    ],
    sample: [
      "card 15193 MB, 15187 MB free",
      "logging to /log004.csv every 5 s",
      "commands: dump, files",
      "light = 1834, heap_free = 252316, chip_temp_c = 38.4",
      "light = 1829, heap_free = 252316, chip_temp_c = 38.6",
      "light = 2410, heap_free = 252316, chip_temp_c = 38.6",
      "light = 2398, heap_free = 252316, chip_temp_c = 38.7",
      "light = 1102, heap_free = 252316, chip_temp_c = 38.7",
    ],
  },
  ...PROBEHARBOR_SKETCHES,
];
