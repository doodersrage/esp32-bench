// Run: DUMP_KIT=1 npx astro build && node --experimental-strip-types tests/kit.test.ts
// With the DUMP_KIT build it also checks every project's parts list
// (dist/kit-dump/parts.json); without it only the fixed cases run.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { iconFor, kitItem, kitSummary, ledColours, resistorBands, resistorOhms, shortLabel } from "../src/lib/kit.ts";

// Resistor colour codes.
const bands = (s: string) => resistorBands(resistorOhms(s)!).join(" ");
assert.equal(bands("220 Ω resistor"), "red red brown gold");
assert.equal(bands("330 Ω resistors"), "orange orange brown gold");
assert.equal(bands("470 Ω resistor"), "yellow violet brown gold");
assert.equal(bands("1 kΩ resistor"), "brown black red gold");
assert.equal(bands("2 kΩ resistor"), "red black red gold");
assert.equal(bands("4.7 kΩ resistor"), "yellow violet red gold");
assert.equal(bands("10 kΩ resistor"), "brown black orange gold");
assert.equal(bands("100 kΩ resistors"), "brown black yellow gold");
assert.equal(bands("1 MΩ resistor"), "brown black green gold");
assert.equal(bands("4.7 Ω resistor"), "yellow violet gold gold");
assert.equal(resistorOhms("Push button"), null);

// Tricky lines: the specific part wins over a generic word it contains.
const cases: [string, string][] = [
  ["Photoresistor (light sensor) and a 10 kΩ resistor", "ldr"],
  ["Optional: 4.7 kΩ resistor for the DS18B20", "resistor"],
  ["10 kΩ potentiometers", "pot"],
  ["10 kΩ trimmer potentiometer, for the contrast", "pot"],
  ["Optional: a pan-tilt bracket, or tape the tilt servo to the pan servo's horn", "hardware"],
  ["Optional: NPN transistor (2N2222, BC547 or similar) and 1 kΩ resistor, to blink the backlight", "transistor"],
  ["Single 7-segment LED digit, common cathode or common anode", "sevenseg"],
  ["NeoPixel Stick, 8 LEDs, or any WS2812B strip", "neopixel"],
  ["RGB LED, common cathode or common anode (or three single LEDs)", "rgbled"],
  ["LED and 220 Ω resistor, only on a board without its own LED", "led"],
  ["3.3 V USB-to-serial adapter (CP2102, CH340 or FTDI)", "usbserial"],
  ["USB cables, or one cable and a USB power supply", "usb"],
  ["5 V supply for the servos, such as a USB power bank or a 5 V 2 A adapter", "power"],
  ["HC-SR501 PIR motion sensor", "pir"],
  ["DS18B20 waterproof probe, or a DHT22", "ds18b20"],
  ["or ESP32-S3-DevKitC-1", "esp32"],
  ["AI-Thinker ESP32-CAM with the OV2640 camera", "esp32cam"],
  ["Jumper wires and a breadboard", "breadboard"],
  ["Optional 74AHCT125 level shifter", "ic"],
  ["An MQTT broker, such as the Mosquitto add-on in Home Assistant", "service"],
];
for (const [text, icon] of cases) assert.equal(iconFor(text), icon, text);

// Optional and alternative lines.
assert.equal(kitItem([1, "Optional passive buzzer"]).optional, true);
assert.equal(kitItem([1, "10 kΩ resistor, only for a bare sensor without a breakout"]).optional, true);
assert.equal(kitItem([1, "Passive buzzer or piezo"]).optional, false);
assert.equal(kitItem([1, "or ESP32-C3-DevKitM-1"]).alternative, true);
assert.equal(kitSummary([kitItem([1, "ESP32 dev board"]), kitItem([1, "or ESP32-C3-DevKitM-1"]), kitItem([1, "Optional door reed switch"])]).required, 1);

// LED colours and capacitor style.
assert.deepEqual(ledColours("LEDs: green, red, yellow and blue"), ["green", "red", "yellow", "blue"]);
assert.equal(kitItem([1, "0.1 µF ceramic capacitor"]).ceramic, true);
assert.equal(kitItem([1, "100 µF electrolytic capacitor"]).ceramic, false);

// Short labels.
assert.equal(shortLabel("0.96 inch SSD1306 OLED, I2C, address 0x3C"), "0.96 inch SSD1306 OLED");
assert.equal(shortLabel("Optional: DS18B20 temperature probe"), "DS18B20 temperature probe");
assert.equal(shortLabel("or ESP32-S3-DevKitC-1"), "ESP32-S3-DevKitC-1");
for (const s of ["2.9 inch black and white SPI e-paper module, 296 by 128, SSD1680 driver", "Single-cell Li-ion or LiPo battery with protection, and a way to get 3.3 V from it"]) {
  assert.ok(shortLabel(s).length <= 35, s);
}

// Every part line in the library: nothing falls back to the generic icon except
// the lines listed here, which really are one-off parts.
const EXPECTED_GENERIC = new Set(["Power sense module with an isolated contact output"]);
const file = process.argv[2] ?? "dist/kit-dump/parts.json";
if (existsSync(file)) {
  const projects = JSON.parse(readFileSync(file, "utf8")) as { id: string; parts: [number, string][] }[];
  const generic: string[] = [];
  let lines = 0;
  for (const p of projects) {
    for (const part of p.parts) {
      lines++;
      const item = kitItem(part);
      assert.ok(item.label.length > 0 && item.label.length <= 35, `${p.id}: label "${item.label}"`);
      if (item.icon === "resistor" && /Ω/.test(part[1]) && /^[\d.]+\s*[kM]?\s*Ω/.test(part[1].replace(/^optional:?\s*/i, ""))) {
        assert.ok(item.bands?.length === 4, `${p.id}: bands for ${part[1]}`);
      }
      if (item.icon === "module") generic.push(`${p.id}: ${part[1]}`);
    }
  }
  const unexpected = generic.filter((g) => !EXPECTED_GENERIC.has(g.slice(g.indexOf(": ") + 2)));
  assert.deepEqual(unexpected, [], `parts falling back to the generic icon:\n${unexpected.join("\n")}`);
  console.log(`kit: ${lines} part lines in ${projects.length} projects classified; generic icon for ${generic.length}: ${generic.join("; ") || "none"}`);
} else {
  console.log(`kit: fixed cases pass (no ${file} to check every project)`);
}
console.log("kit: all checks pass");
