/**
 * DS18B20 → ProbeHarbor push ingest (Arduino: ESP32 / ESP8266 / Pico W).
 *
 * Libraries: OneWire, DallasTemperature, WiFi, HTTPClient.
 * Pico W / Pico 2 W: install Earle Philhower’s “Raspberry Pi Pico/RP2040” board package
 * (not the Arduino mbed RP2040 core). GPIO4 is GP4.
 * Set WIFI_SSID, WIFI_PASS, and INGEST_URL (full URL including device key).
 */
#include <OneWire.h>
#include <DallasTemperature.h>

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

#ifndef ONE_WIRE_PIN
#define ONE_WIRE_PIN 4
#endif

OneWire oneWire(ONE_WIRE_PIN);
DallasTemperature sensors(&oneWire);

const unsigned long INTERVAL_MS = 60UL * 1000UL;
unsigned long lastPost = 0;

void setup() {
  Serial.begin(115200);
  sensors.begin();
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
  }
  Serial.println(" ok");
}

bool postTempF(float tempF) {
  if (WiFi.status() != WL_CONNECTED) return false;
  HTTPClient http;
  http.begin(INGEST_URL);
  http.addHeader("Content-Type", "application/json");
  char body[128];
  snprintf(body, sizeof(body), "{\"temp1\":%.2f,\"rssi\":%d}", tempF, WiFi.RSSI());
  int code = http.POST(body);
  Serial.printf("POST %d %s\n", code, body);
  http.end();
  return code >= 200 && code < 300;
}

void loop() {
  unsigned long now = millis();
  if (now - lastPost < INTERVAL_MS) return;
  lastPost = now;

  sensors.requestTemperatures();
  float c = sensors.getTempCByIndex(0);
  if (c == DEVICE_DISCONNECTED_C) {
    Serial.println("DS18B20 disconnected");
    return;
  }
  float f = c * 9.0f / 5.0f + 32.0f;
  postTempF(f);
}
