"""Image build step: one PlatformIO project per board, compiled once so every
toolchain, framework and library is installed and the framework objects are
cached. Then the packages we never use are removed to keep the image small."""
import json
import os
import shutil
import subprocess
import sys
import time

ROOT = "/opt/templates"
CORE = os.environ["PLATFORMIO_CORE_DIR"]
cfg = json.load(open("/opt/boards.json"))
# Library names to PlatformIO ids: a copy of the site's src/data/compile-libs.json.
cfg["libs"] = json.load(open("/opt/compile-libs.json"))["libs"]

BLINK = """void setup() { pinMode(2, OUTPUT); Serial.begin(115200); }
void loop() { digitalWrite(2, !digitalRead(2)); Serial.println("tick"); delay(500); }
"""


def ini(board, libs):
    # The config never changes after this, so PlatformIO keeps the framework and
    # library objects built here. Libraries are archives, so a sketch only links
    # the ones it uses. Env "huge" is the same build with the huge_app partition
    # table, warmed separately because a config change forces a full rebuild.
    common = [f"platform = {cfg['platform']}", "framework = arduino", f"board = {board['pio']}",
              "lib_deps ="] + [f"  {v}" for v in libs]
    return "\n".join(["[env:b]", *common, "", "[env:huge]", *common, "board_build.partitions = huge_app.csv", ""])


# Libraries that do not build on every chip; the warm build leaves them out there.
CHIP_SKIP = {"esp32c6": {"OneWire.h", "DallasTemperature.h"}}
SKIP_LIBS = {"OneWire.h": "OneWire", "DallasTemperature.h": "DallasTemperature"}


def warm_libs(chip):
    skip = {SKIP_LIBS[h] for h in CHIP_SKIP.get(chip, set())}
    return [v for k, v in cfg["libs"].items() if k not in skip]


def warm_sketch(chip, includes):
    text = "".join(f"#include <{i}>\n" for i in includes if i not in CHIP_SKIP.get(chip, set()))
    if chip != "esp32s2":  # the S2 has no Bluetooth
        text += "#include <BLEDevice.h>\n"
    return text + BLINK


def run(board_id, note, env="b"):
    t = time.time()
    r = subprocess.run(["pio", "run", "-d", f"{ROOT}/{board_id}", "-e", env], capture_output=True, text=True)
    print(f"[{board_id}] {note}: {'ok' if r.returncode == 0 else 'FAILED'} in {time.time() - t:.0f}s", flush=True)
    if r.returncode != 0:
        print(r.stdout[-4000:], r.stderr[-2000:], flush=True)
    return r.returncode == 0


for board_id, board in cfg["boards"].items():
    d = f"{ROOT}/{board_id}/src"
    os.makedirs(d, exist_ok=True)
    open(f"{ROOT}/{board_id}/platformio.ini", "w").write(ini(board, warm_libs(board["chip"])))
    open(f"{d}/main.ino", "w").write(warm_sketch(board["chip"], cfg["warm_includes"]))
    for env in ("b", "huge"):
        if not run(board_id, f"warm build with the libraries ({env})", env):
            sys.exit(f"{board_id}: cannot build with its libraries ({env})")
    # Leave a plain sketch so a request always starts from a known file.
    open(f"{d}/main.ino", "w").write(BLINK)

# Trim: chips we do not serve, multilibs the builds never link, debuggers, caches.
pk = f"{CORE}/packages"
rm = []
libs = f"{pk}/framework-arduinoespressif32-libs"
for name in os.listdir(libs):
    if os.path.isdir(f"{libs}/{name}") and name not in {"esp32", "esp32s2", "esp32s3", "esp32c3", "esp32c6"}:
        rm.append(f"{libs}/{name}")
rv = f"{pk}/toolchain-riscv32-esp"
keep_rv = {"rv32imc_zicsr_zifencei", "rv32imac_zicsr_zifencei"}  # C3 and C6
for base in [f"{rv}/riscv32-esp-elf/lib", f"{rv}/lib/gcc/riscv32-esp-elf/14.2.0"]:
    if os.path.isdir(base):
        for name in os.listdir(base):
            if name.startswith("rv32") and name not in keep_rv:
                rm.append(f"{base}/{name}")
rm += [f"{rv}/picolibc", f"{pk}/toolchain-xtensa-esp-elf/picolibc"]
for name in os.listdir(pk):
    if name.startswith(("tool-xtensa-esp-elf-gdb", "tool-riscv32-esp-elf-gdb", "contrib-piohome", "tool-openocd",
                        "tool-clang", "tool-cppcheck", "tool-cmake", "tool-ninja", "tool-esp-rom-elfs",
                        "tool-dfuutil", "toolchain-esp32ulp")):
        rm.append(f"{pk}/{name}")
# pioarduino's installer keeps a second copy of the toolchains and their archives.
rm += [f"{CORE}/dist", "/root/.cache", f"{CORE}/.cache"]
tools = f"{CORE}/tools"
if os.path.isdir(tools):
    for name in os.listdir(tools):
        if name.startswith(("toolchain-", "tool-xtensa-esp-elf-gdb", "tool-riscv32-esp-elf-gdb")):
            rm.append(f"{tools}/{name}")
freed = 0
for path in rm:
    if os.path.exists(path):
        size = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(path)
                   for f in fs if not os.path.islink(os.path.join(dp, f)))
        shutil.rmtree(path, ignore_errors=True)
        freed += size
        print(f"removed {path} ({size / 1e6:.0f} MB)", flush=True)
print(f"freed {freed / 1e9:.2f} GB", flush=True)

# Prove the trimmed toolchains still link, for every board.
for board_id in cfg["boards"]:
    for env in ("b", "huge"):
        open(f"{ROOT}/{board_id}/src/main.ino", "w").write(BLINK + "// after trim\n")
        if not run(board_id, f"rebuild after trim ({env})", env):
            sys.exit(f"{board_id}: build broken after trimming")
        open(f"{ROOT}/{board_id}/src/main.ino", "w").write(BLINK)
        run(board_id, f"restore ({env})", env)
