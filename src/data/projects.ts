import type { BoardId } from "./boards";
import { BOM } from "../lib/shop";
import { PROBEHARBOR_SKETCHES } from "./probeharbor";

export type Tag = "no-parts" | "sensors" | "display" | "lights" | "wifi" | "bluetooth" | "power" | "flash" | "probeharbor";

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
} as const;
export type DrawerPart = keyof typeof DRAWER;

export const TAGS: [Tag | "all", string][] = [
  ["all", "All"],
  ["flash", "Browser flash"],
  ["probeharbor", "ProbeHarbor"],
  ["no-parts", "No extra parts"],
  ["sensors", "Sensors"],
  ["display", "Display"],
  ["lights", "Lights"],
  ["wifi", "Wi-Fi"],
  ["bluetooth", "Bluetooth"],
  ["power", "Power"],
];

const fill = (text: string, vars: Record<string, string>) =>
  text.replace(/%([A-Z]+)%/g, (whole, name: string) => vars[name] ?? whole);

export const boardsOf = (p: Project): BoardId[] => p.boards ?? ["esp32"];

/** A project's pins, wiring and code with one board's values filled in. */
export function forBoard(p: Project, board: BoardId) {
  const vars = p.vars?.[board] ?? {};
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
    id: "probeharbor-probe", needs: [["ds18b20", "dht22", "i2c"]], name: "ProbeHarbor probe", level: "Starter", mins: 15, tags: ["flash", "probeharbor", "sensors", "wifi"],
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
      ["DS18B20 or DHT22 data", "GPIO 4", "4.7 kΩ pull-up to 3V3. Up to four DS18B20s share the line"],
      ["I2C sensor SDA", "GPIO %SDA%", "SHT31, BME280 or AHT20, found at boot"],
      ["I2C sensor SCL", "GPIO %SCL%", ""],
      ["Leak contact", "GPIO %LEAK%", "Other wire to GND. Only read when enabled in setup"],
      ["Door reed switch", "GPIO %DOOR%", "Other wire to GND. Only read when enabled in setup"],
      ["Battery divider midpoint", "GPIO %BAT%", "1:1 divider from a single Li-ion cell. Only read when enabled"],
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
    id: "wifi-scan", needs: [], name: "Wi-Fi scanner", level: "Starter", mins: 5, tags: ["no-parts", "wifi"],
    sum: "List nearby networks with signal strength and channel every ten seconds. A quick radio health check.",
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
    boards: ["esp32", "esp32s3", "esp32c3"],
    vars: { esp32: { SDA: "21", SCL: "22" }, esp32s3: { SDA: "8", SCL: "9" }, esp32c3: { SDA: "6", SCL: "7" } },
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
    wiring: [["DHT22 VCC", "3V3", ""], ["DHT22 DATA", "GPIO 4", "10 kΩ pull-up to 3V3 on a bare sensor"], ["DHT22 GND", "GND", ""]],
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
    wiring: [["HC-SR04 VCC", "5V", ""], ["HC-SR04 GND", "GND", ""], ["HC-SR04 TRIG", "GPIO 5", ""], ["HC-SR04 ECHO, through 1 kΩ", "GPIO 18", "Add 2 kΩ from GPIO 18 to GND to drop 5 V to 3.3 V"]],
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
    id: "deep-sleep", needs: [["button"]], name: "Deep sleep, button wake", level: "Intermediate", mins: 20, tags: ["power"],
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
    id: "web-led", needs: [], name: "Web page LED switch", level: "Intermediate", mins: 20, tags: ["wifi"],
    sum: "Join your Wi-Fi, serve a one-button page and switch GPIO 2 from any phone on the network.",
    pins: ["2"], libs: ["WiFi (built in)", "WebServer (built in)"], baud: 115200,
    parts: [[1, "ESP32 dev board", BOM.esp32DevKit], [1, "LED and 220 Ω resistor, only if your board has no LED on GPIO 2"]],
    wiring: [["LED anode, through 220 Ω", "GPIO 2", "Skip if your board has an onboard LED"], ["LED cathode", "GND", ""]],
    code: R`#include <WiFi.h>
#include <WebServer.h>

const char* WIFI_NAME = "your-network";
const char* WIFI_PASS = "your-password";
const int LED = 2;

WebServer server(80);
bool on = false;

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
  WiFi.begin(WIFI_NAME, WIFI_PASS);
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
  server.handleClient();
}`,
    sample: [".......", "Open http://192.168.1.57"]
  },
  {
    id: "touch-piano", needs: [], name: "Touch piano", level: "Starter", mins: 10, tags: ["no-parts", "sensors"],
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
    id: "esp-now", needs: [], name: "ESP-NOW pair", level: "Intermediate", mins: 20, tags: ["no-parts", "wifi"],
    sum: "Two boards talk directly over the Wi-Fi radio, with no router. Each sends a counter and prints what the other sends.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    pins: [], libs: ["WiFi (built in)", "esp_now (built in)"], baud: 115200,
    parts: [
      [2, "ESP32 dev boards, any mix of ESP32, S3 and C3", BOM.esp32DevKit],
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
    id: "mqtt-ha", needs: [["ds18b20"]], name: "Home Assistant temperature", level: "Intermediate", mins: 30, tags: ["sensors", "wifi"],
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
      ["DS18B20 DATA (yellow)", "GPIO 4", "4.7 kΩ pull-up from DATA to 3V3"],
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
  const char* user = strlen(MQTT_USER) > 0 ? MQTT_USER : nullptr;
  const char* pass = strlen(MQTT_PASS) > 0 ? MQTT_PASS : nullptr;
  while (!mqtt.connected()) {
    Serial.printf("mqtt connecting to %s\n", MQTT_HOST);
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

  Serial.printf("wifi joining %s\n", WIFI_NAME);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_NAME, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) delay(300);
  Serial.printf("wifi ok %s\n", WiFi.localIP().toString().c_str());

  String mac = WiFi.macAddress();
  mac.replace(":", "");
  mac.toLowerCase();
  id = String("esp32bench-") + mac.substring(6);
  stateTopic = String("esp32bench/") + id + "/temperature";
  statusTopic = String("esp32bench/") + id + "/status";

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setBufferSize(512);  // the discovery message is longer than the 256-byte default
}

void loop() {
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
    id: "ble-scan", needs: [], name: "Bluetooth LE scanner", level: "Starter", mins: 5, tags: ["no-parts", "bluetooth"],
    sum: "List nearby Bluetooth LE devices with their signal strength every ten seconds: phones, watches, beacons and sensors.",
    boards: ["esp32", "esp32s3", "esp32c3"],
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
      "The S3 and C3 only have Bluetooth LE. The classic ESP32 also has Classic Bluetooth, which this sketch does not scan.",
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
  ...PROBEHARBOR_SKETCHES,
];
