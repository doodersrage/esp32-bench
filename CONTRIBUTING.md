# Contributing to ESP32 Bench

Thanks for helping. The most useful contributions, in order:

1. **Build reports.** Built a project? Send a build report from the project's page on esp32bench.dev, or open a
   [build report issue](../../issues/new?template=build-report.yml), with the board, core version and what the serial port printed. Passing reports
   become the "Tested on this board" entries on the project page.
2. **Corrections.** A wrong pin, a broken link or a misleading explanation. Use "Report a mistake on this page" at the
   bottom of any page, or open an issue.
3. **Failure stories** for the Hall of Flames: what the serial port said, what it
   looked like, what was actually wrong.
4. **New projects** and boards. Open an issue first so we can agree on scope.

## Working on the site

Needs Node 22.12 or newer.

```sh
npm ci
npm run dev       # http://localhost:4321
npm run build     # must pass, including the error-reference consistency check
```

Projects live in `src/data/projects.ts`, boards in `src/data/boards.ts`, errors in
`src/data/errors.ts`. Every sketch must compile for each board it lists with the
current Arduino-ESP32 3.x core. Only add a `verified` entry for something that
actually ran on hardware, and say which board and firmware.

Every pull request runs the full test suite (first-time contributors wait for a maintainer to approve the run). Merged pull requests deploy to esp32bench.dev automatically.

By contributing you agree that your code is released under MIT and your written
content under CC BY 4.0, as described in [LICENSE](LICENSE).
