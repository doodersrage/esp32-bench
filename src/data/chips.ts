// What each ESP32 chip family's GPIOs can do. Board pages combine this with a
// board's header layout to explain every pad.
//
// Sources, per chip: the Espressif datasheet ("Pin Overview", "Strapping Pins",
// "ADC", "Touch Sensor", "RTC/LP IO" sections), the ESP-IDF ADC oneshot driver's
// "Hardware Limitations" notes and the Arduino-ESP32 variants' pins_arduino.h.
//   ESP32    https://www.espressif.com/sites/default/files/documentation/esp32_datasheet_en.pdf
//   ESP32-S2 https://www.espressif.com/sites/default/files/documentation/esp32-s2_datasheet_en.pdf
//   ESP32-S3 https://www.espressif.com/sites/default/files/documentation/esp32-s3_datasheet_en.pdf
//   ESP32-C3 https://www.espressif.com/sites/default/files/documentation/esp32-c3_datasheet_en.pdf
//   ESP32-C6 https://www.espressif.com/sites/default/files/documentation/esp32-c6_datasheet_en.pdf

export type ChipId = "esp32" | "esp32s2" | "esp32s3" | "esp32c3" | "esp32c6";

/** What one GPIO can do, and what to watch out for. */
export interface PinCaps {
  /** e.g. "ADC1_CH4" */
  adc?: string;
  /** e.g. "TOUCH4" or "T0" */
  touch?: string;
  dac?: string;
  /** Can wake the chip from deep sleep (RTC or LP GPIO) */
  wake?: boolean;
  /** Strapping role, read at reset */
  strap?: string;
  inputOnly?: boolean;
  /** Wired to the SPI flash or PSRAM inside or next to the module */
  memory?: string;
  /** Native USB data line */
  usb?: "D-" | "D+";
  /** UART0, the default serial console */
  uart0?: "TX" | "RX";
  jtag?: string;
}

export interface Chip {
  id: ChipId;
  name: string;
  cpu: string;
  wireless: string;
  /** Usable GPIOs on the chip */
  gpios: string;
  adc: string;
  touch: string;
  dac: string;
  usb: string;
  sram: string;
  /** How ADC2 behaves next to Wi-Fi, or why it is missing */
  adc2: string;
  datasheet: string;
  pins: Record<number, PinCaps>;
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

function build(parts: Record<number, PinCaps>[]): Record<number, PinCaps> {
  const out: Record<number, PinCaps> = {};
  for (const part of parts) for (const [gpio, caps] of Object.entries(part)) out[Number(gpio)] = { ...out[Number(gpio)], ...caps };
  return out;
}
const each = (gpios: number[], caps: (gpio: number, i: number) => PinCaps) =>
  Object.fromEntries(gpios.map((g, i) => [g, caps(g, i)])) as Record<number, PinCaps>;

const ESP32_ADC1: [number, number][] = [[36, 0], [37, 1], [38, 2], [39, 3], [32, 4], [33, 5], [34, 6], [35, 7]];
const ESP32_ADC2: [number, number][] = [[4, 0], [0, 1], [2, 2], [15, 3], [13, 4], [12, 5], [14, 6], [27, 7], [25, 8], [26, 9]];
const ESP32_TOUCH: [number, number][] = [[4, 0], [0, 1], [2, 2], [15, 3], [13, 4], [12, 5], [14, 6], [27, 7], [33, 8], [32, 9]];

export const CHIPS: Record<ChipId, Chip> = {
  esp32: {
    id: "esp32",
    name: "ESP32",
    cpu: "Dual-core Xtensa LX6, up to 240 MHz",
    wireless: "Wi-Fi 4 (2.4 GHz), Bluetooth Classic and Bluetooth LE 4.2",
    gpios: "34 (GPIO 34 to 39 are input only)",
    adc: "18 channels on two 12-bit ADCs",
    touch: "10 channels",
    dac: "2 channels, 8-bit (GPIO 25 and 26)",
    usb: "None. Boards use a USB-to-UART bridge chip",
    sram: "520 KB",
    adc2: "Wi-Fi uses ADC2. While Wi-Fi is on, analogRead() on ADC2 pins fails, so use ADC1 pins (GPIO 32 to 39) for anything you read with Wi-Fi running.",
    datasheet: "https://www.espressif.com/sites/default/files/documentation/esp32_datasheet_en.pdf",
    pins: build([
      Object.fromEntries(ESP32_ADC1.map(([g, ch]) => [g, { adc: `ADC1_CH${ch}` }])),
      Object.fromEntries(ESP32_ADC2.map(([g, ch]) => [g, { adc: `ADC2_CH${ch}` }])),
      Object.fromEntries(ESP32_TOUCH.map(([g, ch]) => [g, { touch: `T${ch}` }])),
      each([0, 2, 4, 12, 13, 14, 15, 25, 26, 27, 32, 33, 34, 35, 36, 37, 38, 39], () => ({ wake: true })),
      each(range(34, 39), () => ({ inputOnly: true })),
      each(range(6, 11), () => ({ memory: "SPI flash" })),
      { 16: { memory: "PSRAM on WROVER modules" }, 17: { memory: "PSRAM on WROVER modules" } },
      { 25: { dac: "DAC1" }, 26: { dac: "DAC2" } },
      {
        0: { strap: "Boot mode: low at reset enters download mode" },
        2: { strap: "Boot mode: must be low or floating to enter download mode" },
        5: { strap: "SDIO slave timing; harmless for most projects" },
        12: { strap: "Flash voltage (MTDI): high at reset selects 1.8 V and most boards then fail to boot" },
        15: { strap: "Boot log (MTDO): low at reset silences the ROM boot messages" },
      },
      { 1: { uart0: "TX" }, 3: { uart0: "RX" } },
      { 12: { jtag: "MTDI" }, 13: { jtag: "MTCK" }, 14: { jtag: "MTMS" }, 15: { jtag: "MTDO" } },
    ]),
  },
  esp32s2: {
    id: "esp32s2",
    name: "ESP32-S2",
    cpu: "Single-core Xtensa LX7, up to 240 MHz",
    wireless: "Wi-Fi 4 (2.4 GHz). No Bluetooth",
    gpios: "43 (GPIO 46 is input only)",
    adc: "20 channels on two 13-bit ADCs",
    touch: "14 channels",
    dac: "2 channels, 8-bit (GPIO 17 and 18)",
    usb: "Native USB 1.1 OTG on GPIO 19 and 20",
    sram: "320 KB",
    adc2: "Wi-Fi also uses ADC2. The driver arbitrates, but a read can fail while Wi-Fi is busy, so prefer ADC1 pins (GPIO 1 to 10).",
    datasheet: "https://www.espressif.com/sites/default/files/documentation/esp32-s2_datasheet_en.pdf",
    pins: build([
      each(range(1, 10), (_, i) => ({ adc: `ADC1_CH${i}` })),
      each(range(11, 20), (_, i) => ({ adc: `ADC2_CH${i}` })),
      each(range(1, 14), (g) => ({ touch: `TOUCH${g}` })),
      each(range(0, 21), () => ({ wake: true })),
      { 17: { dac: "DAC1" }, 18: { dac: "DAC2" } },
      each(range(26, 32), () => ({ memory: "SPI flash and PSRAM" })),
      each(range(33, 37), () => ({ memory: "Octal flash or PSRAM, on modules that have it" })),
      {
        0: { strap: "Boot mode: low at reset enters download mode" },
        45: { strap: "Flash voltage (VDD_SPI)" },
        46: { strap: "Boot mode and ROM log: must be low to enter download mode", inputOnly: true },
      },
      { 19: { usb: "D-" }, 20: { usb: "D+" } },
      { 43: { uart0: "TX" }, 44: { uart0: "RX" } },
      { 39: { jtag: "MTCK" }, 40: { jtag: "MTDO" }, 41: { jtag: "MTDI" }, 42: { jtag: "MTMS" } },
    ]),
  },
  esp32s3: {
    id: "esp32s3",
    name: "ESP32-S3",
    cpu: "Dual-core Xtensa LX7, up to 240 MHz, with vector instructions",
    wireless: "Wi-Fi 4 (2.4 GHz) and Bluetooth LE 5",
    gpios: "45",
    adc: "20 channels on two 12-bit ADCs",
    touch: "14 channels",
    dac: "None",
    usb: "Native USB 1.1 OTG and a USB serial/JTAG port on GPIO 19 and 20",
    sram: "512 KB",
    adc2: "Wi-Fi also uses ADC2. The driver arbitrates, but a read can fail while Wi-Fi is busy, so prefer ADC1 pins (GPIO 1 to 10).",
    datasheet: "https://www.espressif.com/sites/default/files/documentation/esp32-s3_datasheet_en.pdf",
    pins: build([
      each(range(1, 10), (_, i) => ({ adc: `ADC1_CH${i}` })),
      each(range(11, 20), (_, i) => ({ adc: `ADC2_CH${i}` })),
      each(range(1, 14), (g) => ({ touch: `TOUCH${g}` })),
      each(range(0, 21), () => ({ wake: true })),
      each(range(26, 32), () => ({ memory: "SPI flash and PSRAM" })),
      each(range(33, 37), () => ({ memory: "Octal flash or PSRAM, on modules that have it" })),
      {
        0: { strap: "Boot mode: low at reset enters download mode" },
        3: { strap: "JTAG source; harmless for most projects" },
        45: { strap: "Flash voltage (VDD_SPI)" },
        46: { strap: "Boot mode and ROM log: must be low to enter download mode" },
      },
      { 19: { usb: "D-" }, 20: { usb: "D+" } },
      { 43: { uart0: "TX" }, 44: { uart0: "RX" } },
      { 39: { jtag: "MTCK" }, 40: { jtag: "MTDO" }, 41: { jtag: "MTDI" }, 42: { jtag: "MTMS" } },
    ]),
  },
  esp32c3: {
    id: "esp32c3",
    name: "ESP32-C3",
    cpu: "Single-core RISC-V, up to 160 MHz",
    wireless: "Wi-Fi 4 (2.4 GHz) and Bluetooth LE 5",
    gpios: "22",
    adc: "6 channels: ADC1 on GPIO 0 to 4, ADC2 on GPIO 5",
    touch: "None",
    dac: "None",
    usb: "USB serial/JTAG port on GPIO 18 and 19",
    sram: "400 KB",
    adc2: "ADC2 (GPIO 5) gives unstable readings because of a chip erratum, and ESP-IDF no longer supports it in oneshot mode. Use GPIO 0 to 4 for analog.",
    datasheet: "https://www.espressif.com/sites/default/files/documentation/esp32-c3_datasheet_en.pdf",
    pins: build([
      each(range(0, 4), (_, i) => ({ adc: `ADC1_CH${i}` })),
      { 5: { adc: "ADC2_CH0" } },
      each(range(0, 5), () => ({ wake: true })),
      each(range(12, 17), () => ({ memory: "SPI flash" })),
      {
        2: { strap: "Boot mode: must be high at reset" },
        8: { strap: "Boot mode: must be high to enter download mode" },
        9: { strap: "Boot mode: low at reset enters download mode" },
      },
      { 18: { usb: "D-" }, 19: { usb: "D+" } },
      { 21: { uart0: "TX" }, 20: { uart0: "RX" } },
      { 4: { jtag: "MTMS" }, 5: { jtag: "MTDI" }, 6: { jtag: "MTCK" }, 7: { jtag: "MTDO" } },
    ]),
  },
  esp32c6: {
    id: "esp32c6",
    name: "ESP32-C6",
    cpu: "RISC-V at up to 160 MHz, plus a 20 MHz low-power RISC-V core",
    wireless: "Wi-Fi 6 (2.4 GHz), Bluetooth LE 5 and IEEE 802.15.4 (Thread and Zigbee)",
    gpios: "30 on the QFN40 package used by the DevKitC-1",
    adc: "7 channels on one 12-bit ADC (GPIO 0 to 6)",
    touch: "None",
    dac: "None",
    usb: "USB serial/JTAG port on GPIO 12 and 13",
    sram: "512 KB, plus 16 KB of low-power SRAM",
    adc2: "There is no ADC2, so analog reads are not affected by Wi-Fi.",
    datasheet: "https://www.espressif.com/sites/default/files/documentation/esp32-c6_datasheet_en.pdf",
    pins: build([
      each(range(0, 6), (_, i) => ({ adc: `ADC1_CH${i}` })),
      each(range(0, 7), () => ({ wake: true })),
      each(range(24, 30), () => ({ memory: "SPI flash" })),
      {
        4: { strap: "MTMS: used with GPIO 5 to pick the SDIO sampling edge; harmless for most projects" },
        5: { strap: "MTDI: used with GPIO 4 to pick the SDIO sampling edge; harmless for most projects" },
        8: { strap: "Boot mode: must be high to enter download mode" },
        9: { strap: "Boot mode: low at reset enters download mode" },
        15: { strap: "JTAG source; harmless for most projects" },
      },
      { 12: { usb: "D-" }, 13: { usb: "D+" } },
      { 16: { uart0: "TX" }, 17: { uart0: "RX" } },
      { 4: { jtag: "MTMS" }, 5: { jtag: "MTDI" }, 6: { jtag: "MTCK" }, 7: { jtag: "MTDO" } },
    ]),
  },
};

/** Short, human list of what a GPIO can do, e.g. ["ADC1_CH4", "Touch T9", "Deep-sleep wake"]. */
export function describeCaps(caps: PinCaps | undefined): string[] {
  if (!caps) return [];
  const out: string[] = [];
  if (caps.adc) out.push(caps.adc);
  if (caps.touch) out.push(`Touch ${caps.touch}`);
  if (caps.dac) out.push(caps.dac);
  if (caps.uart0) out.push(`UART0 ${caps.uart0}`);
  if (caps.usb) out.push(`USB ${caps.usb}`);
  if (caps.jtag) out.push(`JTAG ${caps.jtag}`);
  if (caps.wake) out.push("Deep-sleep wake");
  if (caps.inputOnly) out.push("Input only");
  return out;
}
