// "What you'll need": turns a project's parts lines into icons, short labels,
// resistor colour bands and LED colours. Pure functions, so the kit cards, the
// parts table and tests/kit.test.ts all share them.

export type IconId =
  | "esp32"
  | "esp32cam"
  | "uno"
  | "breadboard"
  | "wires"
  | "usb"
  | "usbserial"
  | "battery"
  | "power"
  | "service"
  | "hardware"
  | "resistor"
  | "led"
  | "rgbled"
  | "button"
  | "pot"
  | "encoder"
  | "buzzer"
  | "speaker"
  | "oled"
  | "lcd"
  | "sevenseg"
  | "neopixel"
  | "epaper"
  | "servo"
  | "motor"
  | "relay"
  | "transistor"
  | "diode"
  | "capacitor"
  | "ds18b20"
  | "dht22"
  | "i2c"
  | "hcsr04"
  | "sharpir"
  | "pir"
  | "mpu6050"
  | "joystick"
  | "soil"
  | "ldr"
  | "reed"
  | "thermocouple"
  | "nrf24"
  | "ledmatrix"
  | "rtc"
  | "tft"
  | "sdcard"
  | "ic"
  | "module";

export interface KitItem {
  qty: number;
  /** The full parts line, as written on the project page */
  text: string;
  /** A short name for the kit card */
  label: string;
  icon: IconId;
  optional: boolean;
  /** An alternative to the line above ("or ESP32-S3-DevKitC-1") */
  alternative: boolean;
  /** Colour band names for a resistor line with a value, e.g. ["red", "red", "brown", "gold"] */
  bands?: string[];
  /** LED colours named in the line, e.g. ["green", "red", "yellow", "blue"] */
  colours?: string[];
  /** Capacitor style */
  ceramic?: boolean;
}

// Order matters: the first rule that matches wins. Specific parts come before
// the generic words they contain ("photoresistor" before "resistor", "pan-tilt
// bracket" before "servo"), and a line that starts with a resistor value is a
// resistor even if it mentions what it is for ("4.7 kΩ resistor for the DS18B20").
const RULES: [RegExp, IconId][] = [
  [/^[\d.]+\s*[kM]?\s*Ω\s+resistors?\b/i, "resistor"],
  [/arduino uno/i, "uno"],
  [/esp32-cam/i, "esp32cam"],
  [/usb-to-serial|usb to serial|ftdi/i, "usbserial"],
  [/\besp32\b|devkit/i, "esp32"],
  [/usb cables?|usb cable/i, "usb"],
  [/battery|li-ion|lipo|coin cell|cr2032/i, "battery"],
  [/supply|power bank|adapter/i, "power"],
  [/mqtt broker|broker|server|service/i, "service"],
  [/bracket|plate|plywood|3d print/i, "hardware"],
  [/breadboard/i, "breadboard"],
  [/jumper wires?|bare wires|contact pads|foil|wires\b/i, "wires"],
  [/photoresistor|light sensor|\bldr\b|photocell/i, "ldr"],
  [/potentiometer|trimmer/i, "pot"],
  [/rotary encoder/i, "encoder"],
  [/joystick/i, "joystick"],
  [/max7219|led matrix|dot matrix/i, "ledmatrix"],
  [/ds3231|real-time clock|\brtc\b/i, "rtc"],
  [/\btft\b|st7789|st7735|ili9341/i, "tft"],
  [/micro ?sd|\bsd card/i, "sdcard"],
  [/neopixel|ws2812/i, "neopixel"],
  [/rgb led/i, "rgbled"],
  [/7-segment|seven-segment/i, "sevenseg"],
  [/^leds?\b|\bleds?:/i, "led"],
  [/buzzer|piezo/i, "buzzer"],
  [/speaker/i, "speaker"],
  [/oled|ssd1306/i, "oled"],
  [/\blcd\b|hd44780/i, "lcd"],
  [/e-paper|epaper|e-ink/i, "epaper"],
  [/servo/i, "servo"],
  [/\bmotor\b/i, "motor"],
  [/relay/i, "relay"],
  [/transistor|mosfet/i, "transistor"],
  [/diode|1n400\d|1n4148/i, "diode"],
  [/capacitor/i, "capacitor"],
  [/push buttons?|\bbuttons?\b|tactile/i, "button"],
  [/ds18b20/i, "ds18b20"],
  [/dht22|am2302|dht11/i, "dht22"],
  [/hc-sr04|ultrasonic/i, "hcsr04"],
  [/sharp|gp2y/i, "sharpir"],
  [/\bpir\b|hc-sr501/i, "pir"],
  [/mpu-6050|mpu6050|gy-521/i, "mpu6050"],
  [/soil/i, "soil"],
  [/reed switch/i, "reed"],
  [/thermocouple|max31855|max6675/i, "thermocouple"],
  [/nrf24/i, "nrf24"],
  [/bme280|sht31|aht20|bmp280|i2c sensor|i2c device/i, "i2c"],
  [/74hc595|shift register|level shifter|74ahct|\bic\b/i, "ic"],
  [/resistors?\b/i, "resistor"],
  [/\bled\b/i, "led"],
];

export function iconFor(text: string): IconId {
  const t = text.replace(/^(optional:?\s*|or\s+)/i, "");
  for (const [re, icon] of RULES) if (re.test(t)) return icon;
  return "module";
}

const BAND = ["black", "brown", "red", "orange", "yellow", "green", "blue", "violet", "grey", "white"];

/** Ohms named at the start of a resistor line: "4.7 kΩ resistor" -> 4700. */
export function resistorOhms(text: string): number | null {
  const m = /([\d.]+)\s*([kM]?)\s*Ω/i.exec(text);
  if (!m) return null;
  const n = Number(m[1]) * (m[2] === "k" ? 1e3 : m[2] === "M" ? 1e6 : 1);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/** Four-band colour code (two digits, multiplier, gold 5 % tolerance). */
export function resistorBands(ohms: number): string[] {
  let exp = 0;
  let v = ohms;
  while (v >= 100) {
    v /= 10;
    exp++;
  }
  while (v < 10 && exp > -2) {
    v *= 10;
    exp--;
  }
  const digits = Math.round(v);
  const fix = digits === 100 ? [10, exp + 1] : [digits, exp];
  const [d, e] = fix;
  const mult = e === -1 ? "gold" : e === -2 ? "silver" : BAND[e];
  return [BAND[Math.floor(d / 10)], BAND[d % 10], mult, "gold"];
}

const LED_COLOURS = ["red", "green", "yellow", "blue", "white", "orange"];

export function ledColours(text: string): string[] {
  const t = text.toLowerCase();
  return LED_COLOURS.filter((c) => new RegExp(`\\b${c}\\b`).test(t)).sort((a, b) => t.indexOf(a) - t.indexOf(b));
}

/** A short name for the card: no "Optional", no "or", no trailing detail. */
export function shortLabel(text: string): string {
  let s = text.replace(/^optional:?\s*/i, "").replace(/^or\s+/i, "");
  s = s.replace(/^(a|an)\s+/i, "");
  // "LEDs: green, red, yellow and blue" reads better as a list of colours.
  const colours = ledColours(s);
  if (/^leds?\s*:/i.test(s) && colours.length > 1) s = `${colours.join(", ")} LEDs`;
  else {
    // Drop detail after a colon, bracket, comma or "with" once the name can stand alone.
    // A colon introduces a list ("plate and base: card, plywood or…") or a model
    // ("I2C sensor: AHT20"); keep a short model, drop a list.
    const colon = s.indexOf(": ");
    if (colon >= 3 && s.slice(colon + 2).includes(",")) s = s.slice(0, colon);
    for (const sep of [" (", ", "]) {
      const at = s.indexOf(sep);
      if (at >= 3) s = s.slice(0, at);
    }
    for (const sep of [" with ", " for "]) {
      const at = s.indexOf(sep);
      if (s.length > 24 && at >= 8) s = s.slice(0, at);
    }
  }
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > 30) {
    const cut = s.lastIndexOf(" ", 29);
    s = `${s.slice(0, cut > 14 ? cut : 29)}…`;
  }
  // Capitalise, but leave names like "nRF24L01+" alone.
  return /^[a-z][A-Z]/.test(s) ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

export function kitItem([qty, text]: readonly [number, string, string?]): KitItem {
  const icon = iconFor(text);
  const item: KitItem = {
    qty,
    text,
    label: shortLabel(text),
    icon,
    optional: /^optional\b/i.test(text) || /,?\s*only (if|on|for)\b/i.test(text),
    alternative: /^or\s+/i.test(text),
  };
  if (icon === "resistor") {
    const ohms = resistorOhms(text);
    if (ohms) item.bands = resistorBands(ohms);
  }
  if (icon === "led") item.colours = ledColours(text);
  if (icon === "capacitor") item.ceramic = /ceramic|0\.\d+\s*µF|nF|pF/i.test(text);
  return item;
}

export function kitFor(parts: readonly (readonly [number, string, string?])[]): KitItem[] {
  return parts.map((p) => kitItem(p));
}

/** "6 parts + 2 optional": counts lines, not pieces, and skips "or" alternatives. */
export function kitSummary(items: KitItem[]): { required: number; optional: number } {
  const real = items.filter((i) => !i.alternative);
  return { required: real.filter((i) => !i.optional).length, optional: real.filter((i) => i.optional).length };
}
