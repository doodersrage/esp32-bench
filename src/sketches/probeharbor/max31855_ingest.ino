/**
 * MAX31855 thermocouple → ProbeHarbor push ingest (Arduino: ESP32 / ESP8266 / Pico W).
 *
 * Library: Adafruit MAX31855.
 * Wire CS / SCK / MISO to your board; set pins below.
 * Pico W: Earle Philhower Raspberry Pi Pico/RP2040 board package.
 */
#include <SPI.h>
#include <Adafruit_MAX31855.h>

#if defined(ESP32) || defined(ESP8266) || defined(ARDUINO_ARCH_RP2040) || defined(ARDUINO_ARCH_RP2350)
#include <WiFi.h>
#include <HTTPClient.h>
#else
#error "This sample targets ESP32/ESP8266 or Pico W (Earle Philhower core). Adapt WiFi/HTTP for your board."
#endif

#ifndef WIFI_SSID
#define WIFI_SSID "your-wifi"
#endif
#ifndef WIFI_PASS
#define WIFI_PASS "your-password"
#endif
#ifndef INGEST_URL
#define INGEST_URL "https://probeharbor.dev/api/ingest/YOUR_DEVICE_KEY"
#endif

#ifndef MAX_CS
#define MAX_CS 5
#endif
#ifndef MAX_SCK
#define MAX_SCK 18
#endif
#ifndef MAX_MISO
#define MAX_MISO 19
#endif

Adafruit_MAX31855 thermocouple(MAX_SCK, MAX_CS, MAX_MISO);

const unsigned long INTERVAL_MS = 60UL * 1000UL;
unsigned long lastPost = 0;

void setup() {
  Serial.begin(115200);
  delay(500);
  if (!thermocouple.begin()) {
    Serial.println("MAX31855 not found");
  }
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
  }
  Serial.println(" WiFi ok");
}

bool postTempF(float tempF) {
  HTTPClient http;
  http.begin(INGEST_URL);
  http.addHeader("Content-Type", "application/json");
  char body[160];
  snprintf(
    body,
    sizeof(body),
    "{\"sensors\":[{\"key\":\"tc1\",\"kind\":\"temperature\",\"value\":%.2f,\"unit\":\"F\"}],\"rssi\":%d}",
    tempF,
    WiFi.RSSI()
  );
  int code = http.POST(body);
  Serial.printf("POST %d\n", code);
  http.end();
  return code >= 200 && code < 300;
}

void loop() {
  unsigned long now = millis();
  if (now - lastPost < INTERVAL_MS) return;
  lastPost = now;

  double c = thermocouple.readCelsius();
  if (isnan(c)) {
    Serial.println("Thermocouple fault");
    return;
  }
  postTempF((float)(c * 9.0 / 5.0 + 32.0));
}
