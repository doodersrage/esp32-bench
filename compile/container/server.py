"""Compile server inside the container. One build at a time.

POST /compile  {board, code, libs?: [site library names], partitions?: "huge_app"}
  -> {ok, seconds, core, board, chip, exit_code, log, image_b64?, image_bytes?, bootloader_offset?}
GET  /health   -> {ok, core, warm, boards, busy}
"""
import base64
import json
import os
import re
import signal
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = "/opt/templates"
CORE = os.environ["PLATFORMIO_CORE_DIR"]
cfg = json.load(open("/opt/boards.json"))
# Library names to PlatformIO ids: a copy of the site's src/data/compile-libs.json.
cfg["libs"] = json.load(open("/opt/compile-libs.json"))["libs"]
LOCK = threading.Lock()
TIMEOUT = 120
LOG_TAIL = 60_000
core_version = ""


def resources():
    """What the container actually got: CPU quota, cores, memory and free disk."""
    def read(path):
        try:
            return open(path).read().strip()
        except OSError:
            return ""
    quota = read("/sys/fs/cgroup/cpu.max")
    mem = next((l.split()[1] for l in read("/proc/meminfo").splitlines() if l.startswith("MemTotal")), "")
    st = os.statvfs("/opt")
    return {"cpu_max": quota, "nproc": os.cpu_count(), "mem_total_kb": int(mem or 0),
            "disk_free_gb": round(st.f_bavail * st.f_frsize / 1e9, 1), "load": os.getloadavg()[0]}


def detect_core():
    try:
        return json.load(open(f"{CORE}/packages/framework-arduinoespressif32/package.json"))["version"]
    except Exception:
        return ""


def compile_sketch(req):
    board_id = req.get("board")
    board = cfg["boards"].get(board_id)
    if not board:
        return 400, {"ok": False, "error": f"Unknown board {board_id!r}."}
    code = req.get("code")
    if not isinstance(code, str) or not code.strip():
        return 400, {"ok": False, "error": "Send the sketch as `code`."}
    if len(code.encode()) > 150_000:
        return 413, {"ok": False, "error": "The sketch is too long (150 KB max)."}
    wanted = [str(l) for l in req.get("libs") or [] if not re.search(r"built in", str(l), re.I)]
    unknown = [l for l in wanted if l not in cfg["libs"]]
    if unknown:
        return 400, {"ok": False, "error": f"Unknown library: {', '.join(unknown)}. The compile service only has the libraries the site's projects use."}
    huge = req.get("partitions") == "huge_app"

    with LOCK:
        # The template's config is never rewritten, so the cached framework and
        # library objects stay valid; huge_app has its own pre-built env.
        d = f"{ROOT}/{board_id}"
        env = "huge" if huge else "b"
        build = f"{d}/.pio/build/{env}"
        open(f"{d}/src/main.ino", "w").write(code)
        for stale in ("firmware.bin", "firmware.elf", "firmware.factory.bin"):
            try:
                os.remove(f"{build}/{stale}")
            except FileNotFoundError:
                pass
        t = time.time()
        proc = subprocess.Popen(["pio", "run", "-d", d, "-e", env], stdout=subprocess.PIPE,
                                stderr=subprocess.STDOUT, text=True, start_new_session=True)
        try:
            log, _ = proc.communicate(timeout=TIMEOUT)
            rc = proc.returncode
        except subprocess.TimeoutExpired:
            os.killpg(proc.pid, signal.SIGKILL)
            log, _ = proc.communicate()
            log += f"\n*** Build stopped after {TIMEOUT} seconds."
            rc = -9
        seconds = round(time.time() - t, 1)
        # Never leave a visitor's sketch in the template.
        open(f"{d}/src/main.ino", "w").write("void setup() {}\nvoid loop() {}\n")

        out = {"ok": rc == 0, "seconds": seconds, "core": core_version, "board": board_id, "chip": board["chip"],
               "exit_code": rc, "log": log[-LOG_TAIL:]}
        if rc == 0:
            merged = f"{build}/merged.bin"
            boot_app0 = f"{CORE}/packages/framework-arduinoespressif32/tools/partitions/boot_app0.bin"
            m = subprocess.run(["python3", "-m", "esptool", "--chip", board["chip"], "merge_bin", "-o", merged,
                                board["bootloader"], f"{build}/bootloader.bin", "0x8000", f"{build}/partitions.bin",
                                "0xe000", boot_app0, "0x10000", f"{build}/firmware.bin"],
                               capture_output=True, text=True)
            if m.returncode != 0:
                out["ok"] = False
                out["log"] += "\n*** merge failed:\n" + m.stdout[-2000:] + m.stderr[-2000:]
            else:
                data = open(merged, "rb").read()
                out["image_b64"] = base64.b64encode(data).decode()
                out["image_bytes"] = len(data)
                out["bootloader_offset"] = 0
                os.remove(merged)
        return 200, out


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        print(f"{self.command} {self.path} {args[1] if len(args) > 1 else ''}", flush=True)

    def send_json(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path in ("/health", "/"):
            self.send_json(200, {"ok": True, "core": core_version, "warm": True,
                                 "boards": list(cfg["boards"]), "busy": LOCK.locked(), "resources": resources()})
        else:
            self.send_json(404, {"ok": False, "error": "Not found."})

    def do_POST(self):
        if self.path != "/compile":
            return self.send_json(404, {"ok": False, "error": "Not found."})
        length = int(self.headers.get("Content-Length") or 0)
        if length > 400_000:
            return self.send_json(413, {"ok": False, "error": "Request too large."})
        try:
            req = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            return self.send_json(400, {"ok": False, "error": "Send JSON."})
        status, body = compile_sketch(req)
        self.send_json(status, body)


def fail_fast_dns():
    """There is no internet here, and unanswered DNS queries make anything that
    still looks a name up wait for its timeouts. Point the resolver at localhost,
    where nothing listens, so such lookups fail at once."""
    try:
        open("/etc/resolv.conf", "w").write("nameserver 127.0.0.1\noptions timeout:1 attempts:1\n")
    except OSError as e:
        print(f"could not rewrite resolv.conf: {e}", flush=True)


if __name__ == "__main__":
    fail_fast_dns()
    core_version = detect_core()
    print(f"compile server ready, core {core_version}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
