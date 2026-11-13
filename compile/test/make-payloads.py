"""Builds JSON request bodies for trying the compile service by hand.

    python3 test/make-payloads.py <sketch-root> <out-dir>

<sketch-root> is a directory of PlatformIO projects named <project>@<board>
(as scripts/check-sketches.mjs writes them); <out-dir> receives one JSON per case.
"""
import json
import os
import sys

root, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
cases = {
    "blink-esp32": ("esp32", "blink@esp32", [], None),
    "dht22-c3": ("esp32c3", "dht22@esp32c3", ["DHT sensor library (Adafruit)", "Adafruit Unified Sensor"], None),
    "oled-s3": ("esp32s3", "oled@esp32s3", ["Adafruit SSD1306", "Adafruit GFX Library"], None),
    "i2c-s2": ("esp32s2", "i2c-scan@esp32s2", [], None),
    "ble-c6": ("esp32c6", "ble-scan@esp32c6", [], "huge_app"),
}
for name, (board, folder, libs, partitions) in cases.items():
    for base in (root, os.path.join(os.path.dirname(root), "boards-agent")):
        path = os.path.join(base, folder, "src", "main.ino")
        if os.path.exists(path):
            break
    else:
        print(f"skip {name}: no sketch at {folder}")
        continue
    body = {"board": board, "code": open(path).read(), "libs": libs}
    if partitions:
        body["partitions"] = partitions
    json.dump(body, open(os.path.join(out, f"{name}.json"), "w"))
    print(f"{name}: {len(body['code'])} chars")

blink = open(os.path.join(root, "blink@esp32", "src", "main.ino")).read()
broken = blink.replace("void loop() {", 'void loop() {\n  undefinedThing(42);\n  int y = "text";', 1)
json.dump({"board": "esp32", "code": broken, "libs": []}, open(os.path.join(out, "broken-esp32.json"), "w"))
print("broken-esp32: written")
