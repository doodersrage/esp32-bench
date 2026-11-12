// Host test for the sketches' "ESP32 Bench settings block": a fake Arduino
// (Serial, String, Preferences, ESP.restart) feeds the protocol lines through
// the real block (src/sketches/bench-settings.inc with keys filled in by run.sh).
#include <cassert>
#include <cstdarg>
#include <cstdio>
#include <cstring>
#include <map>
#include <string>

// ---- minimal Arduino look-alikes ----
struct String : std::string {
  String() {}
  String(const char* s) : std::string(s ? s : "") {}
  String(const std::string& s) : std::string(s) {}
  int indexOf(char c, unsigned from = 0) const {
    const size_t i = find(c, from);
    return i == npos ? -1 : (int)i;
  }
  String substring(unsigned a, unsigned b) const { return std::string(substr(a, b - a)); }
  String substring(unsigned a) const { return std::string(substr(a)); }
  bool operator==(const char* o) const { return std::string(*this) == o; }
  bool operator==(const String& o) const { return std::string(*this) == std::string(o); }
  bool operator!=(const char* o) const { return !(*this == o); }
};
struct FakeSerial {
  std::string in, out;
  int available() { return (int)in.size(); }
  int read() { const char c = in[0]; in.erase(0, 1); return (unsigned char)c; }
  void print(const char* s) { out += s; }
  void println(const char* s) { out += s; out += '\n'; }
  void println() { out += '\n'; }
  void printf(const char* f, ...) { char b[512]; va_list a; va_start(a, f); vsnprintf(b, sizeof b, f, a); va_end(a); out += b; }
  void flush() {}
} Serial;
static std::map<std::string, std::string> flash;  // the fake NVS
struct Preferences {
  void begin(const char*, bool) {}
  void end() {}
  bool isKey(const char* k) { return flash.count(k) > 0; }
  String getString(const char* k, const char* d) { return flash.count(k) ? String(flash[k]) : String(d); }
  void putString(const char* k, const String& v) { flash[k] = v; }
  void remove(const char* k) { flash.erase(k); }
};
static unsigned long fakeMillis = 0;
unsigned long millis() { return fakeMillis; }
void delay(unsigned long ms) { fakeMillis += ms; }
static int restarts = 0;
struct { void restart() { restarts++; } } ESP;

#include "block.inc"  // the settings block, with BENCH_KEYS = wifi_ssid, wifi_pass, share_url

static std::string drain() { std::string s = Serial.out; Serial.out.clear(); return s; }
static void feed(const char* text) { Serial.in += text; benchSettingsPoll(); }

int main() {
  // Nothing stored: defaults apply and the report says unset.
  assert(benchSetting("wifi_ssid", "your-wifi") == "your-wifi");
  benchSettingsReport();
  assert(drain() == "SETTINGS\twifi_ssid=unset\twifi_pass=unset\tshare_url=unset\n");

  // SET with spaces in the value, CRLF line endings, and a tab-free value echo (only the key comes back).
  feed("SET\twifi_ssid\tMy Home Network\r\n");
  assert(drain() == "OK\twifi_ssid\n");
  assert(benchSetting("wifi_ssid", "your-wifi") == "My Home Network");
  feed("SET\twifi_pass\t p4ss w0rd \n");
  assert(drain() == "OK\twifi_pass\n");
  assert(benchSetting("wifi_pass", "") == " p4ss w0rd ");
  assert(Serial.out.find("p4ss") == std::string::npos);

  // Empty value is allowed (SET with no third field).
  feed("SET\tshare_url\n");
  assert(drain() == "OK\tshare_url\n");
  assert(benchSetting("share_url", "x") == "");

  // Unknown key is refused; ordinary lines are ignored; partial lines wait for their newline.
  feed("SET\tevil\t1\n");
  assert(drain() == "ERR\tunknown key\tevil\n");
  feed("hello from a serial monitor\n");
  assert(drain().empty());
  feed("SETT");
  assert(drain().empty());
  feed("INGS?\n");
  assert(drain() == "SETTINGS\twifi_ssid=set\twifi_pass=set\tshare_url=set\n");

  // UNSET restores the default.
  feed("UNSET\tshare_url\n");
  assert(drain() == "OK\tshare_url\n");
  assert(benchSetting("share_url", "default") == "default");

  // A line longer than the buffer is cut, never crashing.
  Serial.in += "SET\twifi_ssid\t";
  Serial.in += std::string(600, 'x');
  Serial.in += "\n";
  benchSettingsPoll();
  assert(drain() == "OK\twifi_ssid\n");
  assert(benchSetting("wifi_ssid", "").size() < 300);

  // SAVE answers and restarts.
  feed("SAVE\n");
  assert(drain() == "SAVED\n");
  assert(restarts == 1);

  // The boot window: reports, announces, extends while commands arrive, then ends.
  fakeMillis = 1000;
  Serial.in = "SET\twifi_pass\tnew\n";
  benchSettingsBoot();
  const std::string boot = drain();
  assert(boot.rfind("SETTINGS\t", 0) == 0);
  assert(boot.find("SETUP\twaiting\n") != std::string::npos);
  assert(boot.find("OK\twifi_pass\n") != std::string::npos);
  assert(fakeMillis >= 1000 + 2500);

  // The hint for a placeholder or empty value.
  benchNeeds("Wi-Fi name", String("your-wifi"), "your-wifi", "WIFI_SSID");
  assert(drain() == "Wi-Fi name not set: use the settings form on the project page or edit WIFI_SSID in the sketch\n");
  benchNeeds("Wi-Fi name", String("Home"), "your-wifi", "WIFI_SSID");
  assert(drain().empty());
  benchNeeds("MQTT broker", String(""), "", "MQTT_HOST");
  assert(!drain().empty());

  puts("settings block (host): all checks pass");
  return 0;
}
