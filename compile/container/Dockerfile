# Arduino-ESP32 compile service: PlatformIO + pioarduino (Arduino core 3.x) with
# the toolchains, framework and the site's libraries installed and pre-built,
# serving POST /compile on port 8080. See ../README.md.
FROM python:3.12-slim-bookworm

ENV PLATFORMIO_CORE_DIR=/opt/esp \
    PLATFORMIO_SETTING_ENABLE_TELEMETRY=0 \
    PLATFORMIO_SETTING_CHECK_PLATFORMIO_INTERVAL=0 \
    PLATFORMIO_SETTING_CHECK_LIBRARIES_INTERVAL=0 \
    PLATFORMIO_SETTING_CHECK_PLATFORMS_INTERVAL=0 \
    PLATFORMIO_SETTING_CHECK_PRUNE_SYSTEM_THRESHOLD=0 \
    PLATFORMIO_DISABLE_PROGRESSBAR=true \
    PIP_NO_CACHE_DIR=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && pip install platformio==6.2.0 esptool==4.9.0

COPY boards.json compile-libs.json /opt/
COPY templates.py /opt/templates.py
# Install, warm-build every board and trim unused packages in one layer, so the
# removed files never land in the image.
RUN python3 /opt/templates.py && du -sh /opt/esp /opt/templates

# The container runs with no internet. pioarduino checks for internet when the
# platform loads unless PLATFORMIO_OFFLINE is set, and with no DNS answer that
# check hangs past the build limit. Interval 0 means "check every time", so the
# PlatformIO update checks are pushed out to a year.
ENV PLATFORMIO_OFFLINE=1 \
    PLATFORMIO_SETTING_CHECK_PLATFORMIO_INTERVAL=365 \
    PLATFORMIO_SETTING_CHECK_LIBRARIES_INTERVAL=365 \
    PLATFORMIO_SETTING_CHECK_PLATFORMS_INTERVAL=365

COPY server.py /opt/server.py
EXPOSE 8080
CMD ["python3", "/opt/server.py"]
