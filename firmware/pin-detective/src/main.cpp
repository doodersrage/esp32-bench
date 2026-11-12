/*
 * Pin detective.
 *
 * Puts a pull-up on every header GPIO that is safe to read, then reports each
 * one that is pulled low. Touch a jumper from GND to a pad and the Detective
 * page lights that pad up, which shows whether the silkscreen tells the truth.
 * It also reports the chip's identity for the board passport.
 *
 * Supported chips: ESP32, ESP32-S2, ESP32-S3, ESP32-C3 and ESP32-C6.
 *
 * Serial protocol, 115200 baud, one line each:
 *   PD hello board=esp32s3 fw=0.1.0
 *   PD id chip=ESP32-S3 rev=2 cores=2 mhz=240 flash=8388608 psram=0 mac=AA:BB:CC:DD:EE:FF sdk=v4.4.7
 *   PD pins 0,1,2,...        GPIOs being watched
 *   PD low 0,15              GPIOs already low at start ("-" for none)
 *   PD 4 0                   GPIO 4 went low
 *   PD 4 1                   GPIO 4 went high again
 * Send "PD?" to get the hello, id, pins and low lines again.
 */
#include <Arduino.h>
#include <esp_flash.h>
#include <esp_idf_version.h>

#define FIRMWARE_VERSION "0.1.0"

/*
 * A board may be plugged in by a UART bridge or by the chip's own USB port, so
 * talk on both where the chip has native USB. This is the approach ProbeHarbor's
 * probe firmware uses.
 *
 * ESP32-S3 and ESP32-C3 (core 2.0.x, USB CDC on boot off): Serial is UART0 and
 * USBSerial is the USB serial/JTAG port.
 * ESP32-S2 and ESP32-C6 (core 3.x, USB CDC on boot on): Serial is the native USB
 * port and Serial0 is UART0.
 */
#if defined(ARDUINO_USB_CDC_ON_BOOT) && ARDUINO_USB_CDC_ON_BOOT
#define CONSOLE_A Serial0
#define CONSOLE_B Serial
#define CONSOLE_DUAL 1
#elif defined(ARDUINO_USB_MODE) && ARDUINO_USB_MODE
#define CONSOLE_A Serial
#define CONSOLE_B USBSerial
#define CONSOLE_DUAL 1
#endif

#if CONSOLE_DUAL
class DualConsole : public Stream {
 public:
  void begin(unsigned long baud) {
    CONSOLE_A.begin(baud);
    CONSOLE_B.begin();
  }
  int available() override { return CONSOLE_A.available() + CONSOLE_B.available(); }
  int read() override { return CONSOLE_A.available() > 0 ? CONSOLE_A.read() : CONSOLE_B.read(); }
  int peek() override { return CONSOLE_A.available() > 0 ? CONSOLE_A.peek() : CONSOLE_B.peek(); }
  void flush() override {
    CONSOLE_A.flush();
    CONSOLE_B.flush();
  }
  size_t write(uint8_t c) override { return write(&c, 1); }
  size_t write(const uint8_t *buffer, size_t size) override {
    CONSOLE_A.write(buffer, size);
    CONSOLE_B.write(buffer, size);
    return size;
  }
  using Print::write;
};
static DualConsole Console;
#else
#define Console Serial
#endif

/*
 * Header GPIOs that are safe to read with a pull-up. Left out on purpose:
 * flash and PSRAM pins, the serial console pins, the native USB data pins, and
 * the classic ESP32's input-only pins, which have no pull-ups and would float.
 */
#if CONFIG_IDF_TARGET_ESP32
#define BOARD_ID "esp32"
static const uint8_t PINS[] = {0, 2, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33};
#elif CONFIG_IDF_TARGET_ESP32S3
#define BOARD_ID "esp32s3"
static const uint8_t PINS[] = {0,  1,  2,  3,  4,  5,  6,  7,  8,  9,  10, 11, 12, 13, 14,
                               15, 16, 17, 18, 21, 38, 39, 40, 41, 42, 45, 46, 47, 48};
#elif CONFIG_IDF_TARGET_ESP32C3
#define BOARD_ID "esp32c3"
static const uint8_t PINS[] = {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10};
#elif CONFIG_IDF_TARGET_ESP32S2
// Not watched: 19 and 20 (native USB), 26 to 32 (flash and PSRAM), 33 to 37
// (octal flash or PSRAM on some modules), 43 and 44 (UART0) and 46 (input only).
#define BOARD_ID "esp32s2"
static const uint8_t PINS[] = {0,  1,  2,  3,  4,  5,  6,  7,  8,  9,  10, 11, 12,
                               13, 14, 15, 16, 17, 18, 21, 38, 39, 40, 41, 42, 45};
#elif CONFIG_IDF_TARGET_ESP32C6
// Not watched: 12 and 13 (native USB), 16 and 17 (UART0), 24 to 30 (flash).
#define BOARD_ID "esp32c6"
static const uint8_t PINS[] = {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 15, 18, 19, 20, 21, 22, 23};
#else
#error "Pin detective supports the ESP32, ESP32-S2, ESP32-S3, ESP32-C3 and ESP32-C6."
#endif

static const size_t PIN_COUNT = sizeof(PINS) / sizeof(PINS[0]);
static const uint8_t STABLE_READS = 4;  // 4 reads 5 ms apart: ignore contact bounce

static uint8_t level[PIN_COUNT];    // last reported level
static uint8_t pending[PIN_COUNT];  // how many reads in a row disagreed with it

static uint32_t physicalFlashSize() {
  uint32_t size = 0;
#if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(5, 0, 0)
  esp_flash_get_physical_size(esp_flash_default_chip, &size);
#else
  esp_flash_get_size(esp_flash_default_chip, &size);
#endif
  return size;
}

static void printIdentity() {
  Console.printf("PD hello board=%s fw=%s\n", BOARD_ID, FIRMWARE_VERSION);

  const uint64_t mac = ESP.getEfuseMac();
  Console.printf("PD id chip=%s rev=%u cores=%u mhz=%u flash=%u psram=%u mac=%02X:%02X:%02X:%02X:%02X:%02X sdk=%s\n",
                 ESP.getChipModel(), (unsigned)ESP.getChipRevision(), (unsigned)ESP.getChipCores(),
                 (unsigned)ESP.getCpuFreqMHz(), (unsigned)physicalFlashSize(), (unsigned)ESP.getPsramSize(),
                 (unsigned)(mac & 0xFF), (unsigned)((mac >> 8) & 0xFF), (unsigned)((mac >> 16) & 0xFF),
                 (unsigned)((mac >> 24) & 0xFF), (unsigned)((mac >> 32) & 0xFF), (unsigned)((mac >> 40) & 0xFF),
                 ESP.getSdkVersion());

  Console.print("PD pins ");
  for (size_t i = 0; i < PIN_COUNT; i++) Console.printf(i ? ",%u" : "%u", (unsigned)PINS[i]);
  Console.print("\nPD low ");
  bool any = false;
  for (size_t i = 0; i < PIN_COUNT; i++) {
    if (level[i] == LOW) {
      Console.printf(any ? ",%u" : "%u", (unsigned)PINS[i]);
      any = true;
    }
  }
  Console.print(any ? "\n" : "-\n");
}

void setup() {
  Console.begin(115200);
  for (size_t i = 0; i < PIN_COUNT; i++) pinMode(PINS[i], INPUT_PULLUP);
  delay(50);  // let the pull-ups settle
  for (size_t i = 0; i < PIN_COUNT; i++) {
    level[i] = digitalRead(PINS[i]);
    pending[i] = 0;
  }
  delay(300);
  printIdentity();
}

void loop() {
  for (size_t i = 0; i < PIN_COUNT; i++) {
    const uint8_t now = digitalRead(PINS[i]);
    if (now == level[i]) {
      pending[i] = 0;
    } else if (++pending[i] >= STABLE_READS) {
      level[i] = now;
      pending[i] = 0;
      Console.printf("PD %u %u\n", (unsigned)PINS[i], (unsigned)now);
    }
  }

  // "PD?" asks for the identity block again, for a page that connected late.
  static char line[8];
  static uint8_t length = 0;
  while (Console.available() > 0) {
    const char c = (char)Console.read();
    if (c == '\n' || c == '\r') {
      line[length] = '\0';
      if (strcmp(line, "PD?") == 0) printIdentity();
      length = 0;
    } else if (length < sizeof(line) - 1) {
      line[length++] = c;
    }
  }
  delay(5);
}
