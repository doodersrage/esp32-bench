import { BOM } from "../lib/shop";

export type BoardId = "esp32" | "esp32s3" | "esp32c3";

export interface Board {
  id: BoardId;
  /** Short label for tags and switches */
  short: string;
  name: string;
  /** Board name to pick in the Arduino IDE */
  arduinoBoard: string;
  /** Header pin labels, top to bottom, with the USB connector at the bottom */
  left: string[];
  right: string[];
  /** Pins ProbeHarbor's firmware uses on this board, tested on hardware */
  tested: { i2c: string; probe: string; boot: string };
  notes: string[];
  buy: { label: string; href: string }[];
  /** Where the header layout comes from */
  source: string;
}

export const BOARDS: Board[] = [
  {
    id: "esp32",
    short: "ESP32",
    name: "ESP32-DevKitC V4, 38 pin",
    arduinoBoard: "ESP32 Dev Module",
    left: ["3V3", "EN", "VP", "VN", "34", "35", "32", "33", "25", "26", "27", "14", "12", "GND", "13", "D2", "D3", "CMD", "5V"],
    right: ["GND", "23", "22", "TX", "RX", "21", "GND", "19", "18", "5", "17", "16", "4", "0", "2", "15", "D1", "D0", "CLK"],
    tested: { i2c: "SDA 21 / SCL 22", probe: "GPIO 4", boot: "GPIO 0" },
    notes: [
      "GPIO 34, 35, VP (36) and VN (39) are input only and have no pull-ups.",
      "GPIO 0, 2, 12 and 15 are strapping pins. Keep loads off them at boot.",
      "D0 to D3, CMD and CLK are wired to the flash chip. Leave them unconnected.",
      "The DevKitC V4 has no user LED. Many 30-pin clones put one on GPIO 2.",
    ],
    buy: [{ label: "ESP32 DevKit", href: BOM.esp32DevKit }],
    source: "https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html",
  },
  {
    id: "esp32s3",
    short: "S3",
    name: "ESP32-S3-DevKitC-1, 44 pin",
    arduinoBoard: "ESP32S3 Dev Module",
    left: ["3V3", "3V3", "RST", "4", "5", "6", "7", "15", "16", "17", "18", "8", "3", "46", "9", "10", "11", "12", "13", "14", "5V", "GND"],
    right: ["GND", "TX", "RX", "1", "2", "42", "41", "40", "39", "38", "37", "36", "35", "0", "45", "48", "47", "21", "20", "19", "GND", "GND"],
    tested: { i2c: "SDA 8 / SCL 9", probe: "GPIO 4", boot: "GPIO 0" },
    notes: [
      "The board has two USB ports: a UART bridge and the chip's native USB on GPIO 19 and 20.",
      "Opening the native USB port resets the board, so every new serial connection restarts your firmware.",
      "Firmware that should talk on either port has to listen on both. ProbeHarbor's probe ignored settings on the native port until it did.",
      "The RGB LED is on GPIO 38 on v1.1 boards and GPIO 48 on the first revision.",
      "ProbeHarbor builds for 4 MB flash so modules smaller than the DevKitC's default 8 MB still boot.",
    ],
    buy: [{ label: "ESP32-S3-DevKitC-1", href: BOM.esp32S3DevKitC }],
    source: "https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/user_guide.html",
  },
  {
    id: "esp32c3",
    short: "C3",
    name: "ESP32-C3-DevKitM-1, 30 pin",
    arduinoBoard: "ESP32C3 Dev Module",
    left: ["GND", "3V3", "3V3", "2", "3", "GND", "RST", "GND", "0", "1", "10", "GND", "5V", "5V", "GND"],
    right: ["GND", "TX", "RX", "GND", "9", "8", "GND", "7", "6", "5", "4", "GND", "18", "19", "GND"],
    tested: { i2c: "SDA 6 / SCL 7", probe: "GPIO 4", boot: "GPIO 9" },
    notes: [
      "Native USB serial is off by default on the DevKitM-1 build. Without -DARDUINO_USB_MODE=1 a board connected only by its native port boots but prints nothing.",
      "GPIO 9 is the BOOT button and GPIO 8 drives the RGB LED.",
      "GPIO 18 and 19 are the native USB data lines.",
      "Check the silkscreen before wiring: a sensor on the wrong pad was the one wiring fault in ProbeHarbor's C3 test.",
    ],
    buy: [{ label: "ESP32-C3-DevKitM-1", href: BOM.esp32C3DevKitM }],
    source: "https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32c3/esp32-c3-devkitm-1/user_guide.html",
  },
];

export const boardById = (id: BoardId): Board => BOARDS.find((b) => b.id === id) ?? BOARDS[0];
