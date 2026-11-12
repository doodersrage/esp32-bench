/**
 * DS18B20 → ProbeHarbor push ingest with WiFiManager (ESP32 / ESP8266).
 *
 * Libraries: OneWire, DallasTemperature, WiFiManager (tzapu).
 * Set INGEST_URL (Devices download or #define). First boot opens a captive portal
 * AP named "ProbeHarbor-Setup" — join it, enter home Wi‑Fi, reboot.
 *
 * USB Serial 115200 → expect POST 200 after Wi‑Fi is saved.
 */
#include <OneWire.h>
#include <DallasTemperature.h>
#include <WiFiManager.h>

#if defined(ESP32) || defined(ESP8266)
#include <WiFi.h>
#include <HTTPClient.h>
#else
#error "This sample targets ESP32/ESP8266."
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

  WiFiManager wifiManager;
  // wifiManager.resetSettings(); // uncomment once to clear saved credentials
  wifiManager.setConfigPortalTimeout(180);
  if (!wifiManager.autoConnect("ProbeHarbor-Setup")) {
    Serial.println("WiFi portal timed out — restarting");
    delay(2000);
    ESP.restart();
  }
  Serial.println("WiFi ok");
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
