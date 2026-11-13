# ESP32 Bench

A project library and a serial workbench for ESP32 boards, built as a static site with [Astro 7](https://astro.build/).

- **Library:** fifty-four projects, each with a highlighted pinout, a wiring table, a parts list with buy links, and either an Arduino sketch to copy or prebuilt firmware to flash from the page.
- **Boards:** a page per board with its pinout, every pin's functions and a safe-to-use verdict: ESP32-DevKitC V4, ESP32-S3-DevKitC-1 and ESP32-C3-DevKitM-1 (with hardware-tested pins), ESP32-S2-DevKitC-1, ESP32-C6-DevKitC-1, Seeed XIAO ESP32C3 and ESP32S3, the AI-Thinker ESP32-CAM, the ESP32 DevKit V1 (DOIT) 30-pin and the ESP32-C3 SuperMini, plus a chip comparison. The DOIT and SuperMini are variants (`variantOf` in `src/data/boards.ts`): a project for the DevKitC or C3 DevKitM runs on them when every pin it uses is on their header. Chip data is in `src/data/chips.ts`. Projects that support more than one board have a board switch.
- **Wire:** a wiring pad. Pick a board and parts, tap a part pin and a board pad, and each wire is checked for boot pins, input-only pins, 5 V signals and pads used twice. It can wire everything for you, and remix two projects onto one board.
- **Detective:** flash a small helper firmware (ESP32, S2, S3, C3 and C6; the S2 and C6 images are not hardware tested yet), touch a jumper from GND to any pad and watch that pad light up, with a silkscreen quiz. XIAO boards show their D0 to D10 labels. It also reads the chip, flash size and MAC address into a board passport you can save. `scripts/build-firmware.mjs` builds the ESP32, S3 and C3 on Arduino core 2.0.17 and the S2 and C6 on core 3.x, in separate PlatformIO homes.
- **Flames:** a gallery of failures with what the serial port said and what was actually wrong. Six come from ProbeHarbor's hardware test log.
- **Bench:** a serial monitor built on Web Serial, with an optional second board alongside for sender and receiver projects. Connect, pick a baud rate, send lines, pulse EN to reset the board, and copy the log. Crash lines are highlighted and common ones get a plain-language hint.
- **Plotter:** numbers that keep appearing in the serial output are charted live, one small chart per value.
- **Wi-Fi radar:** the Wi-Fi scanner project's output is drawn as arches by channel and signal strength.
- **Crash translator:** reset reasons, Guru Meditation errors and backtraces get a plain-language explanation, live or from a pasted log.
- **Tools:** a backtrace decoder (ELF and DWARF parsed in the browser), a firmware flasher for your own .bin files (esptool-js) and a partition table builder. Tests: `node scripts/test-tools.mjs` and `node scripts/test-backtrace.mjs`.
- **Search:** a header box and `/search/` over projects, boards, single pins, errors, tools, guide sections and flames, from a build-time index (`/search-index.json`, `src/lib/search.ts`). Test: `node --experimental-strip-types scripts/test-search.mjs` after a build.
- **Shared logs:** the bench and the crash translator make links that carry the log, compressed, in the `#fragment` (`src/lib/share.ts`). Test: `node --experimental-strip-types tests/share.test.ts`.
- **Preview images:** a 1200x630 card per project, board, error and tool page, rendered at build time with satori and resvg (`src/lib/og.ts`, `src/pages/og/`).
- **Visual guides:** every project page has a generated wiring diagram per board (`src/lib/wiring-diagram.ts`, `src/components/WiringDiagram.astro`) with a step-by-step build mode (`src/scripts/build-mode.ts`), a "What you'll need" kit card (`src/lib/kit.ts`, `src/lib/kit-icons.ts`, `/og/kits/<id>.png`), and for fifteen projects a "Try it" simulation (`src/components/Preview.astro`, `src/scripts/previews/`). Tests: `DUMP_WIRING=1 DUMP_KIT=1 npx astro build`, then `tests/wiring-diagram.test.ts`, `tests/kit.test.ts` and `tests/previews.test.ts` with `node --experimental-strip-types`.
- **Errors:** a reference page for each common crash, reset, boot and upload error, with causes, fixes and a box to paste a log into. A build check keeps it in step with the crash translator.
- **Start:** a getting started guide covering cables, drivers, Linux permissions, Web Serial and the Arduino IDE.
- **App:** installs from Chrome or Edge, works offline for pages already opened, and has light and dark themes. Also an about page, a what's new page and an RSS feed.
- **Bench log:** mark projects as built to earn badges and keep a streak, and let the library pick a project from the parts in your drawer. Kept in the browser only.
- **Sample output:** recorded output for every project, so you can see what a working build prints without a board attached.

## Run it

Needs Node 22.12 or newer.

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # static site in dist/
npm run preview  # serve the built site
npm run deploy   # build, upload to Cloudflare Workers and ping IndexNow (needs `npm i -g cf` and `cf auth login`)
```

The public address is `site` in `astro.config.mjs`. Canonical links, link previews, the sitemap, the RSS feed and robots.txt are built from it. `cloudflare.config.ts` makes Cloudflare serve `404.html` for unknown paths, and `public/_headers` keeps the service worker uncached. Pushes to `main` also deploy through `.github/workflows/deploy.yml` once the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets are set.

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
  data/errors.ts          Error reference entries
  data/changes.ts         Release notes for /changes/ and the RSS feed
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
  lib/site.ts             Site name, description and repository link
  lib/routes.ts           Every page, for the sitemap and the offline cache
  scripts/shell.ts        Theme switch, install button, offline notice, service worker
  pages/sw.js.ts          Service worker, generated per build
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

Version 0.17 (release notes at `/changes/`, from `src/data/changes.ts`).

Running and checked automatically:

- Every push is built, type checked and tested in GitHub Actions (`Build`), and the site, report API and uptime monitor deploy on push to main (`Deploy`). `scripts/smoke-pages.mjs` loads one page of each kind in headless Chrome and fails on any script error.
- Every library sketch is compiled for every board it supports, on Tuesdays and when sketches change, booted in QEMU (ESP32 and ESP32-C3 images), and published as flashable firmware (`Firmware library`). A weekly job (`Weekly check`) compiles the sketches against the newest Arduino core and checks outside links.
- The compile service, firmware library, lab API and community build reports are live.

Tested on hardware so far, and what is not:

- The ProbeHarbor probe firmware, and the header pins of the ESP32-DevKitC, ESP32-S3-DevKitC-1 and ESP32-C3-DevKitM-1, were tested on real boards (in ProbeHarbor's test log). Board pages mark these "Pins tested on hardware".
- The other library projects compile for every board they list but have not been run on hardware here. Each shows "Not hardware tested" until the hardware lab (`lab/`) or a published build report says otherwise. The lab is set up to run weekly; its results show as "Lab tested" on project pages and in the library.
- The ESP32-S2, ESP32-C6, XIAO, ESP32-CAM, DOIT 30-pin and C3 SuperMini boards come from documentation, not hardware tests. The C3 SuperMini has no header figure because its pad order could not be confirmed.
- The Pin detective firmware and the second bench monitor have been tested against a simulated serial port, not a board.

Not built yet:

- Saving projects of your own. Edits to a library sketch are kept in the browser.
- Merging two sketches in a remix. The wiring pad merges wiring and pin numbers only.

## No-IDE toolchain

- **Firmware library:** `.github/workflows/firmware-library.yml` (Tuesdays and on sketch changes) compiles every sketch for every board (`scripts/build-firmware-library.mjs`, shared code in `scripts/lib/sketch-build.mjs`) and uploads merged images and ESP Web Tools manifests to the R2 bucket `esp32-bench-firmware`, served at `fw.esp32bench.dev`, through `PUT api.esp32bench.dev/fw/<key>`. The API accepts only a GitHub Actions OIDC token for this repository's main branch (`api/src/github-oidc.ts`), so no upload secret exists. Nothing is uploaded unless every build passed, and `index.json` goes last. Project pages show a Flash button when their project is in the index.
- **Settings over USB:** configurable sketches include `src/sketches/bench-settings.inc` and read Wi-Fi and account settings from flash, with the sketch's constants as defaults. The settings form on the project page sends them over Web Serial (`src/lib/settings-protocol.ts`; protocol `SETTINGS?`, `SET`, `UNSET`, `SAVE`).
- **Compile service:** `compile/` is the `esp32-bench-compile` Worker at `compile.esp32bench.dev`, running PlatformIO in Cloudflare Containers (`standard-2`, at most two instances, stopped 2 minutes after the last build). Quotas: 4 builds a minute and 40 a day per visitor, 600 a day in total. Its library list comes from `src/data/compile-libs.json` (`compile/scripts/sync-libs.mjs`). It is deployed by hand, not by CI, because the image is 8.6 GB: see `compile/README.md`.
- **Editor:** "Edit and build" on project pages and `/tools/build/` (`src/components/SketchBuilder.astro`, `src/scripts/editor/`, CodeMirror loaded only when used).
- **Crash decoding for library firmware:** library images are built with their ELF's SHA-256 embedded (`--elf-sha256-offset 0xb0`, added by `elf_sha.py` in each PlatformIO project, as the Arduino IDE does), so a crash prints "ELF file SHA256". The firmware library uploads each ELF gzipped as `elf/<first 32 hex digits>.gz` with `elf/index.json` (90 days of builds). The backtrace decoder (`src/lib/library-elf.ts`) looks up a pasted crash's hash and decodes it with that ELF, no file needed. Old ELFs are removed by an R2 lifecycle rule on the `elf/` prefix of `esp32-bench-firmware` (expire after 100 days), set once in the Cloudflare dashboard.
- **Emulator check:** after building, the firmware library boots every ESP32 and ESP32-C3 image in Espressif's QEMU (`scripts/emulate-firmware.mjs`) and reports, in the job summary, whether it booted, crashed or reboot-looped, and whether projects that need no parts printed what the lab expects. QEMU has no Wi-Fi, Bluetooth or sensors, so radio projects are reported as stopping at the radio. Report only for now; `--strict` makes a crash block publishing.
- **Hardware lab:** `lab/` is a Raspberry Pi runner that flashes each project from the firmware library, checks its serial output against `src/data/lab-expect.ts`, and posts results to `api.esp32bench.dev/lab/runs`; see `lab/README.md`.

## Community

- **Published build reports:** a build report whose sender ticks "Publish it" is stored as pending in the D1 database `esp32-bench-reports` (`api/migrations/`). The report email links to `api.esp32bench.dev/moderate/<id>?t=<token>`, a confirmation page whose Approve and Reject buttons post the decision, so email link scanners cannot approve anything. Only a SHA-256 of the token is stored. Approved reports come from `GET /builds?project=<id>` and appear under Community builds on the project page. Test: `cd api && node --experimental-strip-types test/builds.test.ts`.
- **Comments:** `src/components/Comments.astro` embeds giscus on project and error pages, backed by GitHub Discussions in the public, code-free repository `doodersrage/esp32-bench-community`. It stays hidden until `SITE.giscus.enabled` is set to true in `src/lib/site.ts`, which needs the giscus GitHub App installed on that repository.

## Report form

`/report/` sends build reports, corrections and messages by email; nothing is published. The footer's "Report a mistake on this page" and each project's "Send a build report" open it pre-filled.

The backend is a separate Worker in `api/` (`esp32-bench-api`, served at `api.esp32bench.dev`). It accepts JSON from esp32bench.dev only, requires a Cloudflare Turnstile token (verified with siteverify for action `report` and hostname `esp32bench.dev`; the widget secret is the `TURNSTILE_SECRET` Worker secret), checks a honeypot field, a minimum fill-in time and field lengths, rate-limits each visitor, and sends the report through Cloudflare Email Routing to a verified address held in the `REPORT_TO` Worker secret. Deploys keep the secret. To change the address, verify it under Email Routing first, then redeploy once with `cf deploy --secrets-file <file>` containing `{"REPORT_TO": "..."}`.

```sh
cd api
npm ci
node --experimental-strip-types test/report.test.ts
node --experimental-strip-types test/turnstile.test.ts
cf deploy
```

## Keeping it healthy

- **Uptime monitor** (`monitor/`, Worker `esp32-bench-monitor`): every 5 minutes it checks the home page, a project page, the search index, the firmware manifest, the report API and the www redirect. A check that fails twice in a row sends a DOWN email, and recovery sends another, through Email Routing to the `ALERT_TO` Worker secret. State is kept in the `esp32-bench-monitor` KV namespace and only written when it changes. Test: `cd monitor && node --experimental-strip-types test/checks.test.ts`.
- **Weekly check** (`.github/workflows/weekly-check.yml`, Mondays): compiles every sketch for every board with the newest Arduino-ESP32 core (`scripts/check-sketches.mjs`, using a sketch export built only with `DUMP_SKETCHES=1`) and checks every outside link (`scripts/check-links.mjs`). Problems open or update the GitHub issue "Weekly check found problems".
- **Dependabot** (`.github/dependabot.yml`): weekly grouped updates for the site, `api/` and `monitor/`, monthly for Actions. The Build workflow runs every test on its pull requests.

## Contributing and license

See [CONTRIBUTING.md](CONTRIBUTING.md). Visitors send build reports and corrections through the site's report form. The GitHub issue forms in `.github/ISSUE_TEMPLATE/` are for contributors once the repository is public.

Code is MIT licensed and written content is CC BY 4.0. See [LICENSE](LICENSE).
