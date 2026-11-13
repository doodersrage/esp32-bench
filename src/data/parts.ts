// Parts the wiring pad knows how to connect. Ids match DRAWER in projects.ts,
// so a project's `needs` can be loaded straight onto the pad.
import type { DrawerPart } from "./projects";

/**
 * How a part pin behaves:
 * power3 / power5  needs that supply
 * gnd              ground
 * in               the board drives it (board output)
 * out              the part drives it (board input)
 * bidir            both directions, such as a one-wire or I2C data line
 */
export type PinKind = "power3" | "power5" | "gnd" | "in" | "out" | "bidir";

export interface PartPin {
  name: string;
  kind: PinKind;
  /** I2C role. Bus pins from several parts share the same two pads. */
  bus?: "sda" | "scl";
  /** The part drives this pin at 5 V */
  level5?: boolean;
  /** Extra component or caution for this pin */
  note?: string;
}

export interface Part {
  id: DrawerPart;
  name: string;
  pins: PartPin[];
}

export const PARTS: Part[] = [
  {
    id: "dht22", name: "DHT22",
    pins: [
      { name: "VCC", kind: "power3" },
      { name: "DATA", kind: "bidir", note: "10 kΩ pull-up to 3V3 on a bare sensor. Breakout boards include it." },
      { name: "GND", kind: "gnd" },
    ],
  },
  {
    id: "ds18b20", name: "DS18B20 probe",
    pins: [
      { name: "VDD", kind: "power3" },
      { name: "DATA", kind: "bidir", note: "4.7 kΩ pull-up from DATA to 3V3." },
      { name: "GND", kind: "gnd" },
    ],
  },
  {
    id: "i2c", name: "I2C sensor module",
    pins: [
      { name: "VIN", kind: "power3" },
      { name: "GND", kind: "gnd" },
      { name: "SDA", kind: "bidir", bus: "sda" },
      { name: "SCL", kind: "in", bus: "scl" },
    ],
  },
  {
    id: "oled", name: "SSD1306 OLED",
    pins: [
      { name: "VCC", kind: "power3" },
      { name: "GND", kind: "gnd" },
      { name: "SDA", kind: "bidir", bus: "sda" },
      { name: "SCL", kind: "in", bus: "scl" },
    ],
  },
  {
    id: "hcsr04", name: "HC-SR04",
    pins: [
      { name: "VCC", kind: "power5" },
      { name: "TRIG", kind: "in" },
      { name: "ECHO", kind: "out", level5: true, note: "Put 1 kΩ in series and 2 kΩ from the GPIO to GND." },
      { name: "GND", kind: "gnd" },
    ],
  },
  {
    id: "button", name: "Push button",
    pins: [
      { name: "A", kind: "out", note: "Uses the internal pull-up: pinMode(pin, INPUT_PULLUP). Pressed reads LOW." },
      { name: "B", kind: "gnd" },
    ],
  },
  {
    id: "reed", name: "Reed switch",
    pins: [
      { name: "A", kind: "out", note: "Uses the internal pull-up. Magnet near reads LOW." },
      { name: "B", kind: "gnd" },
    ],
  },
  {
    id: "wires", name: "Leak contacts",
    pins: [
      { name: "A", kind: "out", note: "Uses the internal pull-up. Water across the contacts reads LOW." },
      { name: "B", kind: "gnd" },
    ],
  },
  {
    id: "powersense", name: "Power sense module",
    pins: [
      { name: "OUT", kind: "out", note: "Use a module with an isolated output. Never connect mains to the board." },
      { name: "GND", kind: "gnd" },
    ],
  },
  {
    id: "max31855", name: "MAX31855 thermocouple amp",
    pins: [
      { name: "VIN", kind: "power3" },
      { name: "GND", kind: "gnd" },
      { name: "CS", kind: "in" },
      { name: "CLK", kind: "in" },
      { name: "DO", kind: "out" },
    ],
  },
  {
    id: "max6675", name: "MAX6675 module",
    pins: [
      { name: "VCC", kind: "power3" },
      { name: "GND", kind: "gnd" },
      { name: "CS", kind: "in" },
      { name: "SCK", kind: "in" },
      { name: "SO", kind: "out" },
    ],
  },
  {
    id: "neopixel", name: "NeoPixel strip",
    pins: [
      { name: "5V", kind: "power5", note: "About 60 mA per LED at full white. Past a few LEDs, power the strip from its own 5 V supply and join the grounds." },
      { name: "GND", kind: "gnd" },
      { name: "DIN", kind: "in", note: "300 to 500 Ω in series. A 74AHCT125 lifts the 3.3 V signal to 5 V if the first LED misses data." },
    ],
  },
  {
    id: "servo", name: "Hobby servo",
    pins: [
      { name: "V+", kind: "power5", note: "One micro servo runs from USB. Larger servos need their own 5 V supply with the grounds joined." },
      { name: "GND", kind: "gnd" },
      { name: "SIG", kind: "in", note: "A 3.3 V signal works with most hobby servos." },
    ],
  },
  {
    id: "relay", name: "Relay module",
    pins: [
      { name: "VCC", kind: "power5", note: "Use 3V3 instead for modules made for 3 V logic." },
      { name: "GND", kind: "gnd" },
      { name: "IN", kind: "in", note: "Use a module with a driver transistor and flyback diode. Never drive a bare relay coil from a GPIO." },
    ],
  },
  {
    id: "epaper", name: "SPI e-paper",
    pins: [
      { name: "VCC", kind: "power3" },
      { name: "GND", kind: "gnd" },
      { name: "DIN", kind: "in" },
      { name: "CLK", kind: "in" },
      { name: "CS", kind: "in" },
      { name: "DC", kind: "in" },
      { name: "RST", kind: "in" },
      { name: "BUSY", kind: "out" },
    ],
  },
  {
    id: "buzzer", name: "Passive buzzer",
    pins: [
      { name: "+", kind: "in", note: "A passive buzzer or piezo plays tones with tone(). An active buzzer only beeps at one pitch." },
      { name: "-", kind: "gnd" },
    ],
  },
  {
    id: "pot", name: "Potentiometer",
    pins: [
      { name: "END A", kind: "power3", note: "3V3, never 5 V: the wiper would put 5 V on the GPIO." },
      { name: "WIPER", kind: "out", note: "Needs an ADC1 pin. On the classic ESP32 that is GPIO 32 to 39." },
      { name: "END B", kind: "gnd" },
    ],
  },
  {
    id: "soil", name: "Soil moisture sensor",
    pins: [
      { name: "VCC", kind: "power3", note: "Capacitive v1.2 boards run on 3.3 V, which also keeps AOUT below 3.3 V." },
      { name: "GND", kind: "gnd" },
      { name: "AOUT", kind: "out", note: "Needs an ADC1 pin. On the classic ESP32 that is GPIO 32 to 39." },
    ],
  },
  {
    id: "led", name: "LED",
    pins: [
      { name: "ANODE", kind: "in", note: "220 Ω resistor in series." },
      { name: "CATHODE", kind: "gnd" },
    ],
  },
  {
    id: "sharpir", name: "Sharp IR distance sensor",
    pins: [
      { name: "VCC", kind: "power5", note: "Needs 5 V. Put a 100 µF capacitor across VCC and GND at the sensor." },
      { name: "GND", kind: "gnd" },
      { name: "VO", kind: "out", note: "Analog, below about 3.1 V. Needs an ADC1 pin; on the classic ESP32 that is GPIO 32 to 39." },
    ],
  },
  {
    id: "mpu6050", name: "MPU-6050",
    pins: [
      { name: "VCC", kind: "power3" },
      { name: "GND", kind: "gnd" },
      { name: "SDA", kind: "bidir", bus: "sda" },
      { name: "SCL", kind: "in", bus: "scl" },
    ],
  },
  {
    id: "joystick", name: "Analog joystick",
    pins: [
      { name: "VCC", kind: "power3", note: "3V3 even if it says +5V: at 5 V the outputs could reach 5 V." },
      { name: "GND", kind: "gnd" },
      { name: "VRX", kind: "out", note: "Needs an ADC1 pin. On the classic ESP32 that is GPIO 32 to 39." },
      { name: "VRY", kind: "out", note: "Needs an ADC1 pin. On the classic ESP32 that is GPIO 32 to 39." },
      { name: "SW", kind: "out", note: "Pulls low when pressed: use INPUT_PULLUP." },
    ],
  },
  {
    id: "pir", name: "PIR motion sensor",
    pins: [
      { name: "VCC", kind: "power5", note: "The HC-SR501 needs 5 V or more to run." },
      { name: "OUT", kind: "out", note: "Goes to about 3.3 V on motion, so it is safe for the ESP32." },
      { name: "GND", kind: "gnd" },
    ],
  },
  {
    id: "ldr", name: "Photoresistor",
    pins: [
      { name: "LEG A", kind: "power3", note: "3V3, with a 10 kΩ resistor from the other leg's pin to GND." },
      { name: "LEG B", kind: "out", note: "Needs an ADC1 pin. On the classic ESP32 that is GPIO 32 to 39." },
    ],
  },
  {
    id: "lcd1602", name: "16x2 LCD (HD44780)",
    pins: [
      { name: "VDD", kind: "power5", note: "The LCD runs on 5 V. Tie RW to GND so it never drives 5 V back; contrast (V0) goes to a trimmer wiper." },
      { name: "VSS", kind: "gnd" },
      { name: "RS", kind: "in", note: "3.3 V signals are enough: the HD44780 reads 2.2 V and up as high at 5 V." },
      { name: "E", kind: "in" },
      { name: "D4", kind: "in" },
      { name: "D5", kind: "in" },
      { name: "D6", kind: "in" },
      { name: "D7", kind: "in" },
    ],
  },
  {
    id: "encoder", name: "Rotary encoder",
    pins: [
      { name: "A / CLK", kind: "out", note: "Internal pull-up. The encoder's common pin goes to GND." },
      { name: "B / DT", kind: "out" },
      { name: "SW", kind: "out", note: "Push switch to GND, internal pull-up." },
      { name: "GND", kind: "gnd" },
    ],
  },
  {
    id: "nrf24", name: "nRF24L01+ radio",
    pins: [
      { name: "VCC", kind: "power3", note: "3.3 V only: 5 V destroys it. Put 10 µF across VCC and GND at the module." },
      { name: "GND", kind: "gnd" },
      { name: "CE", kind: "in" },
      { name: "CSN", kind: "in" },
      { name: "SCK", kind: "in" },
      { name: "MOSI", kind: "in" },
      { name: "MISO", kind: "out" },
    ],
  },
  {
    id: "rgbled", name: "RGB LED",
    pins: [
      { name: "RED", kind: "in", note: "220 Ω in series on each colour." },
      { name: "GREEN", kind: "in" },
      { name: "BLUE", kind: "in" },
      { name: "COMMON", kind: "gnd", note: "Common cathode to GND. A common-anode LED goes to 3V3 instead, with the colours inverted in code." },
    ],
  },
];

export const partById = (id: string): Part | undefined => PARTS.find((p) => p.id === id);
