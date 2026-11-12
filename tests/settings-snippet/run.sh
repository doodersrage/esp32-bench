#!/bin/sh
# Compiles the sketches' settings block on the host with fake Arduino pieces and
# runs the protocol through it. Needs g++.
set -e
here="$(cd "$(dirname "$0")" && pwd)"
out="${TMPDIR:-/tmp}/esp32-bench-settings-snippet"
mkdir -p "$out"
: > "$out/Preferences.h"  # the fake Preferences is in the harness
sed 's/%BENCH_KEYS%/"wifi_ssid", "wifi_pass", "share_url"/' "$here/../../src/sketches/bench-settings.inc" > "$out/block.inc"
g++ -std=c++17 -Wall -Wextra -Werror -I"$out" "$here/harness.cpp" -o "$out/harness"
"$out/harness"
