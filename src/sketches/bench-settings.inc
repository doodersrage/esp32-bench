// ---- ESP32 Bench settings block: the same text in every project, only BENCH_KEYS differs ----
// Settings live in flash (Preferences "bench"), sent over USB by the project page's settings form;
// the constants above are the defaults, so the sketch also works pasted into the Arduino IDE.
// Serial lines (tab-separated): SETTINGS?  SET<tab>key<tab>value  UNSET<tab>key  SAVE (restarts).
#include <Preferences.h>
const char* BENCH_KEYS[] = {%BENCH_KEYS%};
String benchSetting(const char* key, const char* fallback) {
  Preferences p;
  p.begin("bench", true);
  String v = p.isKey(key) ? p.getString(key, fallback) : String(fallback);
  p.end();
  return v;
}
void benchSettingsReport() {  // which keys are stored; values are never printed
  Preferences p;
  p.begin("bench", true);
  Serial.print("SETTINGS");
  for (const char* k : BENCH_KEYS) Serial.printf("\t%s=%s", k, p.isKey(k) ? "set" : "unset");
  Serial.println();
  p.end();
}
bool benchSettingsLine(const String& line) {  // true when the line was a settings command
  const int t1 = line.indexOf('\t'), t2 = t1 < 0 ? -1 : line.indexOf('\t', t1 + 1);
  const String cmd = t1 < 0 ? line : line.substring(0, t1);
  const String key = t1 < 0 ? String() : line.substring(t1 + 1, t2 < 0 ? line.length() : t2);
  if (cmd == "SETTINGS?") { benchSettingsReport(); return true; }
  if (cmd == "SAVE") { Serial.println("SAVED"); Serial.flush(); delay(100); ESP.restart(); return true; }
  if (cmd != "SET" && cmd != "UNSET") return false;
  bool known = false;
  for (const char* k : BENCH_KEYS) known |= key == k;
  if (!known) { Serial.printf("ERR\tunknown key\t%s\n", key.c_str()); return true; }
  Preferences p;
  p.begin("bench", false);
  if (cmd == "SET") p.putString(key.c_str(), t2 < 0 ? String() : line.substring(t2 + 1)); else p.remove(key.c_str());
  p.end();
  Serial.printf("OK\t%s\n", key.c_str());
  return true;
}
bool benchSettingsPoll() {  // call from loop(); true when a command arrived
  static String line;
  bool got = false;
  while (Serial.available()) {
    const char c = (char)Serial.read();
    if (c == '\n') { got |= benchSettingsLine(line); line = ""; }
    else if (c != '\r' && line.length() < 300) line += c;
  }
  return got;
}
void benchSettingsBoot() {  // a 2.5 s window after reset, so the page can send settings before Wi-Fi starts
  benchSettingsReport();
  unsigned long deadline = millis() + 2500, announce = millis();
  while ((long)(deadline - millis()) > 0) {
    if ((long)(announce - millis()) <= 0) { Serial.println("SETUP\twaiting"); announce = millis() + 1000; }
    if (benchSettingsPoll()) deadline = millis() + 2500;
    delay(10);
  }
}
void benchNeeds(const char* what, const String& value, const char* placeholder, const char* constant) {
  if (value.length() == 0 || value == placeholder)
    Serial.printf("%s not set: use the settings form on the project page or edit %s in the sketch\n", what, constant);
}
// ---- end of the settings block ----
