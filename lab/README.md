# The ESP32 Bench hardware lab

A Raspberry Pi with a few ESP32 boards on a USB hub, which flashes every
project's prebuilt firmware, watches what each board prints, and reports the
results to esp32bench.dev. Projects that pass show "Lab tested" on their page,
with the date, the core version and the last lines the board printed.

What a pass means: the firmware from https://fw.esp32bench.dev boots on that
board and the sketch prints what it should. Most projects are tested on a bare
board, so a pass proves the firmware runs, not that a sensor works. Each
project's expectation (`src/data/lab-expect.ts`) says what it checks and what it
needs: `none` (a bare board), `wifi` (the lab's Wi-Fi, sent over USB) or `parts`
(a sensor or display wired to that board for a full check).

## Set up the Pi

Raspberry Pi OS (Bookworm or newer, Python 3.11+), the Pi on your Wi-Fi, boards
on a powered USB hub.

```sh
sudo apt install -y python3-venv git
mkdir -p ~/esp32-bench-lab && cd ~/esp32-bench-lab
# copy or clone the lab/ folder from the esp32-bench repository here
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
sudo usermod -aG dialout "$USER"   # then log out and back in
```

If `brltty` is installed it grabs CH340 boards: `sudo apt remove brltty`.

### Find the boards

Use the `/dev/serial/by-id/` names so a port does not move between boots:

```sh
ls -l /dev/serial/by-id/
```

Each entry names the USB bridge chip and its serial number. Put one entry per
board in `config.toml` with the board id the site uses: `esp32` (DevKitC),
`esp32s3`, `esp32c3`, `esp32s2`, `esp32c6`, `xiao-esp32c3`, `xiao-esp32s3`.
Two boards with identical USB chips and no serial number get the same by-id
name; plug such boards into different hub ports and use `/dev/serial/by-path/`
instead.

Boards with two USB ports (S3, C6): use the UART bridge port (the one labelled
UART or COM), not the chip's native USB port, so the auto-reset works and the
output does not vanish while the board restarts.

### The standard rig (optional)

A bare board proves the firmware boots. To check that sketches really talk to
their parts, wire three I2C breakouts to one ESP32 DevKit for good, on one bus:

| Part | Address | Wiring |
| --- | --- | --- |
| SSD1306 0.96" OLED (I2C, 4 pins) | 0x3C | VCC 3V3, GND, SDA GPIO 21, SCL GPIO 22 |
| BME280 breakout (not a BMP280) | 0x76 | the same four; SDO to GND (most boards do this already) |
| MPU-6050 breakout (GY-521) | 0x68 | the same four; AD0 to GND or left open |

A half-size breadboard holds all three. Every project on the site that uses
one of these parts uses GPIO 21 and 22 on the DevKit, so the rig gives each
one a full check: i2c-scan, oled, oled-pong, dice, ntp-clock, bme280-serial,
bme280-web, outdoor-weather, level-platform, joystick-turret and balance-bot.
Leave the DS3231 off: it answers at 0x68 like the MPU-6050. Nothing else needs
to come off for other projects; sketches that use GPIO 21 or 22 for something
else only drive the bus lines, which the breakouts treat as inputs.

Mark that board with `rig = "standard"` in `config.toml`. On it, projects with
a full check (`rig` in `src/data/lab-expect.ts`) use patterns that need the
parts: oled must print `Display ready`, where a bare board may print `SSD1306
not found` and still pass. The rest get the usual check. Project pages say which boards had the
full check.

### Configure

```sh
cp config.example.toml config.toml
chmod 600 config.toml
nano config.toml
```

Fill in the boards, your lab Wi-Fi under `[settings]`, and projects to skip. The Wi-Fi must be 2.4 GHz and reach the internet (the NTP clock fetches the time). Reports are public, and Wi-Fi sketches print the network name, so the runner replaces every `[settings]` value in the posted output: the network name becomes `your-network`, anything else `[hidden]`.

### The lab token

The runner posts results with a bearer token that only the API and this config
know. Make it on the Pi and set it on the API Worker; never paste it anywhere
else.

On the Pi:

```sh
TOKEN="$(openssl rand -base64 32)"
sed -i "s|^lab_token = .*|lab_token = \"$TOKEN\"|" config.toml
echo "$TOKEN" > lab-token.txt && chmod 600 lab-token.txt   # keep it for the next step
```

On the computer where you deploy the API (from the repository's `api/`
folder, signed in with `cf auth login`), with the token copied over, for
example on a USB stick or by `scp`:

```sh
printf '{"LAB_TOKEN":"%s"}' "$(cat lab-token.txt)" | cf deploy --secrets-file /dev/stdin
```

Deploys keep the secret afterwards. Delete `lab-token.txt` when done.

## Run it

```sh
. .venv/bin/activate
python3 runner.py --config config.toml --dry-run      # what would run
python3 runner.py --config config.toml --only blink   # one project, every board
python3 runner.py --config config.toml                # everything
```

A full run flashes each project on each board that supports it (about 10–60 s
per pair), then posts one report. `--board <label>` limits it to one board,
`--save run.json` keeps a copy of the report, Ctrl-C finishes the current board
and reports what was done. Firmware is cached in `~/.cache/esp32-bench-lab` and
only re-downloaded when it changes. The log goes to the terminal and to
`log_file` from the config.

Each result is one of:

- `passed`: every expected pattern appeared within the project's time window.
- `failed`: the board ran but something expected never appeared. The report
  keeps the last 60 lines so you can see what it printed instead.
- `flash_failed`: esptool could not write the board (cable, port, or a board
  that needs BOOT held). Not a sketch problem.
- `skipped`: a setting in the config had a tab or newline in it.

### Weekly runs

Firmware is rebuilt on Tuesday mornings, so run the lab on Tuesday evenings:

```ini
# ~/.config/systemd/user/esp32-bench-lab.service
[Unit]
Description=ESP32 Bench hardware lab run

[Service]
Type=oneshot
WorkingDirectory=%h/esp32-bench-lab
ExecStart=%h/esp32-bench-lab/.venv/bin/python3 runner.py --config config.toml

# ~/.config/systemd/user/esp32-bench-lab.timer
[Unit]
Description=Run the ESP32 Bench lab weekly

[Timer]
OnCalendar=Tue 19:00
Persistent=true

[Install]
WantedBy=timers.target
```

```sh
systemctl --user daemon-reload
systemctl --user enable --now esp32-bench-lab.timer
sudo loginctl enable-linger "$USER"     # so the timer runs without a login
systemctl --user list-timers
```

## What the site shows

- Each project page's Community builds section opens with the latest lab run:
  "Ran in the ESP32 Bench lab on <date> with core <x>: passed on ESP32-C3 and
  ESP32-S3, failed on ESP32", with the last 20 lines per board behind an
  expander, and a "Lab tested" tag in the page header when at least one board
  passed.
- `GET https://api.esp32bench.dev/lab/latest` summarises the latest run across
  all projects, with `check` (`full` or `boot`) per result.
- If no run comes in for 8 days, the API emails the owner (the `REPORT_TO`
  address), and again every 7 days until one does: a daily cron on the API
  Worker, `quietLabNotice` in `api/src/lab.ts`. It stays silent until the first
  run is ever posted.

Results are kept per run and the history stays in the database. Pages show the
newest result for each project and board, from whichever run had it, so a run
limited with `--only` or `--board` updates just those and leaves the rest.

## Tests

```sh
python3 -m unittest discover -s tests -v
```

They use a pseudo-terminal in place of a board, a fake esptool and a fake API.
