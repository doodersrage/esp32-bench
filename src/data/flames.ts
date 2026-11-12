// Hall of flames: failures, what they looked like on the serial port, and what
// was actually wrong.
//
// "probeharbor" entries come from ProbeHarbor's hardware test log and use the
// status lines recorded there. `mistaken` is the easy wrong reading, not a
// record of what anyone thought at the time. "common" entries are well-known ESP32
// failures; their log lines are typical output, not a capture from one board.

export interface Flame {
  id: string;
  title: string;
  board: string;
  source: "probeharbor" | "common";
  /** What showed up on the serial port */
  log: string[];
  /** The easy wrong conclusion */
  mistaken: string;
  /** What it turned out to be */
  cause: string;
  fix: string;
}

export const FLAMES: Flame[] = [
  {
    id: "loose-ground",
    title: "The sensor that was found but would not read",
    board: "ESP32-S3-DevKitC-1",
    source: "probeharbor",
    log: [
      "TT sensor: AHT20 on I2C (SDA 8, SCL 9)",
      "TT sensor problem: AHT20 found but not reading: no data after the measure command",
    ],
    mistaken: "A firmware bug. The older firmware even reported a missing probe on GPIO 4, which pointed at the wrong sensor.",
    cause: "A loose ground pin on the sensor, noted in the test log as the likely cause.",
    fix: "Reseat power and ground first whenever a sensor is detected but returns nothing.",
  },
  {
    id: "wrong-pad",
    title: "Wi-Fi fine, no reading",
    board: "ESP32-C3-DevKitM-1",
    source: "probeharbor",
    log: ["TT key saved", "TT wifi ok"],
    mistaken: "A dead DHT22, or firmware that did not support the C3.",
    cause: "The data wire was on the wrong header pad. The C3's pad order is nothing like the classic ESP32's.",
    fix: "Read the silkscreen, not the position. Once the wire moved to the pad marked 4 the log read: TT sensor: DHT22 on GPIO 4.",
  },
  {
    id: "silent-c3",
    title: "The board that booted and said nothing",
    board: "ESP32-C3 on its native USB port",
    source: "probeharbor",
    log: ["(no output at all)"],
    mistaken: "A failed flash or a bad cable.",
    cause: "The build left native USB serial off. The firmware ran, but its output went to UART pins nobody was listening on, and settings sent over USB were ignored.",
    fix: "ProbeHarbor fixed it in firmware 1.2.5 by building the C3 image with -DARDUINO_USB_MODE=1.",
  },
  {
    id: "minus-five",
    title: "The upload that failed and succeeded",
    board: "ESP32-S3-DevKitC-1",
    source: "probeharbor",
    log: ["TT wifi ok", "TT post -5 probes=1", "TT post -5 probes=1", "TT waiting for wifi"],
    mistaken: "Readings were being lost.",
    cause: "-5 is the HTTP client's code for a lost connection. The reply was dropped on the way back; the server had stored both readings.",
    fix: "Check the server before trusting a client-side error. Treat -5 as unknown, not failed.",
  },
  {
    id: "erased-settings",
    title: "Flashed an update, lost the Wi-Fi",
    board: "Any board flashed from the browser",
    source: "probeharbor",
    log: ["TT firmware 1.2.6", "TT setup: send settings over USB, or join the ProbeHarbor-Setup Wi-Fi network"],
    mistaken: "The update broke saved settings.",
    cause: "Browser flashing writes one merged image at offset 0, which covers the settings partition too.",
    fix: "Expected behaviour. Send settings again after every browser flash.",
  },
  {
    id: "usb-reset",
    title: "Every time I look, it restarts",
    board: "ESP32-S3 on its native USB port",
    source: "probeharbor",
    log: ["USB_UART_CHIP_RESET"],
    mistaken: "A crash loop.",
    cause: "Opening the native USB serial port resets the chip. Each new connection from the bench restarts the firmware.",
    fix: "Nothing to fix. Do not read uptime or a boot counter as evidence of a crash on this port.",
  },
  {
    id: "brownout",
    title: "Dies the moment Wi-Fi starts",
    board: "Any ESP32",
    source: "common",
    log: ["Brownout detector was triggered", "rst:0xc (SW_CPU_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)"],
    mistaken: "A bug in the Wi-Fi code.",
    cause: "The radio pulls a burst of current at start-up and the 3.3 V rail dips. Long thin USB cables and unpowered hubs are the usual reason.",
    fix: "Shorter cable, powered hub, or a capacitor of 100 µF or more across 3V3 and GND.",
  },
  {
    id: "gpio12",
    title: "Works on the bench, boot loops in the enclosure",
    board: "Classic ESP32",
    source: "common",
    log: ["rst:0x10 (RTCWDT_RTC_RESET),boot:0x33 (SPI_FAST_FLASH_BOOT)", "flash read err, 1000"],
    mistaken: "A corrupted flash chip.",
    cause: "Something wired to GPIO 12 held it high at reset. That pin selects the flash voltage, so the flash chip was run at the wrong one.",
    fix: "Move the part off GPIO 12, or make sure it cannot pull the pin high during boot.",
  },
  {
    id: "download-mode",
    title: "Flashed fine, then nothing runs",
    board: "Any ESP32",
    source: "common",
    log: ["rst:0x1 (POWERON_RESET),boot:0x3 (DOWNLOAD_BOOT(UART0/UART1/SDIO_REI_REO_V2))", "waiting for download"],
    mistaken: "The upload did not take.",
    cause: "GPIO 0 was low at reset, so the chip is waiting for firmware instead of running it. A part on GPIO 0 or a stuck BOOT button does this.",
    fix: "Free GPIO 0, then press EN or RST.",
  },
  {
    id: "null-pointer",
    title: "Crash right after setup",
    board: "Any ESP32",
    source: "common",
    log: [
      "Guru Meditation Error: Core  1 panic'ed (LoadProhibited). Exception was unhandled.",
      "Backtrace: 0x400d1a2b:0x3ffb1f10 0x400d2c3d:0x3ffb1f30",
    ],
    mistaken: "Bad hardware.",
    cause: "The code used an object before it was set up, most often a sensor or display whose begin() failed and was not checked.",
    fix: "Check the return value of begin() and stop with a clear message when it fails.",
  },
  {
    id: "watchdog",
    title: "Resets every few seconds while waiting",
    board: "Any ESP32",
    source: "common",
    log: ["E (10321) task_wdt: Task watchdog got triggered. The following tasks did not reset the watchdog in time:", "E (10321) task_wdt:  - IDLE0 (CPU 0)"],
    mistaken: "Unstable power.",
    cause: "A loop that waits for something without ever yielding, such as while (!sensor.ready()) {} with no delay.",
    fix: "Put delay(1) or yield() inside every wait loop.",
  },
];
