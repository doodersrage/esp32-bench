# ESP32 Bench

A project library and a serial workbench for ESP32 boards, built as a static site with [Astro 7](https://astro.build/).

- **Library:** twenty-one projects, each with a highlighted pinout, a wiring table, a parts list with buy links, and either an Arduino sketch to copy or prebuilt firmware to flash from the page.
- **Boards:** pin headers, hardware-tested pins and field notes for the ESP32-DevKitC V4, ESP32-S3-DevKitC-1 and ESP32-C3-DevKitM-1. Projects that support more than one board have a board switch.
- **Wire:** a wiring pad. Pick a board and parts, tap a part pin and a board pad, and each wire is checked for boot pins, input-only pins, 5 V signals and pads used twice. It can wire everything for you, and remix two projects onto one board.
- **Detective:** flash a small helper firmware, touch a jumper from GND to any pad and watch that pad light up, with a silkscreen quiz. It also reads the chip, flash size and MAC address into a board passport you can save.
- **Flames:** a gallery of failures with what the serial port said and what was actually wrong. Six come from ProbeHarbor's hardware test log.
- **Bench:** a serial monitor built on Web Serial, with an optional second board alongside for sender and receiver projects. Connect, pick a baud rate, send lines, pulse EN to reset the board, and copy the log. Crash lines are highlighted and common ones get a plain-language hint.
- **Plotter:** numbers that keep appearing in the serial output are charted live, one small chart per value.
- **Wi-Fi radar:** the Wi-Fi scanner project's output is drawn as arches by channel and signal strength.
- **Crash translator:** reset reasons, Guru Meditation errors and backtraces get a plain-language explanation, live or from a pasted log.
- **Bench log:** mark projects as built to earn badges and keep a streak, and let the library pick a project from the parts in your drawer. Kept in the browser only.
- **Sample output:** recorded output for every project, so you can see what a working build prints without a board attached.

## Run it

Needs Node 22.12 or newer.

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # static site in dist/
npm run preview  # serve the built site
```

Web Serial needs a secure page, so use `localhost` or HTTPS. Flashing and connecting a board need Chrome or Edge on a desktop. The library, boards and sample output work in any browser.

## Layout

```text
firmware/pin-detective/   Helper firmware for the Detective page (PlatformIO)
scripts/build-firmware.mjs  Compiles it and writes the merged images
public/firmware/          Prebuilt firmware images and ESP Web Tools manifests
src/
  data/projects.ts        Projects, per-board pin values, hardware test results
  data/boards.ts          Board headers, tested pins and field notes
  data/probeharbor.ts     Library entries for the ProbeHarbor sketches
  data/parts.ts           Parts the wiring pad can connect, with pin types
  data/flames.ts          Failure stories for the Flames page
  sketches/probeharbor/   Those sketches as .ino files, copied unchanged
  components/
    Pinout.astro          Board figure with a project's pins highlighted
    ProjectCard.astro     Library card
    Flasher.astro         Browser install button (ESP Web Tools)
    ProbeSetup.astro      Form that sends Wi-Fi and the device key to the probe over USB
  layouts/Base.astro      Page shell, header and navigation
  pages/
    index.astro           Library with search and filters
    projects/[id].astro   One page per project
    boards.astro          Board reference
    wire.astro            Wiring pad and remix
    detective.astro       Pin detective and board passport
    bench.astro           Serial monitor
    flames.astro          Failure gallery
  scripts/bench.ts        Web Serial logic for the bench
  scripts/second-board.ts The bench's second monitor
  scripts/detective.ts    Detective page logic
  scripts/plotter.ts      Live charts from serial numbers
  scripts/radar.ts        Wi-Fi channel view
  scripts/library.ts      Filters, bench log and the drawer picker
  scripts/progress.ts     Build marks, streaks and badges
  lib/serial.ts           Web Serial session: lines in, lines out, reset
  lib/detective.ts        Parser for the pin detective's serial lines
  lib/wiring.ts           Wiring rules, auto-wiring and pin constants
  lib/crash.ts            Explanations for reset, panic and backtrace lines
  scripts/probe-setup.ts  The probe's USB settings protocol
  lib/shop.ts             Buy links and the Amazon Associates tag
  lib/paths.ts            Link helper that respects Astro's `base`
  styles/global.css       Theme tokens and all styles
```

## Add a project

Add an entry to `PROJECTS` in `src/data/projects.ts`. The `Project` type documents each field.

- List `boards` to support more than the classic ESP32, and put per-board pin numbers in `vars`. Write `%SDA%`-style placeholders in `pins`, `wiring`, `code` and `sample`; they are filled in per board.
- List the parts it needs beyond the board in `needs`, using keys of `DRAWER`.
- Record real hardware checks in `verified`. A project with none is labelled "Not hardware tested".
- For prebuilt firmware, put the merged images and an ESP Web Tools `manifest.json` under `public/firmware/<id>/` and set `flash`.

## Buy links

Parts link to Adafruit and Amazon. Set `PUBLIC_AMAZON_ASSOCIATE_TAG` at build time to add an Associates tag to the Amazon links; without it they stay plain. Pages with buy links show a disclosure line, and Amazon links carry `rel="sponsored"`.

## Data from ProbeHarbor

The S3 and C3 pin choices, the hardware test results, the field notes, the buy links, the `probeharbor-probe` firmware, its USB settings protocol and the seven sketches in `src/sketches/probeharbor/` come from [ProbeHarbor](https://github.com/doodersrage/probeharbor) (MIT).

The images in `public/firmware/probeharbor-probe/` are copies of ProbeHarbor's `public/firmware/` at firmware 1.2.6. To update them, copy the three `.bin` files and `manifest.json` again and change `flash.version` in the project entry.

## Firmware

`firmware/pin-detective` is built by the `Firmware` workflow whenever it changes. The workflow compiles it for the ESP32, ESP32-S3 and ESP32-C3 and commits merged images to `public/firmware/pin-detective/`. To build locally, install PlatformIO and run `node scripts/build-firmware.mjs`.

## Deploy

The site is static. For Cloudflare, build with `npm run build` and serve `dist/` as Workers static assets or Pages. For a GitHub Pages project site, set `site` and `base` in `astro.config.mjs`; internal links already follow `base`.

## Status

v0.3. Every push is built by the `Build` workflow in GitHub Actions. Not verified yet:

- The site builds in CI. The bench's plotter, radar and crash translator were checked once in a headless browser with sample data; the other pages have not been viewed in a browser yet.
- The eight starter sketches and the bench's serial monitor have not been run against a physical board. Only the ProbeHarbor probe carries hardware test results, and those were recorded in ProbeHarbor, not here.
- The flash button and the settings form on the probe page have not been tried from this site.
- The seven ProbeHarbor sketches have no recorded hardware test.
- The pin detective firmware compiles for all three chips but has never run on a board. The Detective page and the second bench monitor were tested against a simulated serial port only.

Not built yet:

- A build pipeline that compiles the starter sketches into flashable images.
- Saving your own projects.
- Merging sketches in a remix. It merges wiring and pin numbers only.
