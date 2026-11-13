# Compile service

Compiles Arduino-ESP32 sketches for the site's in-browser editor and returns a
merged flash image. A Worker (`esp32-bench-compile`, https://compile.esp32bench.dev)
forwards each build to a container running PlatformIO with the pioarduino platform
(Arduino core 3.x), the toolchains for the ESP32, S2, S3, C3 and C6, and every
library the site's projects use, all pre-installed and pre-built.

## How a build runs

1. The site POSTs `{board, code, libs, partitions?}` to `/compile`.
2. The Worker checks the origin, the request, a per-address rate limit (4 a minute)
   and the daily quotas (40 per address, 600 in total), then picks one of two
   container instances (`c0`, `c1`).
3. The instance's Durable Object starts the container if it is asleep, waits for its
   `/health`, and forwards the request. The container writes the sketch into a
   pre-warmed PlatformIO project for that board, runs `pio run` (120 s limit, one
   build at a time), merges bootloader, partition table, `boot_app0` and the app into
   one image with esptool, and answers with the image as base64 plus the build log.
   Each board's project has a fixed `platformio.ini` listing every library, built once
   in the image; libraries are static archives, so a sketch links only what it uses,
   and the cached core and library objects stay valid. `huge_app` is a second,
   separately pre-built environment, because changing the partition table changes
   the config and would otherwise rebuild everything.
4. The Worker parses the log into errors, warnings and sizes and returns JSON.
5. The container sleeps two minutes after its last build. Two things make sure it
   does: the Durable Object sets the platform's inactivity timeout, and an alarm-based
   idle guard records the time of each build's end and calls `destroy()` once the
   container has been idle for `SLEEP_AFTER_MS`, whatever the platform counts as
   activity. `GET /health` reads the state without starting or keeping awake a
   container, and the Durable Object does not pass the container's exit monitor to
   `waitUntil` (that kept containers running indefinitely in the first deploy).

## Request

`POST https://compile.esp32bench.dev/compile` (JSON; `Origin` must be
`https://esp32bench.dev` or `http://localhost:4321`). Add `?nobin=1` to leave the
image out of the answer.

```json
{
  "board": "esp32c3",
  "code": "void setup() {}\nvoid loop() {}\n",
  "libs": ["DHT sensor library (Adafruit)", "Adafruit Unified Sensor"],
  "partitions": "huge_app"
}
```

- `board`: `esp32`, `esp32s3`, `esp32c3`, `esp32s2`, `esp32c6`, `xiao-esp32c3`, `xiao-esp32s3`, `esp32-cam` or `esp32c3-supermini` (USB CDC on boot).
- `code`: the sketch, at most 150 KB.
- `libs`: optional, the site's library names (as `Project.libs`); names containing "built in" are ignored; any other unknown name is refused with 400.
- `partitions`: optional, only `"huge_app"`.

## Response

`200` with:

```json
{
  "ok": true,
  "board": "esp32c3", "chip": "esp32c3", "core": "3.3.12",
  "seconds": 9.4, "totalSeconds": 10.1,
  "errors": [{ "file": "main.ino", "line": 12, "col": 5, "message": "'fooBar' was not declared in this scope", "inSketch": true }],
  "warnings": [],
  "sizes": { "flashUsed": 268905, "flashTotal": 1310720, "ramUsed": 20744, "ramTotal": 327680 },
  "failure": "",
  "log": "...last 6000 characters of the build output...",
  "image_b64": "...", "image_bytes": 337872, "bootloader_offset": 0
}
```

- `ok` false: `errors` has the compiler's messages with sketch line numbers
  (`inSketch` false means a library or core file), or `failure` says why when there
  are no parsed errors (program too big, link error, timeout).
- `image_b64` is a merged image: flash it at offset 0 (the site's flash tool and
  esptool-js both take it as one part). `image_bytes` is its decoded size.
- Other statuses: `400` bad request, `403` wrong origin, `413` too large, `415` not
  JSON, `429` rate limit or quota (the `error` text says which), `503` the container
  could not be reached.

`GET /health` answers `{ok, state: "ready" | "starting" | "sleeping", core, instances}`
without waking a sleeping container.

## Costs and limits

- Instance type: `standard-2` (1 vCPU, 6 GiB, 12 GB disk; `INSTANCE` in `src/index.ts`).
- Sleep after 2 idle minutes (`SLEEP_AFTER_MS` = 120000), enforced by the idle guard.
- At most two instances: the Worker only ever addresses the names in `POOL` (`c0`,
  `c1`). The Durable Object scheduling policy has no `max_instances` setting, so this
  name pool is the cap. More concurrent builds queue inside an instance (one build at
  a time per container).
- Workers Paid includes 375 vCPU-minutes, 25 GiB-hours of memory and 200 GB-hours of
  disk a month for Containers. Beyond that: $0.000020 per vCPU-second,
  $0.0000025 per GiB-second, $0.00000007 per GB-second. Billing runs while a
  container is awake: each wake-up costs at least the 2-minute idle tail. One awake
  `standard-2` minute is about 6 GiB-minutes of memory and 12 GB-minutes of disk,
  so the included memory covers roughly 250 awake minutes a month; beyond that an
  awake hour costs about $0.06 (memory) + $0.05 (disk) + CPU actually used.
- Quotas (`QUOTA` in `src/shared.ts`): 40 builds per address per UTC day, 600 a day in
  total, counted in the KV namespace `esp32-bench-compile-quota`; plus 4 a minute per
  address through a rate-limit binding.

## Rebuild and redeploy

```sh
cd compile
npm ci
node --experimental-strip-types test/shared.test.ts   # validation, log parsing, quotas
node scripts/sync-libs.mjs   # copy ../src/data/compile-libs.json (the site's library list) into container/
cf deploy --dry-run   # builds the image with Docker (first time: ~15 minutes, ~3 GB download)
cf deploy
```

Docker must be running. The image is rebuilt from `container/Dockerfile` on every
deploy; unchanged layers come from Docker's cache. The library list is the site's
`src/data/compile-libs.json`, shared with the firmware builds and the editor's library
picker: add a library there, run `node scripts/sync-libs.mjs`, and redeploy. The test
fails if the copy in `container/` drifts from it. A library that does not build for a
chip is left out of that chip's template in `container/templates.py` (`CHIP_SKIP`;
OneWire and DallasTemperature on the ESP32-C6 today).

To try the container locally:

```sh
docker build --platform linux/amd64 -t esp32-bench-compiler:local container
docker run --rm -p 8080:8080 --network none esp32-bench-compiler:local
python3 test/make-payloads.py <sketch-root> /tmp/payloads
curl -s -X POST -H 'Content-Type: application/json' --data @/tmp/payloads/blink-esp32.json http://localhost:8080/compile | head -c 300
```

## Measurements

Image: 8.6 GB uncompressed (toolchains and framework 3.8 GB after removing 8.6 GB of
packages for other chips, debuggers and duplicate installer copies; pre-built
templates 2.3 GB for 8 boards × 2 environments).

Build time inside the container with no network, warm (the container already running),
measured locally with Docker CPU limits:

| Sketch | ½ vCPU (standard-1) | 1 vCPU (standard-2) |
| --- | --- | --- |
| blink, ESP32 | 17 s | 7 s |
| DHT22 + 2 libraries, ESP32-C3 | 14 s | 6 s |
| SSD1306 + GFX, ESP32-S3 | 18 s | 8 s |
| I2C scanner, ESP32-S2 | 15 s | 7 s |
| BLE scanner, ESP32-C6, huge_app | 7 s (after pre-building the env) | 7 s |
| compile error, ESP32 | 11 s | 5 s |

The container runs with no internet. `PLATFORMIO_OFFLINE=1` stops pioarduino's
internet check (with no DNS answer it hung past the build limit), the PlatformIO update
checks are set to a year (0 means "every time"), and the server points DNS at
127.0.0.1 so any other lookup fails at once.

Live, on https://compile.esp32bench.dev (2026-11-13, core 3.3.12, standard-2):

| Sketch | Cold (container asleep) | Warm |
| --- | --- | --- |
| BLE scanner, ESP32-C6, huge_app | 53 s total (18 s build) | 16 s |
| blink, ESP32 | | 19–20 s |
| DHT22 + 2 libraries, ESP32-C3 | | 17–23 s |
| SSD1306 + GFX, ESP32-S3 | | 22–24 s |
| compile error, ESP32-C3 | | 11–12 s (`main.ino:12:3 expected ',' or ';'`) |

A cold start adds about 35 s. Builds in the cloud run about 2–3 times slower than on
one core of a desktop workstation. Time to sleep after the last build: 2 minutes 1
second (last build 00:10:38 UTC, containers stopped 00:12:17 and 00:12:39 UTC, as
reported by both `/health` and `cf containers applications instances list`).
