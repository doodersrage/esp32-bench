export type Tag = "no-parts" | "sensors" | "display" | "wifi" | "power";

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
  /** Pin labels to highlight on the pinout, e.g. "21", "3V3", "GND" */
  pins: string[];
  libs: string[];
  baud: number;
  /** [quantity, description] */
  parts: [number, string][];
  /** [from, to, note] */
  wiring: [string, string, string][];
  /** Arduino sketch */
  code: string;
  /** Lines the sketch prints when it works */
  sample: string[];
}

export const TAGS: [Tag | "all", string][] = [
  ["all", "All"],
  ["no-parts", "No extra parts"],
  ["sensors", "Sensors"],
  ["display", "Display"],
  ["wifi", "Wi-Fi"],
  ["power", "Power"],
];

/** ESP32-DevKitC V4 headers, top to bottom with USB at the bottom. */
export const LEFT_PINS = ["3V3", "EN", "VP", "VN", "34", "35", "32", "33", "25", "26", "27", "14", "12", "GND", "13", "D2", "D3", "CMD", "5V"];
export const RIGHT_PINS = ["GND", "23", "22", "TX", "RX", "21", "GND", "19", "18", "5", "17", "16", "4", "0", "2", "15", "D1", "D0", "CLK"];

const R = String.raw;

export const PROJECTS: Project[] = [
  {
    id: "blink", name: "Blink and heartbeat", level: "Starter", mins: 5, tags: ["no-parts"],
    sum: "Toggle the LED on GPIO 2 and print a tick every second. The first thing to flash on any new board.",
    pins: ["2"], libs: [], baud: 115200,
    parts: [[1, "ESP32 dev board"], [1, "LED and 220 Ω resistor, only if your board has no LED on GPIO 2"]],
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
    id: "wifi-scan", name: "Wi-Fi scanner", level: "Starter", mins: 5, tags: ["no-parts", "wifi"],
    sum: "List nearby networks with signal strength and channel every ten seconds. A quick radio health check.",
    pins: [], libs: ["WiFi (built in)"], baud: 115200,
    parts: [[1, "ESP32 dev board"]],
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
    id: "i2c-scan", name: "I2C bus scanner", level: "Starter", mins: 10, tags: ["sensors"],
    sum: "Probe every address on the I2C bus and report what answers. Run it before trusting any sensor wiring.",
    pins: ["3V3", "GND", "21", "22"], libs: ["Wire (built in)"], baud: 115200,
    parts: [[1, "ESP32 dev board"], [1, "Any I2C device"], [4, "Jumper wires"]],
    wiring: [["Device VCC", "3V3", ""], ["Device GND", "GND", ""], ["Device SDA", "GPIO 21", "Default SDA"], ["Device SCL", "GPIO 22", "Default SCL"]],
    code: R`#include <Wire.h>

void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);
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
    id: "dht22", name: "DHT22 climate logger", level: "Starter", mins: 15, tags: ["sensors"],
    sum: "Read temperature and humidity every two seconds and print them as a log line.",
    pins: ["3V3", "GND", "4"], libs: ["DHT sensor library (Adafruit)", "Adafruit Unified Sensor"], baud: 115200,
    parts: [[1, "ESP32 dev board"], [1, "DHT22 (AM2302) sensor"], [1, "10 kΩ resistor, only for a bare sensor without a breakout"], [3, "Jumper wires"]],
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
    id: "oled", name: "SSD1306 OLED status", level: "Starter", mins: 15, tags: ["display"],
    sum: "Drive a 128 by 64 I2C OLED and show an uptime counter. The base for any small status display.",
    pins: ["3V3", "GND", "21", "22"], libs: ["Adafruit SSD1306", "Adafruit GFX Library"], baud: 115200,
    parts: [[1, "ESP32 dev board"], [1, "0.96 inch SSD1306 OLED, I2C, address 0x3C"], [4, "Jumper wires"]],
    wiring: [["OLED VCC", "3V3", ""], ["OLED GND", "GND", ""], ["OLED SDA", "GPIO 21", ""], ["OLED SCL", "GPIO 22", ""]],
    code: R`#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

Adafruit_SSD1306 display(128, 64, &Wire, -1);

void setup() {
  Serial.begin(115200);
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
    id: "hcsr04", name: "HC-SR04 distance", level: "Intermediate", mins: 20, tags: ["sensors"],
    sum: "Measure distance with an ultrasonic sensor. The echo pin is 5 V, so it goes through a divider.",
    pins: ["5V", "GND", "5", "18"], libs: [], baud: 115200,
    parts: [[1, "ESP32 dev board"], [1, "HC-SR04 ultrasonic sensor"], [1, "1 kΩ resistor"], [1, "2 kΩ resistor"], [4, "Jumper wires"]],
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
    id: "deep-sleep", name: "Deep sleep, button wake", level: "Intermediate", mins: 20, tags: ["power"],
    sum: "Sleep at microamp current and wake on a button press. A boot counter survives in RTC memory.",
    pins: ["3V3", "GND", "33"], libs: [], baud: 115200,
    parts: [[1, "ESP32 dev board"], [1, "Push button"], [1, "10 kΩ resistor"], [3, "Jumper wires"]],
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
    id: "web-led", name: "Web page LED switch", level: "Intermediate", mins: 20, tags: ["wifi"],
    sum: "Join your Wi-Fi, serve a one-button page and switch GPIO 2 from any phone on the network.",
    pins: ["2"], libs: ["WiFi (built in)", "WebServer (built in)"], baud: 115200,
    parts: [[1, "ESP32 dev board"], [1, "LED and 220 Ω resistor, only if your board has no LED on GPIO 2"]],
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
  }
];
