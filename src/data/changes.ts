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
    id: "v0-21",
    date: "2026-11-14",
    title: "Version 0.21: a buy link for nearly every part",
    summary: "Parts lists and the shopping list now link almost every part, not just the ones with a specific product to point at.",
    items: [
      "Find on Amazon, for generic parts such as jumper wires, resistors, OLEDs and HC-SR04s: a search for that kind of part, since many sellers make them.",
      "Parts with a specific product keep their Buy at Amazon or Buy at Adafruit link, and the shopping list prefers that link when two projects share a part.",
    ],
    link: "/shop/",
  },
  {
    id: "v0-20",
    date: "2026-11-13",
    title: "Version 0.20: see what a project prints before you build it",
    summary: "Projects that need nothing attached now show what their firmware prints, recorded from the real firmware running in an ESP32 emulator.",
    items: [
      "What it prints, under Then watch it run: the serial output of the project's library firmware, replayed at its own pace, for the ESP32 and the ESP32-C3.",
      "Recorded on every firmware library build, so it always matches the firmware you would flash.",
    ],
    link: "/projects/blink/",
  },
  {
    id: "v0-19",
    date: "2026-11-13",
    title: "Version 0.19: your bench log on every device",
    summary: "A sync code keeps your bench log, shopping list and parts drawer the same on your phone and your laptop, with no account.",
    items: [
      "Make a sync code under Bench log on the home page, then enter it, or open its link, on your other devices. Changes travel both ways, and changes made on two devices at once are combined.",
      "No account and no email: the code is the only key, and only a hash of it is stored. Stop syncing in one browser, or delete the cloud copy, at any time.",
    ],
    link: "/#log",
  },
  {
    id: "v0-18",
    date: "2026-11-13",
    title: "Version 0.18: decode library crashes, and which project runs where",
    summary:
      "A crash from library firmware now decodes to functions and lines without any .elf file, and one table shows which project runs on which board.",
    items: [
      "Library firmware records which build it is, and its .elf is published, so pasting a Guru Meditation into the backtrace decoder, the bench or an error page decodes it. Takes effect for firmware built from this release on.",
      "Which project runs on which board: every project against every board, filled in by the hardware lab and build reports.",
      "Plot a saved log on the bench, in any browser, without a board.",
      "Every kind of page is now loaded in a browser on each change, so a broken page fails the build.",
    ],
    link: "/boards/matrix/",
  },
  {
    id: "v0-17",
    date: "2026-11-13",
    title: "Version 0.17: two more boards, a shopping list and starter paths",
    summary:
      "The two boards most people actually own, one parts list for several projects, starter paths, printable build sheets, and the bench's readings as a spreadsheet.",
    items: [
      "Boards: the ESP32 DevKit V1 (DOIT) 30-pin and the ESP32-C3 SuperMini, with every project whose pins are on their headers. Both are from documentation, not hardware tested yet.",
      "Shopping list: add projects and get one merged parts list with buy links, for building one at a time or all at once. The parts drawer suggests what to buy next.",
      "Starter paths: four short runs of projects, ticked off as you mark them built.",
      "Print build sheet on every project, Download CSV on the bench plotter, and Lab tested tags in the library once the hardware lab has run.",
    ],
    link: "/shop/",
  },
  {
    id: "v0-16",
    date: "2026-11-13",
    title: "Version 0.16: projects for your board",
    summary: "Pick your board once and the library shows what runs on it, and every project opens on that board's pinout.",
    items: [
      "A board filter in the library, shared with the board switch on project pages. Each board page links to its projects in the library.",
      "Sort the library by a suggested order (bare-board, Starter and hardware-tested projects first), newest or quickest build.",
      "The guide compares all eight supported boards, and the bench offers sample output above the terminal when no board is connected.",
    ],
    link: "/",
  },
  {
    id: "v0-15",
    date: "2026-11-13",
    title: "Version 0.15: easier on a phone",
    summary: "Fewer sections in the menu, and the wiring pad, board choices and library filters take far less room on a small screen.",
    items: [
      "Seven sections instead of nine: the Pin detective is now under Tools and the Hall of flames under Errors, at the same addresses.",
      "The wiring pad groups its parts like the parts drawer, and on a phone the list starts folded with the chosen parts named.",
      "Board choices use short names (ESP32, S3, C3) on a phone, and the library filters scroll sideways in one row.",
    ],
    link: "/wire/",
  },
  {
    id: "v0-14",
    date: "2026-11-13",
    title: "Version 0.14: a tidier library and project pages",
    summary:
      "The library has grown to 54 projects, so its filters and the parts picker have been reorganised to make the right one quicker to find.",
    items: [
      "New filters for buttons and input, and for clocks, logging and power. Wi-Fi, Bluetooth and radio projects share one filter, and a level filter picks Starter or Intermediate.",
      "What can I build tonight? now sits above the projects, with the parts drawer grouped into basics, sensors, displays, input, motors and radio.",
      "Projects added in the last few weeks are marked New.",
      "Project pages put the parts first, then the wiring, then a Flash to your board button, with long sketches shortened until you open them and the Arduino IDE steps folded away.",
    ],
    link: "/",
  },
  {
    id: "v0-13",
    date: "2026-11-13",
    title: "Version 0.13: starter-kit projects",
    summary:
      "Eight projects for the parts that come in almost every ESP32 and Arduino starter kit, each with its wiring diagram, parts card and firmware ready to flash.",
    items: [
      "RFID card reader with an allowed-cards list, and an IR remote decoder that learns three buttons.",
      "28BYJ-48 stepper with acceleration, and a 4x4 keypad PIN lock with a servo latch.",
      "MAX7219 scrolling LED matrix, DS3231 real-time clock with an alarm, ST7789 colour TFT dashboard, and a microSD data logger.",
    ],
    link: "/",
  },
  {
    id: "v0-12",
    date: "2026-11-13",
    title: "Version 0.12: no Arduino IDE needed",
    summary:
      "Every project can now be flashed straight from its page, settings go over USB, and you can edit a sketch, build it and flash it without installing anything.",
    items: [
      "Flash it from the browser: every project's sketch is compiled for every board it supports, ready to flash with one button.",
      "Settings over USB: projects that need Wi-Fi or account details take them from a form on the project page after flashing.",
      "Edit and build: change a sketch in the browser, press Build, and get compiler errors on the right lines or a firmware image to flash. Also on the new Build a sketch tool.",
      "The ESP32 Bench lab: a Raspberry Pi runner that flashes and tests projects on real boards, with results shown as Lab tested.",
    ],
    link: "/tools/build/",
  },
  {
    id: "v0-11",
    date: "2026-11-12",
    title: "Version 0.11: see it, build it, try it",
    summary:
      "Every project now has a wiring diagram with a step-by-step build mode and a picture of what you'll need, and fifteen projects can be tried in the browser before you build them.",
    items: [
      "Wiring diagrams for every project and board, drawn from the wiring table, with power and ground rails and inline resistors.",
      "Build it step by step: one wire at a time, with the pad lit on the pinout and your progress saved.",
      "Try it in your browser: play OLED Pong, Simon, the reaction timer and Morse, watch the NeoPixel fire, roll the dice and more.",
      "What you'll need: a card with every part drawn, resistor colour bands included.",
      "Wiring tables now list every ground and power connection as its own row.",
    ],
    link: "/projects/simon/",
  },
  {
    id: "v0-10",
    date: "2026-11-12",
    title: "Version 0.10: garage projects and community builds",
    summary:
      "Eight projects built around a real parts drawer, from an IR sonar sweep to a self-levelling platform, and build reports from people who made a project now show on its page.",
    items: [
      "Community builds: tick Publish it when you send a build report, and once it is checked it appears on the project page with your board, notes and serial output.",
      "ProbeHarbor on a 16x2 LCD with a rotary encoder, and a PIR motion sensor that reports to ProbeHarbor.",
      "IR sonar sweep, self-levelling platform, joystick pan-tilt turret, visitor counter and an automatic fan.",
      "An Arduino Uno to ESP32 radio link with nRF24L01+ modules, with both sketches on one page.",
    ],
    link: "/",
  },
  {
    id: "v0-9",
    date: "2026-11-12",
    title: "Version 0.9: games and toys",
    summary:
      "Nine new projects for fun: games, toys and things to show off, with a new Games and toys filter in the library.",
    items: [
      "ProbeHarbor readout display: your ProbeHarbor sensors on a small OLED, with a flashing warning for freezing, water or lost power. It reads a share link, so it works on the free plan.",
      "No parts needed: a reaction timer on the onboard LED and BOOT button, and a Morse code decoder that learns your speed.",
      "Games: Simon with four lights and buttons, Pong on an OLED with two knobs, and electronic dice that keep score.",
      "Toys: an ultrasonic theremin, a talking plant, a NeoPixel fire and lava lamp, and an internet clock that handles daylight saving.",
      "The theremin, the talking plant and the dice print numbers the bench plotter charts live; play their sample output to see it.",
    ],
    link: "/",
  },
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
