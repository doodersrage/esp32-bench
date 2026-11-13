// Buy links, carried over from ProbeHarbor's parts list (src/lib/bomLinks.ts there).
// Amazon links get an Associates tag when PUBLIC_AMAZON_ASSOCIATE_TAG is set at
// build time; without it they stay plain. Adafruit runs no affiliate program,
// so those links are always direct.

const tag = (import.meta.env.PUBLIC_AMAZON_ASSOCIATE_TAG ?? "").trim();

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
