/**
 * Leak / moisture pads → ProbeHarbor push ingest (ESP32).
 *
 * Wet between pads pulls CONTACT_PIN low (with pull-up). POSTs leak1 true/false.
 * Flood/leak keys auto-alert when wet once alerts are enabled.
 * Set WIFI_SSID, WIFI_PASS, INGEST_URL. Keep the ESP32 dry and elevated.
 */
#if defined(ESP32) || defined(ESP8266)
#include <WiFi.h>
#include <HTTPClient.h>
#else
#error "leak_contact_ingest targets ESP32 / ESP8266."
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
#ifndef CONTACT_PIN
#define CONTACT_PIN 4
#endif

const unsigned long INTERVAL_MS = 60UL * 1000UL;
unsigned long lastPost = 0;
int lastSent = -1;

void setup() {
  Serial.begin(115200);
  pinMode(CONTACT_PIN, INPUT_PULLUP);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
  }
  Serial.println(" ok");
}

bool postLeak(bool wet) {
  if (WiFi.status() != WL_CONNECTED) return false;
  HTTPClient http;
  http.begin(INGEST_URL);
  http.addHeader("Content-Type", "application/json");
  char body[64];
  snprintf(body, sizeof(body), "{\"leak1\":%s}", wet ? "true" : "false");
  int code = http.POST(body);
  Serial.printf("POST %d %s\n", code, body);
  http.end();
  return code >= 200 && code < 300;
}

void loop() {
  bool wet = digitalRead(CONTACT_PIN) == LOW;
  unsigned long now = millis();
  bool due = (now - lastPost >= INTERVAL_MS);
  bool changed = (int)wet != lastSent;
  if (!due && !changed) return;
  lastPost = now;
  if (postLeak(wet)) lastSent = (int)wet;
}
