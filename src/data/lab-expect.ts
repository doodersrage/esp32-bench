// What the hardware lab expects each project to print. The lab (lab/runner.py)
// flashes a project's prebuilt firmware onto a bare board, captures the serial
// output for `seconds`, and passes the project when every pattern matches.
//
// Patterns are regular expression sources matched against the whole capture
// (multiline). They are chosen so a board with NO parts attached still passes
// when the firmware boots and the sketch runs: where a sketch prints a
// "not found" line without its sensor, the pattern accepts that line too.
// `needs` says what a full check would require beyond a bare board.

export type LabNeeds = "none" | "wifi" | "parts";

export interface LabExpect {
  /** Regex sources that must all match the captured output */
  patterns: string[];
  /** How long to capture after the board resets */
  seconds: number;
  /** What the rig must provide for the patterns that matter */
  needs: LabNeeds;
  /** Setting keys the runner sends over USB before the capture (SET/SAVE protocol) */
  settings?: string[];
  /** What a pass proves, and what it does not */
  notes?: string;
}

const BOOT_ONLY = "Only the boot banner is checked: a pass proves the firmware boots and the sketch starts.";
const WIFI_FROM_LAB = "The lab sends its Wi-Fi name and password over USB first.";

export const LAB_EXPECT: Record<string, LabExpect> = {
  blink: { patterns: ["tick \\d+ ms"], seconds: 8, needs: "none" },
  "wifi-scan": { patterns: ["\\d+ networks?"], seconds: 25, needs: "none", notes: "A scan runs without credentials; zero networks still counts." },
  "i2c-scan": { patterns: ["\\d+ device\\(s\\) found"], seconds: 15, needs: "none", notes: "A bare board reports 0 devices, which is correct." },
  dht22: { patterns: ["(Sensor read failed, check wiring|-?\\d+\\.\\d C  \\d+\\.\\d %RH)"], seconds: 15, needs: "parts", notes: "Without a DHT22 the sketch reports a failed read; with one wired it prints readings." },
  oled: { patterns: ["(Display ready|SSD1306 not found at 0x3C)"], seconds: 10, needs: "parts", notes: "Without the OLED the sketch stops after SSD1306 not found." },
  hcsr04: { patterns: ["(No echo|\\d+\\.\\d cm)"], seconds: 15, needs: "parts", notes: "Without the sensor every reading is No echo." },
  "deep-sleep": { patterns: ["Boot \\d+, wake cause \\d+", "Sleeping\\. Press the button to wake\\."], seconds: 15, needs: "none" },
  "web-led": { patterns: ["Open http://\\d+\\.\\d+\\.\\d+\\.\\d+"], seconds: 45, needs: "wifi", settings: ["wifi_ssid", "wifi_pass"], notes: WIFI_FROM_LAB },
  "touch-piano": { patterns: ["key \\d+ on GPIO \\d+: baseline \\d+", "Touch a key"], seconds: 10, needs: "none" },
  "esp-now": { patterns: ["esp-now ready on channel \\d+, this board is [AB], MAC", "tx [AB] #\\d+ sent"], seconds: 15, needs: "none", notes: "A broadcast send succeeds with no partner board; received packets are not checked." },
  neopixel: { patterns: ["\\d+ LEDs on GPIO \\d+", "effect: color wipe"], seconds: 12, needs: "none", notes: "The strip itself is not checked, only that the effects run." },
  "mqtt-ha": { patterns: ["wifi joining", "wifi ok \\d+\\.\\d+\\.\\d+\\.\\d+", "mqtt connecting to"], seconds: 45, needs: "wifi", settings: ["wifi_ssid", "wifi_pass"], notes: `${WIFI_FROM_LAB} There is no MQTT broker in the lab, so only the connection attempt is checked.` },
  "ble-scan": { patterns: ["\\d+ devices?"], seconds: 25, needs: "none" },
  ota: { patterns: ["wifi joining", "ota ready: .+ at \\d+\\.\\d+\\.\\d+\\.\\d+"], seconds: 45, needs: "wifi", settings: ["wifi_ssid", "wifi_pass"], notes: WIFI_FROM_LAB },
  "battery-sensor": {
    patterns: ["boot \\d+, woke by", "(temp -?\\d+\\.\\d+ C|no probe: check the data wire)", "battery \\d+\\.\\d+ V", "awake \\d+ ms, sleeping \\d+ min"],
    seconds: 20,
    needs: "parts",
    notes: "Without the probe the sketch prints no probe and still reports the battery and sleeps.",
  },
  "relay-servo": { patterns: ["relay off", "ready: type angle 0 to 180"], seconds: 10, needs: "none", notes: "The servo and relay are not checked, only that the command prompt comes up." },
  epaper: { patterns: ["(temp -?\\d+\\.\\d+ C|no probe: check the data wire)"], seconds: 20, needs: "parts", notes: "Without the probe the sketch prints no probe; the panel is not checked." },
  "bme280-web": { patterns: ["(wifi joining|BME280 not found at 0x76 or 0x77)"], seconds: 20, needs: "parts", notes: "Without the sensor the sketch stops after BME280 not found; with it wired, the lab's Wi-Fi is needed for the dashboard line." },
  "wifi-portal": { patterns: ["hold BOOT now to forget the saved network", "(portal up: join|wifi joining)"], seconds: 20, needs: "none", notes: "A bare board opens its own setup network, which needs no credentials." },
  "esp32-cam-stream": { patterns: ["(Camera ready|Camera init failed)"], seconds: 20, needs: "parts", notes: "Needs an ESP32-CAM; without a working camera the sketch reports the init error." },
  "reaction-timer": { patterns: ["Reaction timer\\. Press BOOT when the LED lights\\.", "get ready\\.\\.\\."], seconds: 12, needs: "none" },
  "morse-decoder": { patterns: ["Morse decoder\\. Key with the BOOT button"], seconds: 5, needs: "none", notes: BOOT_ONLY },
  simon: { patterns: ["Simon\\. Press any button to start\\."], seconds: 5, needs: "parts", notes: BOOT_ONLY },
  theremin: { patterns: ["Theremin ready", "distance_cm=\\d+\\.\\d, freq=\\d+"], seconds: 10, needs: "none", notes: "Without the sensor the distance reads 0; the buzzer is not checked." },
  "oled-pong": { patterns: ["(Pong ready|SSD1306 not found at 0x3C)"], seconds: 10, needs: "parts", notes: "Without the OLED the sketch stops after SSD1306 not found." },
  dice: { patterns: ["(Dice ready|SSD1306 not found at 0x3C)"], seconds: 10, needs: "parts", notes: "Without the OLED the sketch stops after SSD1306 not found." },
  "ntp-clock": {
    patterns: ["(wifi joining|SSD1306 not found at 0x3C)"],
    seconds: 20,
    needs: "parts",
    settings: ["wifi_ssid", "wifi_pass"],
    notes: `Without the OLED the sketch stops after SSD1306 not found. With one wired, ${WIFI_FROM_LAB.toLowerCase()}`,
  },
  "fire-lamp": { patterns: ["\\d+ LEDs on GPIO \\d+", "mode: fire", "fps=\\d+"], seconds: 12, needs: "none", notes: "The strip itself is not checked." },
  "talking-plant": { patterns: ["Talking plant\\. Calibrate", "moisture=\\d+% raw=\\d+"], seconds: 10, needs: "none", notes: "A bare analog pin gives a reading; the value means nothing without the sensor." },
  "ir-sweep": { patterns: ["IR sweep ready", "angle = \\d+, cm = \\d+\\.\\d"], seconds: 15, needs: "none", notes: "The servo and sensor are not checked, only the sweep loop." },
  "level-platform": { patterns: ["(Calibrating: keep the base still and level|MPU-6050 not found at 0x68)"], seconds: 10, needs: "parts", notes: "Without the MPU-6050 the sketch stops after MPU-6050 not found." },
  "joystick-turret": { patterns: ["Turret ready\\. MPU-6050 (found|not found)", "pan = \\d+, tilt = \\d+"], seconds: 10, needs: "none", notes: "The servos are not checked; a floating stick still prints angles." },
  "visitor-counter": { patterns: ["Visitor counter\\. Warming up the PIR for \\d+ s\\.", "Counting\\."], seconds: 40, needs: "parts", notes: "Counting starts after the 30 s warm-up even with no PIR; counts need one." },
  "auto-fan": { patterns: ["Auto fan: following the (light|temperature)", "light = \\d+%, duty = \\d+%"], seconds: 10, needs: "none", notes: "In light mode a bare analog pin gives a reading; the motor is not checked." },
  "rfid-reader": { patterns: ["(RC522 ready, chip version 0x[0-9A-F]{2}|RC522 not found: check 3V3, GND and the SPI wires)", "Tap a card"], seconds: 10, needs: "parts", notes: "Without the reader the sketch reports RC522 not found; reading cards needs a reader and a card." },
  "ir-remote": { patterns: ["IR remote decoder, receiver on GPIO \\d+", "(learn: press three different buttons|Buttons learned)"], seconds: 8, needs: "parts", notes: "Decoding needs a receiver and a remote pressed in front of it." },
  "stepper-28byj": { patterns: ["Stepper ready\\. Commands: go <steps>, speed <rpm>, home", "One turn is about \\d+ steps"], seconds: 8, needs: "none", notes: "The command prompt comes up without a motor; movement is not checked." },
  "keypad-lock": { patterns: ["Keypad lock ready, code length \\d+\\. Type the code and #"], seconds: 8, needs: "parts", notes: "Only the ready line is checked: keys need a keypad and someone to press them." },
  "ph-display": {
    patterns: ["wifi ok \\d+\\.\\d+\\.\\d+\\.\\d+", "(ProbeHarbor: |\\w+: \\w+ = )"],
    seconds: 60,
    needs: "wifi",
    settings: ["wifi_ssid", "wifi_pass", "share_url"],
    notes: `${WIFI_FROM_LAB} Without a share link the display reports Link invalid or expired, which counts as a pass of the firmware.`,
  },
  "ph-lcd": {
    patterns: ["wifi ok \\d+\\.\\d+\\.\\d+\\.\\d+", "(ProbeHarbor: |\\w+: \\w+ = )"],
    seconds: 60,
    needs: "wifi",
    settings: ["wifi_ssid", "wifi_pass", "share_url"],
    notes: `${WIFI_FROM_LAB} The LCD cannot be checked over serial.`,
  },
  "ph-motion": {
    patterns: ["wifi ok \\d+\\.\\d+\\.\\d+\\.\\d+", "(posted (motion|quiet) (ok|FAILED)|ingest address not set)"],
    seconds: 60,
    needs: "wifi",
    settings: ["wifi_ssid", "wifi_pass", "ingest_url"],
    notes: `${WIFI_FROM_LAB} A lab without a ProbeHarbor ingest address stops after joining Wi-Fi and says so; with one but no device key the post fails, which still shows the sketch runs.`,
  },
  "nrf24-link": { patterns: ["(radio listening|nRF24 not found)"], seconds: 15, needs: "parts", notes: "Without the radio the sketch stops after nRF24 not found." },
  "led-matrix": { patterns: ["matrix ready: \\d+ modules", "passes = \\d+"], seconds: 15, needs: "none", notes: "The sketch scrolls with or without modules attached; the matrix itself is not checked." },
  "rtc-clock": { patterns: ["(DS3231 not found at 0x68|temp_c = -?\\d+\\.\\d+)"], seconds: 12, needs: "parts", notes: "Without the module the sketch reports DS3231 not found and retries; with it wired, the time and temperature lines appear." },
  "tft-display": { patterns: ["TFT ready: \\d+x\\d+ ST7789", "fps = \\d+\\.\\d"], seconds: 10, needs: "none", notes: "The sketch draws with or without a screen attached; the panel itself is not checked." },
  "sd-logger": { patterns: ["(SD card not found|logging to /log\\d{3}\\.csv)"], seconds: 15, needs: "parts", notes: "Without a card module the sketch reports SD card not found and retries; with one, it logs a row every 5 s." },
  "ph-ds18b20": { patterns: ["WiFi"], seconds: 10, needs: "wifi", notes: "ProbeHarbor's sketch has its Wi-Fi compiled in, which the lab cannot set; only the boot line is checked." },
  "ph-ds18b20-portal": { patterns: ["(Starting Web Portal|WiFi ok)"], seconds: 10, needs: "wifi", notes: "With no Wi-Fi saved it opens its setup portal (ProbeHarbor-Setup); that is what is checked." },
  "ph-door": { patterns: ["WiFi"], seconds: 10, needs: "wifi", notes: "ProbeHarbor's sketch has its Wi-Fi compiled in; only the boot line is checked." },
  "ph-leak": { patterns: ["WiFi"], seconds: 10, needs: "wifi", notes: "ProbeHarbor's sketch has its Wi-Fi compiled in; only the boot line is checked." },
  "ph-power": { patterns: ["WiFi"], seconds: 10, needs: "wifi", notes: "ProbeHarbor's sketch has its Wi-Fi compiled in; only the boot line is checked." },
  "ph-max31855": { patterns: ["(MAX31855 not found|\\.\\.\\.|WiFi ok)"], seconds: 10, needs: "wifi", notes: "ProbeHarbor's sketch has its Wi-Fi compiled in, so on the lab it keeps trying to join (dots); only that it boots that far is checked. A bare module can read as present." },
  "ph-max6675": { patterns: ["(\\.\\.\\.|WiFi ok)"], seconds: 10, needs: "wifi", notes: "ProbeHarbor's sketch has its Wi-Fi compiled in, so on the lab it keeps trying to join (dots); only that it boots that far is checked." },
};

/** Chip name for esptool, from a board id. */
export const CHIP_FOR_BOARD: Record<string, string> = {
  esp32: "esp32",
  esp32s3: "esp32s3",
  esp32c3: "esp32c3",
  esp32s2: "esp32s2",
  esp32c6: "esp32c6",
  "xiao-esp32c3": "esp32c3",
  "xiao-esp32s3": "esp32s3",
  "esp32-cam": "esp32",
  "esp32-doit": "esp32",
  "esp32c3-supermini": "esp32c3",
};
