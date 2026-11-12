# ESP32 Bench

A project library and a serial workbench for ESP32 boards, in one static web page.

- **Library:** eight starter projects, each with a highlighted pinout, a wiring table, a parts list and an Arduino sketch you can copy.
- **Bench:** a serial monitor built on Web Serial. Connect, pick a baud rate, send lines, pulse EN to reset the board, and copy the log. Crash and error lines are highlighted.
- **Sample output:** recorded output for every project, so you can see what a working build prints without a board attached.

There is no build step and no dependencies. Everything is in `index.html`.

## Run it

Web Serial needs a secure page, so open it from `localhost` or HTTPS, not from a `file://` path.

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Or enable GitHub Pages for this repository (Settings, Pages, deploy from the `main` branch root).

Connecting a board needs Chrome or Edge on a desktop. The library and sample output work in any browser.

## Add a project

Projects live in the `PROJECTS` array near the top of the script in `index.html`. Each entry has:

| Field | Meaning |
| --- | --- |
| `id` | Short slug, used in the URL as `#p-<id>` |
| `name`, `sum` | Title and one-line summary |
| `level`, `mins` | Difficulty label and rough build time |
| `tags` | Any of `no-parts`, `sensors`, `display`, `wifi`, `power` |
| `pins` | Pin labels to highlight on the pinout, such as `"21"`, `"3V3"`, `"GND"` |
| `parts` | `[quantity, description]` pairs |
| `wiring` | `[from, to, note]` rows |
| `libs` | Arduino libraries to install |
| `baud` | Serial speed the sketch uses |
| `code` | The sketch, in a `String.raw` template |
| `sample` | Lines the sketch prints when it works |

## Status

v0.1. The sketches have not been run on hardware from this repository yet, and the serial monitor has not been tested against a physical board. Treat both as a first draft and check the wiring against your own board's pinout.

Not built yet:

- Flashing firmware from the browser. It needs compiled `.bin` files per project and an esptool-js integration.
- Boards other than the 38-pin ESP32-DevKitC V4 layout.
- Saving your own projects.
