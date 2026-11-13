"""Posts every payload in a directory to the compile server on localhost:8080,
from inside the container (so it can run with no network), and checks the
merged images. Used to measure build times per instance size.

    docker run --rm --network none --cpus=0.5 -v <payloads>:/payloads:ro -v <this dir>:/t:ro \
      esp32-bench-compiler:local sh -c 'python3 /opt/server.py & python3 /t/in-container.py /payloads'
"""
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request

BOOT = {"esp32": 0x1000, "esp32s2": 0x1000, "esp32s3": 0, "esp32c3": 0, "esp32c6": 0}
d = sys.argv[1]
for _ in range(60):
    try:
        urllib.request.urlopen("http://127.0.0.1:8080/health", timeout=2)
        break
    except Exception:
        time.sleep(0.5)

failed = 0
for name in sorted(os.listdir(d)) * 2:
    if not name.endswith(".json"):
        continue
    body = open(os.path.join(d, name), "rb").read()
    req = urllib.request.Request("http://127.0.0.1:8080/compile", data=body, headers={"Content-Type": "application/json"})
    t = time.time()
    try:
        out = json.load(urllib.request.urlopen(req, timeout=300))
    except urllib.error.HTTPError as e:
        out = json.load(e)
    wall = time.time() - t
    expect_fail = name.startswith("broken")
    if out.get("ok"):
        img = base64.b64decode(out["image_b64"])
        good = img[BOOT[out["chip"]]] == 0xE9 and img[0x10000] == 0xE9 and len(img) == out["image_bytes"]
        verdict = f"image {len(img)} B {'ok' if good else 'BAD'}"
        failed += (not good) or expect_fail
    else:
        err = [l for l in out.get("log", "").splitlines() if "error:" in l][:1]
        verdict = f"failed: {err[0].strip() if err else out.get('error', '')}"[:110]
        failed += not expect_fail
    print(f"{name:18} {wall:5.1f}s (build {out.get('seconds')}s) {verdict}", flush=True)
sys.exit(1 if failed else 0)
