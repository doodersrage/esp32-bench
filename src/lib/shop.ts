// Buy links, carried over from ProbeHarbor's parts list (src/lib/bomLinks.ts there).
// Amazon links get an Associates tag when PUBLIC_AMAZON_ASSOCIATE_TAG is set at
// build time; without it they stay plain. Adafruit runs no affiliate program,
// so those links are always direct.
//
// Parts with no product link of their own get an Amazon search instead
// (AMAZON_SEARCH below, one query per kind of part): generic parts such as
// jumper wires and HC-SR04s come from many sellers, and a search never points
// at a listing that has gone or changed.
import { kitItem, type IconId } from "./kit";

const tag = (import.meta.env?.PUBLIC_AMAZON_ASSOCIATE_TAG ?? "").trim();

function isAmazon(url: string): boolean {
  try {
    return /(^|\.)amazon\./i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Append the Amazon Associates tag when one is configured. */
export function affiliateHref(url: string): string {
  if (!tag || !isAmazon(url)) return url;
  const parsed = new URL(url);
  parsed.searchParams.set("tag", tag);
  return parsed.toString();
}

/** `rel` for a shop link: sponsored only for Amazon Associates links. */
export const shopRel = (url: string): string =>
  isAmazon(url) ? "sponsored noopener noreferrer" : "noopener noreferrer";

export const shopVendor = (url: string): string => (isAmazon(url) ? "Amazon" : "Adafruit");

const isAmazonSearch = (url: string) => isAmazon(url) && new URL(url).pathname === "/s";

/** Link text for a buy link: a search is "Find on Amazon", a product is "Buy at …". */
export const shopText = (url: string): string => (isAmazonSearch(url) ? "Find on Amazon" : `Buy at ${shopVendor(url)}`);

export const amazonSearch = (query: string) => affiliateHref(`https://www.amazon.com/s?k=${encodeURIComponent(query).replace(/%20/g, "+")}`);

// What to search Amazon for, by kind of part. A function gets the part's text
// for parts whose value matters (resistors, capacitors). Kinds left out have
// nothing to buy: a service, any I2C device, a TV remote, a card base, and
// ProbeHarbor's power sense module, which has no one product to point at.
const ohms = (t: string) => /(\d+(?:\.\d+)?)\s*(k|M)?Ω/.exec(t);
const AMAZON_SEARCH: Partial<Record<IconId, string | ((text: string) => string | null)>> = {
  wires: "breadboard jumper wires dupont kit",
  breadboard: "breadboard with jumper wires kit",
  usb: "USB data cable",
  usbserial: "CP2102 USB to TTL serial adapter 3.3V",
  battery: (t) => (/CR2032/.test(t) ? "CR2032 coin cell battery" : "3.7V LiPo battery with protection circuit JST"),
  power: "5V 2A USB power adapter",
  resistor: (t) => {
    const m = ohms(t);
    return m ? `${m[1]}${m[2] ?? ""} ohm resistor 1/4W` : "resistor assortment kit 1/4W";
  },
  led: "5mm LED assortment kit",
  rgbled: "5mm RGB LED common cathode",
  button: "6mm tactile push button breadboard",
  pot: (t) => (/trimmer/i.test(t) ? "10k trimmer potentiometer" : "10k potentiometer breadboard"),
  encoder: "KY-040 rotary encoder module",
  buzzer: "passive buzzer module 3.3V",
  oled: "0.96 inch SSD1306 OLED I2C 128x64",
  lcd: "16x2 LCD HD44780 I2C",
  sevenseg: "single digit 7 segment LED display",
  epaper: "2.9 inch e-paper module SPI 296x128",
  esp32cam: "AI-Thinker ESP32-CAM OV2640",
  uno: "Arduino Uno R3",
  motor: "130 DC motor with propeller",
  transistor: "2N2222 NPN transistor",
  capacitor: (t) => {
    const m = /(\d+(?:\.\d+)?)\s*µF/.exec(t);
    if (!m) return "capacitor assortment kit";
    return /ceramic/i.test(t) ? `${m[1]}uF ceramic capacitor` : `${m[1]}uF electrolytic capacitor`;
  },
  dht22: "DHT22 AM2302 temperature humidity sensor",
  hcsr04: "HC-SR04 ultrasonic sensor",
  pir: "HC-SR501 PIR motion sensor",
  mpu6050: "MPU-6050 GY-521 module",
  soil: "capacitive soil moisture sensor v1.2",
  ldr: "photoresistor LDR 5mm",
  nrf24: "nRF24L01+ wireless module",
  rfid: "RC522 RFID module kit",
  irrecv: "VS1838B IR receiver",
  stepper: "28BYJ-48 stepper motor ULN2003",
  stepperdrv: "ULN2003 stepper motor driver board",
  keypad: "4x4 membrane keypad",
  ledmatrix: "MAX7219 4 in 1 dot matrix module",
  sdcard: "microSD card 32GB",
  thermocouple: (t) => (/MAX6675/.test(t) ? "MAX6675 module K-type thermocouple" : /MAX31855/.test(t) ? "MAX31855 thermocouple breakout" : "K-type thermocouple probe"),
  hardware: (t) => (/pan-tilt/i.test(t) ? "SG90 pan tilt bracket" : null),
};

export interface BuyLink {
  href: string;
  rel: string;
  text: string;
  /** For Amazon links: what to search for on another country's store (src/scripts/amazon-region.ts) */
  amazonQ?: string;
}

/** Where to buy one parts line: its own link, or else an Amazon search for its kind of part. */
export function buyFor(part: readonly [number, string, string?]): BuyLink | null {
  const item = kitItem(part);
  const q = AMAZON_SEARCH[item.icon];
  const query = (typeof q === "function" ? q(part[1]) : q) ?? undefined;
  const href = part[2] ?? (query ? amazonSearch(query) : undefined);
  if (!href) return null;
  return { href, rel: shopRel(href), text: shopText(href), amazonQ: isAmazon(href) ? (query ?? item.label) : undefined };
}

/** Attributes for a buy link, with the search to use on another country's Amazon. */
export const buyAttrs = (href: string, amazonQ: string) => ({
  href,
  rel: shopRel(href),
  ...(isAmazon(href) ? { "data-amazon-q": amazonQ } : {}),
});

// Amazon stores by visitor country, for PUBLIC_AMAZON_TAGS. Keys are the
// store's domain after "amazon.".
const STORES: Record<string, string> = {
  GB: "co.uk", IE: "co.uk", DE: "de", AT: "de", CH: "de", FR: "fr", BE: "fr", IT: "it", ES: "es", NL: "nl",
  CA: "ca", AU: "com.au", NZ: "com.au", IN: "in", JP: "co.jp", MX: "com.mx", BR: "com.br", SE: "se", PL: "pl",
};
export const amazonStoreFor = (country: string): string | undefined => STORES[country];

export const localAmazonHref = (query: string, store: string, storeTag: string) =>
  `https://www.amazon.${store}/s?k=${encodeURIComponent(query).replace(/%20/g, "+")}&tag=${encodeURIComponent(storeTag)}`;

/** PUBLIC_AMAZON_TAGS: a JSON object of store to tag, such as {"co.uk":"name-21","de":"name-21"}. */
export function amazonTags(): string {
  try {
    const raw = JSON.parse(import.meta.env?.PUBLIC_AMAZON_TAGS || "{}") as Record<string, unknown>;
    const ok = Object.fromEntries(Object.entries(raw).filter(([k, v]) => Object.values(STORES).includes(k) && typeof v === "string" && /^[\w-]{1,40}$/.test(v)));
    return JSON.stringify(ok);
  } catch {
    return "{}";
  }
}

/** On-page disclosure for pages that carry Amazon buy links. */
export const AFFILIATE_DISCLOSURE =
  "Amazon buy links may include an Associates tag, and this site may earn a commission from qualifying Amazon purchases at no extra cost to you. Adafruit links are direct.";

const amazonDp = (asin: string) => affiliateHref(`https://www.amazon.com/dp/${asin}`);

export const BOM = {
  esp32DevKit: amazonDp("B08D5ZD528"),
  esp32S3DevKitC: "https://www.adafruit.com/product/5336",
  esp32C3DevKitM: "https://www.adafruit.com/product/5337",
  huzzah32: "https://www.adafruit.com/product/3591",
  esp32FeatherV2: "https://www.adafruit.com/product/5400",
  ds18b20: "https://www.adafruit.com/product/381",
  resistor4k7: amazonDp("B08QRZRRGB"),
  sht31: "https://www.adafruit.com/product/2857",
  bme280: "https://www.adafruit.com/product/2652",
  aht20: "https://www.adafruit.com/product/4566",
  reedSwitch: "https://www.adafruit.com/product/375",
  resistor100k: "https://www.adafruit.com/product/2787",
  neopixelStick: "https://www.adafruit.com/product/1426",
  levelShifter: "https://www.adafruit.com/product/1787",
  microServo: "https://www.adafruit.com/product/169",
  miniRelay: "https://www.adafruit.com/product/4409",
  piezoBuzzer: "https://www.adafruit.com/product/160",
  pot10k: "https://www.adafruit.com/product/562",
  tactileButtons: "https://www.adafruit.com/product/367",
  sharpIr: "https://www.adafruit.com/product/164",
  pirSensor: "https://www.adafruit.com/product/189",
  shiftRegister595: "https://www.adafruit.com/product/450",
  pn2222: "https://www.adafruit.com/product/756",
  diode1n4001: "https://www.adafruit.com/product/755",
  photocell: "https://www.adafruit.com/product/161",
  thumbJoystick: "https://www.adafruit.com/product/512",
  rtcDs3231: "https://www.adafruit.com/product/3013",
  tftSt7789: "https://www.adafruit.com/product/4311",
  microSdBreakout: "https://www.adafruit.com/product/254",
} as const;
