// Release notes, newest first. Used by /changes/ and the RSS feed.

export interface Change {
  /** Anchor id on /changes/ and the feed item's guid */
  id: string;
  /** yyyy-mm-dd */
  date: string;
  title: string;
  summary: string;
  items: string[];
  /** Site path of the main thing to try */
  link: string;
}

export const CHANGES: Change[] = [
  {
    id: "v0-8",
    date: "2026-11-12",
    title: "Version 0.8: search everything, share a log, detect pins on the S2 and C6",
    summary:
      "One search box for projects, boards, pins, errors and tools; serial logs you can share as a link; the pin detective on two more chips; and a report form.",
    items: [
      "Search: press / anywhere, or use the box in the header. Finds projects, boards, single pins like GPIO 34 or ADC2, errors and tools, and works offline.",
      "Share a log: the bench and the crash translator make a link that carries the log itself. Nothing is uploaded; whoever opens it sees the log explained.",
      "Pin detective: firmware for the ESP32-S2 and ESP32-C6, and the XIAO ESP32C3 and ESP32S3 with their D0 to D10 labels.",
      "Report form: send a build report, a correction or a message. It goes by email and is never published.",
      "Every project, board, error and tool page now has its own preview image for links shared in chats and forums.",
    ],
    link: "/search/",
  },
  {
    id: "v0-7",
    date: "2026-11-12",
    title: "Version 0.7: more boards, a backtrace decoder and seven new projects",
    summary:
      "Pinout pages for eight boards, three new browser tools and seven new projects, from over-the-air updates to an ESP32-CAM stream.",
    items: [
      "Boards: pinout pages for the ESP32-S2, ESP32-C6, Seeed XIAO ESP32C3 and XIAO ESP32S3, and a pin map for the AI-Thinker ESP32-CAM, each with every pin's ADC, touch, strapping and wake functions and a safe-to-use verdict. Plus a chip comparison.",
      "Backtrace decoder: drop in your firmware's .elf and paste a crash to get function names and line numbers, without installing anything.",
      "Flash your own firmware: pick .bin files and flash them from the browser, or erase the chip.",
      "Partition table builder: start from the Arduino presets, edit, check it fits, and download partitions.csv.",
      "New projects: over-the-air updates, a battery deep-sleep sensor, relay and servo control, an e-paper card, a BME280 web dashboard, a Wi-Fi setup portal and an ESP32-CAM stream.",
    ],
    link: "/tools/",
  },
  {
    id: "v0-6",
    date: "2026-11-12",
    title: "Version 0.6: install it, look up an error, start from zero",
    summary:
      "ESP32 Bench now installs as an app and keeps working offline. There is an error reference with a page for each common crash, a getting started guide and five new projects.",
    items: [
      "Error reference: one page per common ESP32 crash, reset and upload error, each with its causes, its fixes and a box to paste your log into.",
      "Getting started: drivers, browsers, Linux permissions, the Arduino IDE and a first flash.",
      "New projects: touch keys, an ESP-NOW pair, an addressable LED strip, an MQTT sensor for Home Assistant and a BLE scanner.",
      "Install ESP32 Bench as an app from Chrome or Edge. Pages you have opened work offline.",
      "Light and dark themes, a page-not-found page, an about page and this feed.",
    ],
    link: "/errors/",
  },
  {
    id: "v0-5",
    date: "2026-11-12",
    title: "Version 0.5: pin detective and a second bench monitor",
    summary:
      "Flash a helper firmware, touch a jumper from GND to a pad and see which GPIO it is. The bench can also watch two boards side by side.",
    items: [
      "Detective: find any pad's GPIO number with a jumper wire, with a silkscreen quiz.",
      "Board passport: chip, flash size and MAC address, saved in your browser.",
      "Bench: a second serial monitor for sender and receiver projects.",
    ],
    link: "/detective/",
  },
  {
    id: "v0-4",
    date: "2026-11-12",
    title: "Version 0.4: wiring pad and the hall of flames",
    summary: "Wire parts to a board on screen and have every connection checked, and learn from other people's failures.",
    items: [
      "Wire: checks each wire for boot pins, input-only pins, 5 V signals and pads used twice, and can wire a project for you.",
      "Remix: put two projects on one board without pin clashes.",
      "Flames: failures with what the serial port said and what was really wrong.",
    ],
    link: "/wire/",
  },
  {
    id: "v0-3",
    date: "2026-11-11",
    title: "Version 0.3: plotter, Wi-Fi radar and crash translator",
    summary: "The bench now draws numbers from your serial output, maps Wi-Fi networks and explains crashes in plain language.",
    items: [
      "Plotter: every number that keeps appearing in the serial output gets a live chart.",
      "Wi-Fi radar: the scanner project's output drawn by channel and signal strength.",
      "Crash translator: Guru Meditation errors, reset reasons and backtraces explained.",
      "Bench log: mark projects as built, earn badges and let the library pick a project from your parts drawer.",
    ],
    link: "/bench/",
  },
  {
    id: "v0-2",
    date: "2026-11-11",
    title: "Version 0.2: boards, browser flashing and ProbeHarbor",
    summary: "Board references for the ESP32, ESP32-S3 and ESP32-C3, hardware test results, and firmware you can flash from the page.",
    items: [
      "Boards: pin headers, tested pins and field notes for three dev boards.",
      "Browser flashing for the ProbeHarbor probe, plus a form that sends it Wi-Fi settings over USB.",
      "Seven ProbeHarbor sketches added to the library.",
    ],
    link: "/boards/",
  },
  {
    id: "v0-1",
    date: "2026-11-11",
    title: "Version 0.1: project library and serial monitor",
    summary: "The first version: ESP32 projects with pin maps, parts lists and sketches, and a serial monitor in the browser.",
    items: ["Library of starter projects with highlighted pinouts.", "Bench: a Web Serial monitor with reset and log copy."],
    link: "/",
  },
];
