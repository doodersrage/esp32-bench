// Starter paths: short, ordered runs of library projects, each step teaching
// one thing the next one uses. Progress comes from the bench log's built marks.
// Project ids are checked against the library at build time (pages/index.astro).

export interface PathStep {
  project: string;
  /** What this step teaches, in a few words */
  learn: string;
}

export interface StarterPath {
  id: string;
  name: string;
  blurb: string;
  steps: PathStep[];
}

export const PATHS: StarterPath[] = [
  {
    id: "first-week",
    name: "Your first week",
    blurb: "From a blinking LED to a page on your phone, one evening at a time.",
    steps: [
      { project: "blink", learn: "Uploading, and reading the serial output" },
      { project: "wifi-scan", learn: "The Wi-Fi radio, with no wiring" },
      { project: "dht22", learn: "Your first sensor and library" },
      { project: "oled", learn: "I2C and a small screen" },
      { project: "ntp-clock", learn: "Getting the time from the internet" },
      { project: "web-led", learn: "Serving a web page from the board" },
    ],
  },
  {
    id: "lights-sound",
    name: "Lights and sound",
    blurb: "Quick wins that make noise and colour, and a couple of games.",
    steps: [
      { project: "touch-piano", learn: "Touch pins and tones" },
      { project: "reaction-timer", learn: "Timing a button press" },
      { project: "neopixel", learn: "Addressable LED strips" },
      { project: "fire-lamp", learn: "Animating colour" },
      { project: "simon", learn: "Game logic with buttons, LEDs and sound" },
      { project: "theremin", learn: "Turning distance into pitch" },
    ],
  },
  {
    id: "home-sensor",
    name: "A home sensor",
    blurb: "Build up to a battery sensor that reports to Home Assistant and updates over Wi-Fi.",
    steps: [
      { project: "deep-sleep", learn: "Sleeping at microamps and waking up" },
      { project: "bme280-web", learn: "A sensor dashboard in the browser" },
      { project: "mqtt-ha", learn: "MQTT and Home Assistant" },
      { project: "ota", learn: "Updating firmware over Wi-Fi" },
      { project: "battery-sensor", learn: "Putting it together on a battery" },
    ],
  },
  {
    id: "things-that-move",
    name: "Things that move",
    blurb: "Servos, relays and steppers, ending in a lock and a levelling platform.",
    steps: [
      { project: "relay-servo", learn: "Driving a servo and switching a relay" },
      { project: "joystick-turret", learn: "Analog input steering two servos" },
      { project: "stepper-28byj", learn: "Steppers with acceleration" },
      { project: "ir-sweep", learn: "Scanning with a sensor on a servo" },
      { project: "keypad-lock", learn: "A keypad, a servo latch and saved settings" },
      { project: "level-platform", learn: "Feedback control with a gyro" },
    ],
  },
];
