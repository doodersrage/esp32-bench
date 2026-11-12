# ESP32 Bench

A project library and a serial workbench for ESP32 boards, built as a static site with [Astro 7](https://astro.build/).

- **Library:** nine projects, each with a highlighted pinout, a wiring table, a parts list with buy links, and either an Arduino sketch to copy or prebuilt firmware to flash from the page.
- **Boards:** pin headers, hardware-tested pins and field notes for the ESP32-DevKitC V4, ESP32-S3-DevKitC-1 and ESP32-C3-DevKitM-1. Projects that support more than one board have a board switch.
- **Bench:** a serial monitor built on Web Serial. Connect, pick a baud rate, send lines, pulse EN to reset the board, and copy the log. Crash lines are highlighted and common ones get a plain-language hint.
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
public/firmware/          Prebuilt firmware images and ESP Web Tools manifests
src/
  data/projects.ts        Projects, per-board pin values, hardware test results
  data/boards.ts          Board headers, tested pins and field notes
  components/
    Pinout.astro          Board figure with a project's pins highlighted
    ProjectCard.astro     Library card
    Flasher.astro         Browser install button (ESP Web Tools)
  layouts/Base.astro      Page shell, header and navigation
  pages/
    index.astro           Library with search and filters
    projects/[id].astro   One page per project
    boards.astro          Board reference
    bench.astro           Serial monitor
  scripts/bench.ts        Web Serial logic and line hints for the bench
  lib/shop.ts             Buy links and the Amazon Associates tag
  lib/paths.ts            Link helper that respects Astro's `base`
  styles/global.css       Theme tokens and all styles
```

## Add a project

Add an entry to `PROJECTS` in `src/data/projects.ts`. The `Project` type documents each field.

- List `boards` to support more than the classic ESP32, and put per-board pin numbers in `vars`. Write `%SDA%`-style placeholders in `pins`, `wiring`, `code` and `sample`; they are filled in per board.
- Record real hardware checks in `verified`. A project with none is labelled "Not hardware tested".
- For prebuilt firmware, put the merged images and an ESP Web Tools `manifest.json` under `public/firmware/<id>/` and set `flash`.

## Buy links

Parts link to Adafruit and Amazon. Set `PUBLIC_AMAZON_ASSOCIATE_TAG` at build time to add an Associates tag to the Amazon links; without it they stay plain. Pages with buy links show a disclosure line, and Amazon links carry `rel="sponsored"`.

## Data from ProbeHarbor

The S3 and C3 pin choices, the hardware test results, the field notes, the buy links and the `probeharbor-probe` firmware come from [ProbeHarbor](https://github.com/doodersrage/probeharbor) (MIT).

The images in `public/firmware/probeharbor-probe/` are copies of ProbeHarbor's `public/firmware/` at firmware 1.2.6. To update them, copy the three `.bin` files and `manifest.json` again and change `flash.version` in the project entry.

## Deploy

The site is static. For Cloudflare, build with `npm run build` and serve `dist/` as Workers static assets or Pages. For a GitHub Pages project site, set `site` and `base` in `astro.config.mjs`; internal links already follow `base`.

## Status

v0.3. Every push is built by the `Build` workflow in GitHub Actions. Not verified yet:

- The site builds in CI (Astro 7.4, 12 pages), but nobody has looked at the built pages in a browser yet.
- The eight starter sketches and the bench's serial monitor have not been run against a physical board. Only the ProbeHarbor probe carries hardware test results, and those were recorded in ProbeHarbor, not here.
- The flash button on the probe page has not been tried from this site.

Not built yet:

- Sending the probe's Wi-Fi settings from this site. For now that step happens at probeharbor.dev/flash or through the setup portal.
- A build pipeline that compiles the starter sketches into flashable images.
- Saving your own projects.
