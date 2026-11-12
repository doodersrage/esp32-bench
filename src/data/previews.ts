// "Try it" previews: which projects have one, what to tell the visitor, and how
// much room to reserve so nothing on the page moves when the preview loads.
// The code for each preview is in src/scripts/previews/<id>.ts.

export interface PreviewInfo {
  /** One line telling the visitor what to do */
  hint: string;
  /** Height in px to reserve before the preview loads */
  height: number;
  /** The preview can make sound (shows a sound switch) */
  sound?: boolean;
}

export const PREVIEWS: Record<string, PreviewInfo> = {
  oled: { hint: "The status screen the sketch draws, with the uptime counting.", height: 254 },
  "oled-pong": { hint: "Play it: move your mouse or finger over the screen, or use the arrow keys, to steer the left paddle.", height: 254 },
  dice: { hint: "Press Roll, or the space bar, to tumble the two dice as the button would.", height: 262 },
  "ntp-clock": { hint: "The clock face, showing your own time as the board would after syncing.", height: 260 },
  "ph-display": { hint: "Demo readings cycle as they would on the display; below-freezing ones flash.", height: 254 },
  "fire-lamp": { hint: "30 LEDs running the sketch's fire. The button switches to the lava lamp, like BOOT.", height: 94 },
  neopixel: { hint: "Eight LEDs running the sketch's colour wipe, rainbow and theater chase.", height: 128 },
  simon: { hint: "Play it: watch the sequence, then repeat it with clicks, taps or the keys 1 to 4.", height: 334, sound: true },
  "reaction-timer": { hint: "Press Start, wait for the LED, then press the button or the space bar as fast as you can.", height: 146 },
  "morse-decoder": { hint: "Hold the key (or the space bar): short for a dot, long for a dash. Try SOS.", height: 190, sound: true },
  "visitor-counter": { hint: "Wave at the sensor to count a visitor. It ignores waves within 2 seconds of the last one.", height: 318, sound: true },
  theremin: { hint: "Move your pointer or finger across the beam: closer to the sensor is a higher note.", height: 216, sound: true },
  "ir-sweep": { hint: "The servo sweeps and maps what the sensor sees. Drag the obstacles to move them.", height: 336 },
  "level-platform": { hint: "Tilt the base with your pointer or the arrow keys; the servos keep the plate level.", height: 302 },
  "joystick-turret": { hint: "Drag the stick or use the arrow keys; the turret turns at up to 120 degrees a second.", height: 306 },
};
