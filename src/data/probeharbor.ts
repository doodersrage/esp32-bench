// Sketches from ProbeHarbor's sketches/arduino folder, unchanged. Each one posts
// readings to a ProbeHarbor push device, so it needs Wi-Fi details and the
// device's ingest URL filled in before upload.
import type { Project } from "./projects";
import { BOM } from "../lib/shop";

import ds18b20 from "../sketches/probeharbor/ds18b20_ingest.ino?raw";
import ds18b20Portal from "../sketches/probeharbor/ds18b20_wifimanager.ino?raw";
import door from "../sketches/probeharbor/door_contact_ingest.ino?raw";
import leak from "../sketches/probeharbor/leak_contact_ingest.ino?raw";
import power from "../sketches/probeharbor/power_sense_ingest.ino?raw";
import max31855 from "../sketches/probeharbor/max31855_ingest.ino?raw";
import max6675 from "../sketches/probeharbor/max6675_ingest.ino?raw";

const source = (name: string) =>
  `https://github.com/doodersrage/probeharbor/tree/main/sketches/arduino/${name}`;

const KEY_NOTE =
  "Set WIFI_SSID, WIFI_PASS and INGEST_URL at the top of the sketch. The ingest URL comes from a push device under Dashboard, Devices at probeharbor.dev.";

export const PROBEHARBOR_SKETCHES: Project[] = [
  {
    id: "ph-ds18b20", needs: [["ds18b20"]], name: "DS18B20 to ProbeHarbor", level: "Starter", mins: 20, tags: ["probeharbor", "sensors", "wireless"],
    sum: "Read a waterproof DS18B20 probe and post the temperature to ProbeHarbor once a minute.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    pins: ["3V3", "GND", "4"], libs: ["OneWire", "DallasTemperature"], baud: 115200,
    parts: [
      [1, "ESP32 dev board", BOM.esp32DevKit],
      [1, "DS18B20 waterproof probe", BOM.ds18b20],
      [1, "4.7 kΩ resistor", BOM.resistor4k7],
    ],
    wiring: [
      ["DS18B20 red", "3V3", ""],
      ["DS18B20 black", "GND", ""],
      ["DS18B20 data, usually yellow", "GPIO 4", ""],
      ["4.7 kΩ pull-up resistor", "GPIO 4 to 3V3", "Holds the data line high"],
    ],
    code: ds18b20, sourceUrl: source("ds18b20_ingest"),
    notes: [KEY_NOTE, "GPIO 4 is the probe data pin ProbeHarbor's own firmware uses on all three boards. This sketch itself has no recorded hardware test."],
    sample: ["WiFi..... ok", 'POST 200 {"temp1":68.45,"rssi":-58}', 'POST 200 {"temp1":68.34,"rssi":-57}', "DS18B20 disconnected"],
  },
  {
    id: "ph-ds18b20-portal", needs: [["ds18b20"]], name: "DS18B20 with Wi-Fi portal", level: "Starter", mins: 20, tags: ["probeharbor", "sensors", "wireless"],
    sum: "The same DS18B20 probe, but Wi-Fi is set from a phone through a captive portal instead of being compiled in.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    pins: ["3V3", "GND", "4"], libs: ["OneWire", "DallasTemperature", "WiFiManager (tzapu)"], baud: 115200,
    parts: [
      [1, "ESP32 dev board", BOM.esp32DevKit],
      [1, "DS18B20 waterproof probe", BOM.ds18b20],
      [1, "4.7 kΩ resistor", BOM.resistor4k7],
    ],
    wiring: [
      ["DS18B20 red", "3V3", ""],
      ["DS18B20 black", "GND", ""],
      ["DS18B20 data, usually yellow", "GPIO 4", ""],
      ["4.7 kΩ pull-up resistor", "GPIO 4 to 3V3", "Holds the data line high"],
    ],
    code: ds18b20Portal, sourceUrl: source("ds18b20_wifimanager"),
    notes: [
      "Set INGEST_URL at the top of the sketch. Wi-Fi is not compiled in.",
      "On first boot, join the ProbeHarbor-Setup network from a phone, enter your home Wi-Fi and let the board restart.",
    ],
    sample: ["WiFi ok", 'POST 200 {"temp1":68.45,"rssi":-58}', 'POST 200 {"temp1":68.34,"rssi":-57}'],
  },
  {
    id: "ph-door", needs: [["reed"]], name: "Door contact to ProbeHarbor", level: "Starter", mins: 15, tags: ["probeharbor", "sensors", "wireless"],
    sum: "A reed switch on a door. Posts open or shut once a minute and right away when it changes.",
    pins: ["GND", "4"], libs: [], baud: 115200,
    parts: [[1, "ESP32 dev board", BOM.esp32DevKit], [1, "Magnetic reed switch", BOM.reedSwitch]],
    wiring: [
      ["Reed switch, wire A", "GPIO 4", "Internal pull-up. Low means the door is shut"],
      ["Reed switch, wire B", "GND", ""],
    ],
    code: door, sourceUrl: source("door_contact_ingest"),
    notes: [KEY_NOTE],
    sample: ["WiFi..... ok", 'POST 200 {"door1":false}', 'POST 200 {"door1":true}', 'POST 200 {"door1":false}'],
  },
  {
    id: "ph-leak", needs: [["wires"]], name: "Leak pads to ProbeHarbor", level: "Starter", mins: 15, tags: ["probeharbor", "sensors", "wireless"],
    sum: "Two bare contacts on the floor. Water between them posts a leak, which ProbeHarbor turns into an alert.",
    pins: ["GND", "4"], libs: [], baud: 115200,
    parts: [[1, "ESP32 dev board", BOM.esp32DevKit], [2, "Bare wires or contact pads"]],
    wiring: [
      ["Contact A", "GPIO 4", "Internal pull-up. Water pulls the pin low"],
      ["Contact B", "GND", ""],
    ],
    code: leak, sourceUrl: source("leak_contact_ingest"),
    notes: [
      KEY_NOTE,
      "Keep the board dry and above the floor. Only the contacts go where water might be.",
      "Clean tap water across a wide gap may not pull the pin low enough to register. ProbeHarbor's test plan lists this as still to be measured.",
    ],
    sample: ["WiFi..... ok", 'POST 200 {"leak1":false}', 'POST 200 {"leak1":true}'],
  },
  {
    id: "ph-power", needs: [["powersense"]], name: "Power sense to ProbeHarbor", level: "Intermediate", mins: 20, tags: ["probeharbor", "logging", "wireless"],
    sum: "Report whether a circuit has power. ProbeHarbor raises a power-off alert when it drops and a recovery notice when it returns.",
    pins: ["GND", "4"], libs: [], baud: 115200,
    parts: [
      [1, "ESP32 dev board", BOM.esp32DevKit],
      [1, "Power sense module with an isolated contact output"],
    ],
    wiring: [
      ["Sense module output", "GPIO 4", "Internal pull-up. Low means power is present"],
      ["Sense module ground", "GND", ""],
    ],
    code: power, sourceUrl: source("power_sense_ingest"),
    notes: [
      KEY_NOTE,
      "Run the board from a UPS or a circuit that stays on, or it cannot report the outage.",
      "Never connect mains voltage to the board. Use a module that isolates the sensed circuit.",
    ],
    sample: ["WiFi..... ok", 'POST 200 {"power1":true}', 'POST 200 {"power1":false}'],
  },
  {
    id: "ph-max31855", needs: [["max31855"]], name: "MAX31855 thermocouple to ProbeHarbor", level: "Intermediate", mins: 25, tags: ["probeharbor", "sensors", "wireless"],
    sum: "A K-type thermocouple through a MAX31855 amplifier, for temperatures a DS18B20 cannot survive.",
    pins: ["3V3", "GND", "5", "18", "19"], libs: ["Adafruit MAX31855 library"], baud: 115200,
    parts: [
      [1, "ESP32 dev board", BOM.esp32DevKit],
      [1, "MAX31855 thermocouple amplifier breakout"],
      [1, "K-type thermocouple"],
    ],
    wiring: [
      ["MAX31855 Vin", "3V3", ""],
      ["MAX31855 GND", "GND", ""],
      ["MAX31855 CS", "GPIO 5", ""],
      ["MAX31855 CLK", "GPIO 18", ""],
      ["MAX31855 DO", "GPIO 19", ""],
    ],
    code: max31855, sourceUrl: source("max31855_ingest"),
    notes: [KEY_NOTE],
    sample: [".... WiFi ok", "POST 200", "POST 200", "Thermocouple fault"],
  },
  {
    id: "ph-max6675", needs: [["max6675"]], name: "MAX6675 thermocouple to ProbeHarbor", level: "Intermediate", mins: 25, tags: ["probeharbor", "sensors", "wireless"],
    sum: "The lower-cost MAX6675 thermocouple module, posting a temperature once a minute.",
    pins: ["3V3", "GND", "5", "18", "19"], libs: ["MAX6675 library"], baud: 115200,
    parts: [
      [1, "ESP32 dev board", BOM.esp32DevKit],
      [1, "MAX6675 module with K-type thermocouple"],
    ],
    wiring: [
      ["MAX6675 VCC", "3V3", ""],
      ["MAX6675 GND", "GND", ""],
      ["MAX6675 CS", "GPIO 5", ""],
      ["MAX6675 SCK", "GPIO 18", ""],
      ["MAX6675 SO", "GPIO 19", ""],
    ],
    code: max6675, sourceUrl: source("max6675_ingest"),
    notes: [KEY_NOTE],
    sample: [".... WiFi ok", 'POST 200 {"temp1":412.25,"rssi":-61}', "MAX6675 fault"],
  },
];
