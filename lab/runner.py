#!/usr/bin/env python3
"""ESP32 Bench hardware lab runner.

Flashes every project's prebuilt firmware onto the boards plugged into this
computer, captures what each one prints over serial, checks it against the
project's expected patterns, and posts one run report to the ESP32 Bench API,
where passing projects show as lab-tested on their pages.

    python3 runner.py --config config.toml            # a full run
    python3 runner.py --config config.toml --dry-run  # plan only, no flashing
    python3 runner.py --config config.toml --only blink --board c3-devkit

Needs Python 3.11+ (tomllib), pyserial and esptool (see requirements.txt).
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import logging
import os
import re
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any

try:
    import tomllib
except ModuleNotFoundError:  # Python < 3.11
    print("Python 3.11 or newer is needed (for tomllib).", file=sys.stderr)
    raise

log = logging.getLogger("lab")

STATUS_PASSED = "passed"
STATUS_FAILED = "failed"
STATUS_FLASH_FAILED = "flash_failed"
STATUS_SKIPPED = "skipped"

OUTPUT_KEEP_LINES = 60
SETUP_WAIT_SECONDS = 6.0


# ---------------------------------------------------------------- data types
@dataclass
class Board:
    label: str
    port: str
    board: str  # board id on the site, e.g. "esp32c3"


@dataclass
class Result:
    project: str
    board: str
    chip: str
    status: str = STATUS_FAILED
    seconds: int = 0
    matched: list[str] = field(default_factory=list)
    missing: list[str] = field(default_factory=list)
    output: str = ""


@dataclass
class Config:
    api_url: str
    lab_token: str
    firmware_url: str
    site_url: str
    runner: str
    boards: list[Board]
    settings: dict[str, str]
    skip: list[str]
    cache_dir: Path
    log_file: Path | None

    @staticmethod
    def load(path: Path) -> "Config":
        with path.open("rb") as f:
            raw = tomllib.load(f)
        boards = [Board(label=b["label"], port=b["port"], board=b["board"]) for b in raw.get("boards", [])]
        return Config(
            api_url=raw.get("api_url", "https://api.esp32bench.dev").rstrip("/"),
            lab_token=raw.get("lab_token", ""),
            firmware_url=raw.get("firmware_url", "https://fw.esp32bench.dev").rstrip("/"),
            site_url=raw.get("site_url", "https://esp32bench.dev").rstrip("/"),
            runner=raw.get("runner", "lab"),
            boards=boards,
            settings={str(k): str(v) for k, v in raw.get("settings", {}).items()},
            skip=list(raw.get("skip", [])),
            cache_dir=Path(raw.get("cache_dir", "~/.cache/esp32-bench-lab")).expanduser(),
            log_file=Path(raw["log_file"]).expanduser() if raw.get("log_file") else None,
        )


# ---------------------------------------------------------------- pure logic
def check_patterns(output: str, patterns: list[str]) -> tuple[list[str], list[str]]:
    """Which patterns match the captured output (multiline), and which do not."""
    matched, missing = [], []
    for src in patterns:
        try:
            ok = re.search(src, output, re.MULTILINE) is not None
        except re.error:
            ok = False
        (matched if ok else missing).append(src)
    return matched, missing


def tail_lines(text: str, n: int = OUTPUT_KEEP_LINES) -> str:
    lines = text.replace("\r\n", "\n").replace("\r", "\n").rstrip("\n").split("\n")
    return "\n".join(lines[-n:])


# What a lab setting is shown as once hidden. Reports are public (project pages
# show the last lines each board printed), and Wi-Fi sketches print the network
# name, which can be looked up on public Wi-Fi maps.
HIDDEN_AS = {"wifi_ssid": "your-network"}


def redact(text: str, settings: dict[str, str]) -> str:
    """Hide every lab setting value (Wi-Fi name, password, URLs) in board output before it is posted."""
    # Longest first, so a value that contains another is hidden whole.
    for key, value in sorted(settings.items(), key=lambda kv: -len(kv[1])):
        if len(value) >= 3:
            text = text.replace(value, HIDDEN_AS.get(key, "[hidden]"))
    return text


def settings_lines(keys: list[str], available: dict[str, str]) -> list[str]:
    """SET lines for the settings this project asks for and the lab has; then SAVE.

    Values must not contain tabs or newlines (the protocol is tab-separated).
    Returns [] when the lab has none of the keys, so nothing is sent.
    """
    out = []
    for key in keys:
        value = available.get(key)
        if value is None or value == "":
            continue
        if "\t" in value or "\n" in value or "\r" in value:
            raise ValueError(f"setting {key} contains a tab or newline")
        out.append(f"SET\t{key}\t{value}")
    if out:
        out.append("SAVE")
    return out


def plan(manifest: dict[str, Any], index: dict[str, Any], boards: list[Board], skip: list[str],
         only: str | None = None, board_label: str | None = None) -> list[tuple[str, Board]]:
    """Every (project, board) pair this rig can test, in a stable order."""
    jobs: list[tuple[str, Board]] = []
    built = index.get("projects", {})
    for project_id in sorted(manifest.get("projects", {})):
        if only and project_id != only:
            continue
        if project_id in skip:
            continue
        info = manifest["projects"][project_id]
        built_boards = set(built.get(project_id, {}).get("boards", []))
        for board in boards:
            if board_label and board.label != board_label:
                continue
            if board.board in info.get("boards", []) and board.board in built_boards:
                jobs.append((project_id, board))
    return jobs


def build_report(runner: str, started: dt.datetime, finished: dt.datetime, index: dict[str, Any],
                 results: list[Result]) -> dict[str, Any]:
    return {
        "runner": runner,
        "started_at": started.astimezone(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "finished_at": finished.astimezone(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "core": str(index.get("core", "")),
        "firmware_built_at": str(index.get("builtAt", "")),
        "results": [asdict(r) for r in results],
    }


# ---------------------------------------------------------------- the world
class Http:
    """Small wrapper so tests can swap it out."""

    def get_json(self, url: str) -> dict[str, Any]:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "esp32-bench-lab"}), timeout=30) as r:
            return json.load(r)

    def download(self, url: str, dest: Path) -> Path:
        """Download to dest, reusing it when the server says it is unchanged (ETag)."""
        dest.parent.mkdir(parents=True, exist_ok=True)
        etag_file = dest.with_suffix(dest.suffix + ".etag")
        headers = {"User-Agent": "esp32-bench-lab"}
        if dest.exists() and etag_file.exists():
            headers["If-None-Match"] = etag_file.read_text().strip()
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                data = r.read()
                etag = r.headers.get("ETag", "")
        except urllib.error.HTTPError as e:
            if e.code == 304 and dest.exists():
                return dest
            raise
        dest.write_bytes(data)
        if etag:
            etag_file.write_text(etag)
        return dest

    def post_json(self, url: str, body: dict[str, Any], token: str) -> tuple[int, str]:
        data = json.dumps(body).encode()
        req = urllib.request.Request(url, data=data, method="POST", headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
            "User-Agent": "esp32-bench-lab",
        })
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.status, r.read().decode(errors="replace")
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode(errors="replace")


def flash(port: str, chip: str, image: Path, timeout: int = 240) -> tuple[bool, str]:
    """Write a merged image at offset 0 with esptool. Returns (ok, output)."""
    cmd = [sys.executable, "-m", "esptool", "--chip", chip, "--port", port, "--baud", "460800",
           "--before", "default_reset", "--after", "hard_reset", "write_flash", "0x0", str(image)]
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return False, "esptool timed out"
    return p.returncode == 0, (p.stdout + p.stderr)[-4000:]


def capture(port: str, baud: int, seconds: float, setup_lines: list[str], serial_module=None) -> str:
    """Open the port, reset the board, optionally send settings, then read for `seconds`."""
    if serial_module is None:
        import serial as serial_module  # pyserial
    out = bytearray()
    deadline = time.monotonic() + seconds
    with serial_module.Serial(port, baud, timeout=0.2) as ser:
        # Reset through the auto-reset circuit: EN low while IO0 stays high.
        # (esptool's hard_reset after flashing already restarted the board; this
        # makes the capture start from a fresh boot in every case.)
        try:
            ser.dtr = False
            ser.rts = True
            time.sleep(0.1)
            ser.rts = False
            ser.dtr = False
        except OSError:
            log.warning("%s: no DTR/RTS control; relying on the reset after flashing", port)
        if setup_lines:
            # Wait for the firmware's settings window (it announces SETUP\twaiting
            # or prints its SETTINGS line), then send the lines.
            window = time.monotonic() + SETUP_WAIT_SECONDS
            while time.monotonic() < window:
                chunk = ser.read(256)
                if chunk:
                    out += chunk
                    if b"SETUP\twaiting" in out or b"SETTINGS\t" in out:
                        break
            for line in setup_lines:
                ser.write((line + "\n").encode())
                ser.flush()
                time.sleep(0.05)
                out += ser.read(512)
            # SAVE restarts the board; the capture window starts fresh after it.
            deadline = time.monotonic() + seconds
        while time.monotonic() < deadline:
            chunk = ser.read(512)
            if chunk:
                out += chunk
    return out.decode("utf-8", errors="replace")


# ---------------------------------------------------------------- the run
class Runner:
    def __init__(self, config: Config, http: Http | None = None, flasher=flash, capturer=capture):
        self.config = config
        self.http = http or Http()
        self.flasher = flasher
        self.capturer = capturer
        self.stop = False

    def fetch_inputs(self) -> tuple[dict[str, Any], dict[str, Any]]:
        manifest = self.http.get_json(f"{self.config.site_url}/lab-manifest.json")
        index = self.http.get_json(f"{self.config.firmware_url}/index.json")
        return manifest, index

    def image_for(self, project: str, board: str) -> Path:
        url = f"{self.config.firmware_url}/{project}/{board}.bin"
        dest = self.config.cache_dir / project / f"{board}.bin"
        return self.http.download(url, dest)

    def run_one(self, project: str, board: Board, info: dict[str, Any]) -> Result:
        chip = info.get("chips", {}).get(board.board, board.board)
        expect = info.get("expect") or {}
        patterns = list(expect.get("patterns", []))
        seconds = int(expect.get("seconds", 10))
        result = Result(project=project, board=board.board, chip=chip)
        try:
            image = self.image_for(project, board.board)
        except Exception as e:  # noqa: BLE001
            result.status = STATUS_FLASH_FAILED
            result.output = f"download failed: {e}"
            return result
        ok, flash_out = self.flasher(board.port, chip, image)
        if not ok:
            # A board that was just plugged in, or left in a bad state by the
            # last project, often fails the first connection: try once more.
            log.info("  flash failed, trying once more")
            time.sleep(2)
            ok, flash_out = self.flasher(board.port, chip, image)
        if not ok:
            result.status = STATUS_FLASH_FAILED
            result.output = tail_lines(flash_out)
            return result
        try:
            setup = settings_lines(list(info.get("settings", [])), self.config.settings)
        except ValueError as e:
            result.status = STATUS_SKIPPED
            result.output = str(e)
            return result
        started = time.monotonic()
        try:
            text = self.capturer(board.port, int(info.get("baud", 115200)), seconds, setup)
        except Exception as e:  # noqa: BLE001
            result.status = STATUS_FAILED
            result.output = redact(f"serial capture failed: {e}", self.config.settings)
            result.missing = patterns
            return result
        result.seconds = int(round(time.monotonic() - started))
        result.matched, result.missing = check_patterns(text, patterns)
        result.status = STATUS_PASSED if not result.missing and patterns else STATUS_FAILED
        result.output = tail_lines(redact(text, self.config.settings))
        return result

    def run(self, only: str | None = None, board_label: str | None = None, dry_run: bool = False) -> dict[str, Any]:
        started = dt.datetime.now(dt.timezone.utc)
        manifest, index = self.fetch_inputs()
        jobs = plan(manifest, index, self.config.boards, self.config.skip, only, board_label)
        log.info("firmware built %s with core %s; %d jobs on %d boards", index.get("builtAt"), index.get("core"), len(jobs), len(self.config.boards))
        results: list[Result] = []
        for project, board in jobs:
            if self.stop:
                log.warning("stopping early; %d of %d done", len(results), len(jobs))
                break
            info = manifest["projects"][project]
            if dry_run:
                log.info("would flash %s onto %s (%s) and watch %ss", project, board.label, board.board, (info.get("expect") or {}).get("seconds"))
                continue
            log.info("%s on %s (%s)", project, board.label, board.board)
            r = self.run_one(project, board, info)
            results.append(r)
            log.info("  %s%s", r.status, f", missing {r.missing}" if r.missing else "")
        finished = dt.datetime.now(dt.timezone.utc)
        report = build_report(self.config.runner, started, finished, index, results)
        if dry_run or not results:
            return report
        status, body = self.http.post_json(f"{self.config.api_url}/lab/runs", report, self.config.lab_token)
        if status != 200:
            log.error("report not accepted: HTTP %s %s", status, body[:300])
            report["posted"] = False
        else:
            log.info("report posted: %s", body[:200])
            report["posted"] = True
        return report


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", default="config.toml", help="path to the TOML config")
    ap.add_argument("--only", help="run one project id only")
    ap.add_argument("--board", help="run on one board label only")
    ap.add_argument("--dry-run", action="store_true", help="list the jobs, flash nothing, post nothing")
    ap.add_argument("--save", help="also write the report JSON to this file")
    args = ap.parse_args(argv)

    config = Config.load(Path(args.config))
    handlers: list[logging.Handler] = [logging.StreamHandler()]
    if config.log_file:
        config.log_file.parent.mkdir(parents=True, exist_ok=True)
        handlers.append(logging.FileHandler(config.log_file))
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", handlers=handlers)

    if not config.boards:
        log.error("no boards in the config")
        return 2
    if not args.dry_run and not config.lab_token:
        log.error("lab_token is empty; set it in the config (see README)")
        return 2

    runner = Runner(config)

    def on_signal(_sig, _frame):
        log.warning("interrupted; finishing the current board, then reporting what is done")
        runner.stop = True

    signal.signal(signal.SIGINT, on_signal)
    signal.signal(signal.SIGTERM, on_signal)

    report = runner.run(only=args.only, board_label=args.board, dry_run=args.dry_run)
    if args.save:
        Path(args.save).write_text(json.dumps(report, indent=1))
    passed = sum(1 for r in report["results"] if r["status"] == STATUS_PASSED)
    log.info("done: %d passed of %d", passed, len(report["results"]))
    return 0 if report.get("posted", True) else 1


if __name__ == "__main__":
    sys.exit(main())
