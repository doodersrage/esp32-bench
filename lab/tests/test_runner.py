"""Unit tests for the lab runner. Run from the lab/ directory:

    python3 -m unittest discover -s tests -v

No hardware: the serial port is a pty pair, esptool is a fake, and the API is a
fake that records what it was sent.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import runner as lab  # noqa: E402


MANIFEST = {
    "projects": {
        "blink": {"name": "Blink", "baud": 115200, "boards": ["esp32"], "chips": {"esp32": "esp32"},
                  "expect": {"patterns": ["tick \\d+ ms"], "seconds": 1, "needs": "none"}, "settings": []},
        "web-led": {"name": "Web LED", "baud": 115200, "boards": ["esp32", "esp32c3"], "chips": {"esp32": "esp32", "esp32c3": "esp32c3"},
                    "expect": {"patterns": ["Open http://\\d+"], "seconds": 1, "needs": "wifi", "settings": ["wifi_ssid", "wifi_pass"]},
                    "settings": ["wifi_ssid", "wifi_pass"]},
        "oled": {"name": "OLED", "baud": 115200, "boards": ["esp32c3"], "chips": {"esp32c3": "esp32c3"},
                 "expect": {"patterns": ["(Display ready|SSD1306 not found)"], "seconds": 1, "needs": "parts"}, "settings": []},
    }
}
INDEX = {"builtAt": "2026-11-12T07:00:00Z", "core": "3.3.12",
         "projects": {"blink": {"boards": ["esp32"]}, "web-led": {"boards": ["esp32", "esp32c3"]}, "oled": {"boards": []}}}
BOARDS = [lab.Board("devkit", "/dev/fake0", "esp32"), lab.Board("c3", "/dev/fake1", "esp32c3")]


class FakeHttp(lab.Http):
    def __init__(self):
        self.posted = []
        self.downloads = []

    def get_json(self, url):
        return MANIFEST if url.endswith("lab-manifest.json") else INDEX

    def download(self, url, dest):
        self.downloads.append(url)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(b"\xe9fake")
        return dest

    def post_json(self, url, body, token):
        self.posted.append((url, body, token))
        return 200, json.dumps({"ok": True, "run": 1})


class PureLogic(unittest.TestCase):
    def test_check_patterns(self):
        matched, missing = lab.check_patterns("boot\ntick 1000 ms\ntick 2000 ms\n", ["tick \\d+ ms", "never"])
        self.assertEqual(matched, ["tick \\d+ ms"])
        self.assertEqual(missing, ["never"])

    def test_check_patterns_multiline_anchor(self):
        matched, _ = lab.check_patterns("a\nDisplay ready\n", ["^Display ready$"])
        self.assertEqual(matched, ["^Display ready$"])

    def test_bad_regex_is_missing_not_crash(self):
        _, missing = lab.check_patterns("x", ["("])
        self.assertEqual(missing, ["("])

    def test_tail_lines(self):
        text = "\r\n".join(str(i) for i in range(100)) + "\r\n"
        self.assertEqual(lab.tail_lines(text, 3), "97\n98\n99")

    def test_settings_lines(self):
        lines = lab.settings_lines(["wifi_ssid", "wifi_pass", "share_url"], {"wifi_ssid": "lab net", "wifi_pass": "s3cret"})
        self.assertEqual(lines, ["SET\twifi_ssid\tlab net", "SET\twifi_pass\ts3cret", "SAVE"])
        self.assertEqual(lab.settings_lines(["wifi_ssid"], {}), [], "nothing to send, no SAVE")
        with self.assertRaises(ValueError):
            lab.settings_lines(["wifi_ssid"], {"wifi_ssid": "bad\tvalue"})

    def test_redact_hides_lab_settings_in_posted_output(self):
        settings = {"wifi_ssid": "Smith Home 2.4", "wifi_pass": "hunter22", "share_url": "https://probeharbor.dev/api/share/abc"}
        out = lab.redact("wifi joining Smith Home 2.4\nwifi ok 192.168.1.40\nposting to https://probeharbor.dev/api/share/abc\npw hunter22", settings)
        self.assertEqual(out, "wifi joining your-network\nwifi ok 192.168.1.40\nposting to [hidden]\npw [hidden]")
        self.assertEqual(lab.redact("tick", {"wifi_ssid": "ab"}), "tick", "values too short to hide are left alone")

    def test_plan_pairs_boards_with_built_projects(self):
        jobs = lab.plan(MANIFEST, INDEX, BOARDS, skip=[])
        self.assertEqual([(p, b.label) for p, b in jobs], [("blink", "devkit"), ("web-led", "devkit"), ("web-led", "c3")])
        self.assertEqual(lab.plan(MANIFEST, INDEX, BOARDS, skip=["web-led"]), [("blink", BOARDS[0])])
        self.assertEqual([(p, b.label) for p, b in lab.plan(MANIFEST, INDEX, BOARDS, [], only="web-led", board_label="c3")], [("web-led", "c3")])

    def test_build_report_times_are_utc_iso(self):
        t0 = dt.datetime(2026, 11, 12, 20, 0, tzinfo=dt.timezone.utc)
        r = lab.build_report("rig", t0, t0, INDEX, [lab.Result("blink", "esp32", "esp32", "passed", 1, ["x"], [], "out")])
        self.assertEqual(r["started_at"], "2026-11-12T20:00:00Z")
        self.assertEqual(r["core"], "3.3.12")
        self.assertEqual(r["results"][0]["status"], "passed")
        self.assertEqual(set(r["results"][0]), {"project", "board", "chip", "status", "seconds", "matched", "missing", "output"})


class FakeSerial:
    """A pyserial-like port that plays a script: lines to print, and a reply to SET/SAVE."""

    script: list[bytes] = []
    received: list[bytes] = []
    announce_setup = False

    def __init__(self, port, baud, timeout=0.2):
        self.port, self.baud, self.timeout = port, baud, timeout
        self._buf = b""
        self.dtr = self.rts = None
        self._started = time.monotonic()
        self._emitted = False

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def read(self, n):
        if not self._emitted:
            self._emitted = True
            self._buf += (b"SETUP\twaiting\n" if self.announce_setup else b"") + b"".join(self.script)
        if self._buf:
            chunk, self._buf = self._buf[:n], self._buf[n:]
            return chunk
        time.sleep(self.timeout)
        return b""

    def write(self, data):
        self.received.append(data)
        if data.startswith(b"SET\t"):
            self._buf += b"OK\t" + data.split(b"\t")[1] + b"\n"
        if data == b"SAVE\n":
            self._buf += b"SAVED\nOpen http://192.168.1.9\n"

    def flush(self):
        pass


class FakeSerialModule:
    Serial = FakeSerial


class CaptureWithPty(unittest.TestCase):
    def test_capture_reads_from_a_real_pty(self):
        import pty
        try:
            import serial  # noqa: F401
        except ModuleNotFoundError:
            self.skipTest("pyserial not installed")
        master, slave = pty.openpty()
        name = os.ttyname(slave)

        def writer():
            time.sleep(0.3)
            os.write(master, b"tick 1000 ms\r\ntick 2000 ms\r\n")

        threading.Thread(target=writer, daemon=True).start()
        text = lab.capture(name, 115200, 1.0, [])
        self.assertIn("tick 2000 ms", text)
        os.close(master)
        os.close(slave)


class RunnerFlow(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.http = FakeHttp()
        self.flashed = []
        self.config = lab.Config(api_url="https://api.example", lab_token="tok", firmware_url="https://fw.example",
                                 site_url="https://site.example", runner="rig", boards=BOARDS,
                                 settings={"wifi_ssid": "lab", "wifi_pass": "pw"}, skip=[], cache_dir=Path(self.tmp.name), log_file=None)

    def tearDown(self):
        self.tmp.cleanup()

    def fake_flash(self, port, chip, image, timeout=240):
        self.flashed.append((port, chip, image.name))
        return (port != "/dev/fake1" or chip != "esp32c3") or True, "ok"

    def test_full_run_posts_one_report(self):
        FakeSerial.script = [b"boot\n", b"tick 1000 ms\n"]
        FakeSerial.received = []
        FakeSerial.announce_setup = True

        def capturer(port, baud, seconds, setup):
            return lab.capture(port, baud, seconds, setup, serial_module=FakeSerialModule)

        r = lab.Runner(self.config, http=self.http, flasher=self.fake_flash, capturer=capturer)
        report = r.run()
        self.assertEqual(len(self.http.posted), 1)
        url, body, token = self.http.posted[0]
        self.assertEqual(url, "https://api.example/lab/runs")
        self.assertEqual(token, "tok")
        by = {(x["project"], x["board"]): x for x in body["results"]}
        self.assertEqual(by[("blink", "esp32")]["status"], "passed")
        # web-led got its settings sent (SET lines then SAVE) and then printed the address.
        self.assertIn(b"SET\twifi_ssid\tlab\n", FakeSerial.received)
        self.assertIn(b"SAVE\n", FakeSerial.received)
        self.assertEqual(by[("web-led", "esp32")]["status"], "passed")
        self.assertEqual(by[("web-led", "esp32c3")]["status"], "passed")
        self.assertEqual(sorted(self.http.downloads), sorted([
            "https://fw.example/blink/esp32.bin", "https://fw.example/web-led/esp32.bin", "https://fw.example/web-led/esp32c3.bin"]))
        self.assertTrue(report["posted"])
        self.assertEqual(report["core"], "3.3.12")

    def test_flash_failure_is_reported_as_such(self):
        def bad_flash(port, chip, image, timeout=240):
            return False, "A fatal error occurred: Failed to connect"

        r = lab.Runner(self.config, http=self.http, flasher=bad_flash, capturer=lambda *a: "")
        report = r.run(only="blink")
        self.assertEqual(report["results"][0]["status"], "flash_failed")
        self.assertIn("Failed to connect", report["results"][0]["output"])

    def test_missing_pattern_fails_with_output(self):
        r = lab.Runner(self.config, http=self.http, flasher=self.fake_flash, capturer=lambda *a: "boot\nnothing useful\n")
        report = r.run(only="blink")
        res = report["results"][0]
        self.assertEqual(res["status"], "failed")
        self.assertEqual(res["missing"], ["tick \\d+ ms"])
        self.assertEqual(res["output"], "boot\nnothing useful")

    def test_dry_run_flashes_and_posts_nothing(self):
        r = lab.Runner(self.config, http=self.http, flasher=self.fake_flash, capturer=lambda *a: "")
        report = r.run(dry_run=True)
        self.assertEqual(self.flashed, [])
        self.assertEqual(self.http.posted, [])
        self.assertEqual(report["results"], [])

    def test_stop_flag_ends_early_and_still_reports(self):
        r = lab.Runner(self.config, http=self.http, flasher=self.fake_flash, capturer=lambda *a: "tick 1 ms\nOpen http://1")
        calls = []

        def capturer(*a):
            calls.append(1)
            r.stop = True  # as the signal handler would
            return "tick 1 ms\nOpen http://1"

        r.capturer = capturer
        report = r.run()
        self.assertEqual(len(report["results"]), 1)
        self.assertEqual(len(self.http.posted), 1)


if __name__ == "__main__":
    unittest.main()
