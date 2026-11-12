# ESP32 Bench

A project library and a serial workbench for ESP32 boards, built as a static site with [Astro 7](https://astro.build/).

- **Library:** eight starter projects, each with a highlighted pinout, a wiring table, a parts list and an Arduino sketch you can copy. Every project is its own page at `/projects/<id>/`.
- **Bench:** a serial monitor built on Web Serial. Connect, pick a baud rate, send lines, pulse EN to reset the board, and copy the log. Crash and error lines are highlighted.
- **Sample output:** recorded output for every project, so you can see what a working build prints without a board attached.

## Run it

Needs Node 22.12 or newer.

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # static site in dist/
npm run preview  # serve the built site
```

Web Serial needs a secure page, so use `localhost` or HTTPS. Connecting a board needs Chrome or Edge on a desktop. The library and sample output work in any browser.

## Layout

```text
src/
  data/projects.ts        Project data and the board's pin headers
  components/
    Pinout.astro          Board figure with a project's pins highlighted
    ProjectCard.astro     Library card
  layouts/Base.astro      Page shell, header and navigation
  pages/
    index.astro           Library with search and filters
    projects/[id].astro   One page per project
    bench.astro           Serial monitor
  scripts/bench.ts        Web Serial logic for the bench
  lib/paths.ts            Link helper that respects Astro's `base`
  styles/global.css       Theme tokens and all styles
```

## Add a project

Add an entry to `PROJECTS` in `src/data/projects.ts`. The `Project` type in that file documents each field. A new entry gets a library card, its own page and a sample-output option on the bench with no other changes.

## Deploy to GitHub Pages

Set `site` and `base` in `astro.config.mjs` (for this repository, `base: "/esp32-bench"`), then publish `dist/` with Astro's official GitHub Pages action. Internal links already follow `base`.

## Status

v0.2. Not verified yet:

- The Astro project was written without running `astro build`, so the first `npm install && npm run build` is its first real test. There is no lockfile yet; commit the `package-lock.json` that `npm install` creates.
- The sketches and the serial monitor have not been run against a physical board.

Not built yet:

- Flashing firmware from the browser. It needs compiled `.bin` files per project and an esptool-js integration.
- Boards other than the 38-pin ESP32-DevKitC V4 layout.
- Saving your own projects.
