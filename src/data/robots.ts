// Robot cars: five projects on the same two-wheel chassis and TB6612FNG motor
// driver, from driving it with a phone to balancing on two wheels. They share
// the motor pins, the motor code and the power wiring, so each build adds one
// thing to the last. Spread into PROJECTS in projects.ts.
import type { BoardId } from "./boards";
import type { Project } from "./projects";
import { BOM } from "../lib/shop";

const R = String.raw;
const ADDED = "2026-11-20";

/** Motor driver pins, the same in every robot project, and the BOOT button. */
const MOTOR_VARS: Partial<Record<BoardId, Record<string, string>>> = {
  esp32: { LPWM: "25", LINA: "26", LINB: "27", RPWM: "32", RINA: "33", RINB: "13", BTN: "0" },
  esp32s3: { LPWM: "4", LINA: "5", LINB: "6", RPWM: "7", RINA: "15", RINB: "16", BTN: "0" },
  esp32c3: { LPWM: "0", LINA: "1", LINB: "3", RPWM: "4", RINA: "5", RINB: "10", BTN: "9" },
};

/** Motor pins plus a project's own pins, per board. */
const withMotors = (extra: Partial<Record<BoardId, Record<string, string>>>): Project["vars"] =>
  Object.fromEntries(Object.entries(MOTOR_VARS).map(([b, v]) => [b, { ...v, ...extra[b as BoardId] }]));

const MOTOR_PINS = ["3V3", "GND", "%LPWM%", "%LINA%", "%LINB%", "%RPWM%", "%RINA%", "%RINB%"];

const CAR_PARTS: [number, string, string?][] = [
  [1, "ESP32 dev board", BOM.esp32DevKit],
  [1, "or ESP32-S3-DevKitC-1", BOM.esp32S3DevKitC],
  [1, "or ESP32-C3-DevKitM-1", BOM.esp32C3DevKitM],
  [1, "2WD robot car chassis with two TT gear motors and wheels", BOM.robotChassis2wd],
  [1, "TB6612FNG dual motor driver breakout", BOM.tb6612],
  [1, "4 x AA battery holder with a switch, and four AA cells", BOM.aaHolder4],
  [1, "USB power bank, small enough to ride on the chassis"],
  [1, "Mini breadboard, stuck to the chassis"],
  [16, "Jumper wires"],
];

const MOTOR_WIRING: [string, string, string][] = [
  ["TB6612 VCC", "3V3", "Power for the driver chip's logic, not the motors"],
  ["TB6612 GND", "GND", "Any of the driver's GND pins: they are joined on the board"],
  ["TB6612 STBY", "3V3", "Keeps the driver awake. Its inputs have pull-downs, so the motors stay still while the ESP32 boots"],
  ["TB6612 PWMA", "GPIO %LPWM%", "Left motor speed"],
  ["TB6612 AIN1", "GPIO %LINA%", "Left motor direction"],
  ["TB6612 AIN2", "GPIO %LINB%", "Left motor direction"],
  ["TB6612 PWMB", "GPIO %RPWM%", "Right motor speed"],
  ["TB6612 BIN1", "GPIO %RINA%", "Right motor direction"],
  ["TB6612 BIN2", "GPIO %RINB%", "Right motor direction"],
  ["Left motor + and -", "TB6612 AO1 and AO2", "Swap the two wires, or set LEFT_REVERSED, if the wheel turns backwards"],
  ["Right motor + and -", "TB6612 BO1 and BO2", "Swap them, or set RIGHT_REVERSED, if this wheel turns backwards"],
  ["Battery pack +", "TB6612 VM", "Motor power through the holder's switch, about 6 V from four AA cells. Never the ESP32's 5V or 3V3 pin"],
  ["Battery pack -", "GND", "Joins the motor battery's ground with the ESP32's. Without it the driver cannot read the ESP32's signals"],
];

const BOOT_ROW: [string, string, string] = ["BOOT button", "GPIO %BTN%", "Already on the board. Press it to start and stop"];

const POWER_NOTES = [
  "Two supplies on purpose: four AA cells run the motors, a USB power bank runs the ESP32. A motor starting up pulls the battery's voltage down for a moment, and on a shared supply that dip resets the board (the serial port shows a brownout). Join the two grounds, never the two positive wires.",
  "Do not plug the ESP32's USB into a computer while the car can drive off the desk. Prop the chassis on a box so the wheels spin in the air, or flip the battery switch off, while you test.",
];

const MOTOR_NOTES = [
  "If a wheel turns the wrong way, swap that motor's two wires at the driver, or set LEFT_REVERSED or RIGHT_REVERSED to true in the sketch.",
  "TT gear motors do not turn at all below about a quarter of full power; they only hum. MIN_DUTY is that threshold, and the sketch maps every non-zero speed above it. Raise it if a slow command hums without moving, lower it if slow is still fast.",
  "The TB6612FNG gives each motor up to 1.2 A, plenty for TT motors, and runs cool. The older L298N board also works, but it loses about 2 V inside, so the motors are slower on the same battery.",
];

/** TB6612FNG driver code shared by every robot sketch. Pins are filled per board. */
const MOTORS = R`// TB6612FNG motor driver: one PWM pin sets each motor's speed, two pins its direction.
const int LEFT_PWM = %LPWM%, LEFT_IN1 = %LINA%, LEFT_IN2 = %LINB%;     // motor A
const int RIGHT_PWM = %RPWM%, RIGHT_IN1 = %RINA%, RIGHT_IN2 = %RINB%;  // motor B
const bool LEFT_REVERSED = false;   // true if the left wheel turns backwards
const bool RIGHT_REVERSED = false;  // the same for the right wheel
const int MOTOR_HZ = 20000;         // above hearing, so the motors do not whine
const int MIN_DUTY = 70;            // TT motors only hum below about this (of 255): tune for yours

void motorsBegin() {
  const int dirPins[] = {LEFT_IN1, LEFT_IN2, RIGHT_IN1, RIGHT_IN2};
  for (int pin : dirPins) {
    pinMode(pin, OUTPUT);
    digitalWrite(pin, LOW);
  }
  ledcAttach(LEFT_PWM, MOTOR_HZ, 8);  // Arduino-ESP32 core 3.x LEDC API
  ledcAttach(RIGHT_PWM, MOTOR_HZ, 8);
  ledcWrite(LEFT_PWM, 0);
  ledcWrite(RIGHT_PWM, 0);
}

// speed from -255 (full reverse) to 255 (full forward); 0 stops.
void setMotor(int pwmPin, int in1, int in2, bool reversed, int speed) {
  speed = constrain(speed, -255, 255);
  if (reversed) speed = -speed;
  digitalWrite(in1, speed > 0 ? HIGH : LOW);
  digitalWrite(in2, speed < 0 ? HIGH : LOW);
  ledcWrite(pwmPin, speed == 0 ? 0 : map(abs(speed), 1, 255, MIN_DUTY, 255));
}

void drive(int left, int right) {
  setMotor(LEFT_PWM, LEFT_IN1, LEFT_IN2, LEFT_REVERSED, left);
  setMotor(RIGHT_PWM, RIGHT_IN1, RIGHT_IN2, RIGHT_REVERSED, right);
}

// Stick or touch position (x right, y forward, each -100 to 100) to wheel speeds.
void mix(int x, int y, int& left, int& right) {
  left = y + x;
  right = y - x;
  const int biggest = max(abs(left), abs(right));
  if (biggest > 100) {  // keep the turn, scale both down
    left = left * 100 / biggest;
    right = right * 100 / biggest;
  }
  left = left * 255 / 100;
  right = right * 255 / 100;
}`;

/** Press-to-toggle on the BOOT button, debounced. */
const BUTTON = R`const int BUTTON = %BTN%;  // the board's BOOT button

bool pressed() {
  static bool was = false;
  static unsigned long changed = 0;
  const bool down = digitalRead(BUTTON) == LOW;
  if (down != was && millis() - changed > 40) {
    was = down;
    changed = millis();
    return down;
  }
  return false;
}`;

export const ROBOT_PROJECTS: Project[] = [
  {
    id: "wifi-car", needs: [["motordriver"], ["chassis"]], name: "Phone-driven robot car", level: "Intermediate", mins: 60, tags: ["robots", "motion", "wireless"], added: ADDED,
    sum: "A two-wheel robot car that makes its own Wi-Fi network. Join it from a phone, open the page and drag a joystick to drive. It stops by itself if the phone goes quiet.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    vars: withMotors({}),
    pins: MOTOR_PINS, libs: ["WiFi (built in)", "WebServer (built in)"], baud: 115200,
    parts: CAR_PARTS,
    wiring: MOTOR_WIRING,
    code: R`// Phone-driven robot car: the ESP32 makes its own Wi-Fi network and serves a
// page with a touch joystick. The page sends the stick position ten times a
// second; if nothing arrives for half a second the car stops.
#include <WiFi.h>
#include <WebServer.h>

const char* CAR_SSID = "ESP32-Car";  // the network the car makes
const char* CAR_PASS = "drive1234";  // at least 8 characters; change it
const unsigned long TIMEOUT_MS = 500;

${MOTORS}

const char PAGE[] PROGMEM = R"HTML(<!doctype html>
<meta name=viewport content="width=device-width,initial-scale=1,user-scalable=no">
<title>ESP32 car</title>
<style>
body{margin:0;font:16px system-ui;background:#111;color:#eee;text-align:center;touch-action:none;user-select:none}
#pad{width:80vmin;height:80vmin;margin:4vmin auto;border-radius:50%;background:#222;border:2px solid #555;position:relative}
#knob{width:24%;height:24%;border-radius:50%;background:#2a7;position:absolute;left:38%;top:38%}
</style>
<p id=s>Touch the circle and drag to drive</p>
<div id=pad><div id=knob></div></div>
<script>
var pad=document.getElementById('pad'),knob=document.getElementById('knob'),s=document.getElementById('s');
var x=0,y=0,down=false,busy=false;
var place=(dx,dy)=>{knob.style.left=(38+dx*38)+'%';knob.style.top=(38-dy*38)+'%'};
var move=e=>{var r=pad.getBoundingClientRect(),h=r.width/2;
 var dx=(e.clientX-r.left-h)/h,dy=(r.top+h-e.clientY)/h,m=Math.hypot(dx,dy);
 if(m>1){dx/=m;dy/=m}
 x=Math.round(dx*100);y=Math.round(dy*100);place(dx,dy)};
pad.onpointerdown=function(e){down=true;pad.setPointerCapture(e.pointerId);move(e)};
pad.onpointermove=function(e){if(down)move(e)};
pad.onpointerup=pad.onpointercancel=function(){down=false;x=0;y=0;place(0,0)};
setInterval(function(){
 if(busy)return;busy=true;
 fetch('/drive?x='+x+'&y='+y).then(function(r){return r.text()})
  .then(function(t){s.textContent=t}).catch(function(){s.textContent='No answer from the car'})
  .finally(function(){busy=false})},100);
</script>)HTML";

WebServer server(80);
unsigned long lastCommand = 0;
bool moving = false, phone = false;
int shownLeft = 0, shownRight = 0;
unsigned long lastPrint = 0;

void handleDrive() {
  const int x = constrain(server.arg("x").toInt(), -100, 100);
  const int y = constrain(server.arg("y").toInt(), -100, 100);
  int left, right;
  mix(x, y, left, right);
  drive(left, right);
  lastCommand = millis();
  if (!phone) {
    phone = true;
    Serial.println("phone connected");
  }
  moving = left != 0 || right != 0;
  // Print changes, at most four times a second, as name = value for the plotter.
  if ((left != shownLeft || right != shownRight) && millis() - lastPrint > 250) {
    Serial.printf("x = %d, y = %d, left = %d, right = %d\n", x, y, left, right);
    shownLeft = left;
    shownRight = right;
    lastPrint = millis();
  }
  char reply[48];
  snprintf(reply, sizeof reply, "left %d%%, right %d%%", left * 100 / 255, right * 100 / 255);
  server.send(200, "text/plain", reply);
}

void setup() {
  Serial.begin(115200);
  motorsBegin();
  WiFi.mode(WIFI_AP);
  WiFi.softAP(CAR_SSID, CAR_PASS);
  server.on("/", [] { server.send_P(200, "text/html", PAGE); });
  server.on("/drive", handleDrive);
  server.begin();
  Serial.printf("Car Wi-Fi: join %s (password %s), then open http://%s/\n", CAR_SSID, CAR_PASS, WiFi.softAPIP().toString().c_str());
  Serial.println("motors stopped");
}

void loop() {
  server.handleClient();
  // Fail safe: no command for TIMEOUT_MS (phone locked, out of range, page closed) stops the car.
  if (phone && millis() - lastCommand > TIMEOUT_MS) {
    drive(0, 0);
    phone = false;
    shownLeft = shownRight = 0;
    Serial.println("no command for 0.5 s: motors stopped");
  }
}`,
    open: ["Not tested on hardware yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    notes: [
      "The car makes its own network, ESP32-Car, so it works in a park with no router. Join it from the phone, then open http://192.168.4.1/. Change CAR_PASS before you drive it anywhere public.",
      "Phones often warn that ESP32-Car has no internet and may switch back to mobile data. Choose to stay connected, or turn mobile data off while you drive.",
      "The page sends the stick position ten times a second even when it is centred. If nothing arrives for half a second, because the phone locked or went out of range, the car stops by itself.",
      "Drag up to drive forward and sideways to turn. Straight sideways spins the car on the spot, one wheel forward and one back.",
      ...POWER_NOTES,
      ...MOTOR_NOTES,
    ],
    sample: [
      "Car Wi-Fi: join ESP32-Car (password drive1234), then open http://192.168.4.1/",
      "motors stopped",
      "phone connected",
      "x = 0, y = 62, left = 158, right = 158",
      "x = 0, y = 100, left = 255, right = 255",
      "x = 41, y = 90, left = 255, right = 94",
      "x = 100, y = 0, left = 255, right = -255",
      "x = 0, y = -55, left = -140, right = -140",
      "x = 0, y = 0, left = 0, right = 0",
      "no command for 0.5 s: motors stopped",
    ],
  },
  {
    id: "remote-car", needs: [["motordriver"], ["chassis"], ["joystick"]], name: "Robot car with a joystick remote", level: "Intermediate", mins: 75, tags: ["robots", "motion", "wireless", "input"], added: ADDED,
    sum: "A second ESP32 with a thumb joystick becomes the car's remote, talking over ESP-NOW with no router and no phone. Click the stick for slow mode; the car stops if the remote goes quiet.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    vars: withMotors({
      esp32: { JX: "34", JY: "35", JB: "27" },
      esp32s3: { JX: "1", JY: "2", JB: "4" },
      esp32c3: { JX: "0", JY: "1", JB: "10" },
    }),
    pins: MOTOR_PINS, libs: ["WiFi (built in)", "esp_now (built in)"], baud: 115200,
    parts: [
      ...CAR_PARTS.slice(0, -1),
      [1, "Second ESP32 board for the remote, any of the boards listed above"],
      [1, "Analog thumb joystick with select button", BOM.thumbJoystick],
      [1, "Second USB power bank or a USB cable for the remote"],
      [21, "Jumper wires"],
    ],
    wiring: [
      ...MOTOR_WIRING,
      ["Remote: joystick +5V or VCC", "Remote 3V3", "On the second board. 3V3, not 5 V, so the stick never sends more than 3.3 V"],
      ["Remote: joystick GND", "Remote GND", ""],
      ["Remote: joystick VRx", "Remote GPIO %JX%", "An ADC1 pin: steering"],
      ["Remote: joystick VRy", "Remote GPIO %JY%", "An ADC1 pin: forward and back"],
      ["Remote: joystick SW", "Remote GPIO %JB%", "Click for slow mode. The internal pull-up does the rest"],
    ],
    code: R`// Robot car with a joystick remote. Flash this sketch to both boards: the car
// as it is, the remote with IS_REMOTE set to true. The remote broadcasts the stick
// 20 times a second over ESP-NOW; the car drives and stops if the remote goes quiet.
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>

const bool IS_REMOTE = false;  // true on the board with the joystick
const int CHANNEL = 1;         // both boards must use the same Wi-Fi channel
const uint8_t GROUP = 7;       // your own number, 1 to 255, so two cars in one room do not mix
const unsigned long TIMEOUT_MS = 300;
const uint8_t BROADCAST[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

// Remote: the joystick, on ADC1 pins.
const int JOY_X = %JX%, JOY_Y = %JY%, JOY_BTN = %JB%;
const bool FLIP_X = false;  // true if pushing right steers left
const bool FLIP_Y = false;  // true if pushing forward drives backwards
const float DEADZONE = 0.08f;

${MOTORS}

struct __attribute__((packed)) Command {
  char magic[2];  // "BC": ignore other ESP-NOW traffic
  uint8_t group;
  int8_t x, y;    // -100 to 100
  uint8_t slow;
  uint16_t seq;
};

// ---- car ----
portMUX_TYPE lock = portMUX_INITIALIZER_UNLOCKED;
Command latest = {};
unsigned long heardAt = 0;
bool connected = false;

void onReceive(const esp_now_recv_info_t* info, const uint8_t* data, int len) {
  if (len != sizeof(Command)) return;
  Command c;
  memcpy(&c, data, sizeof c);
  if (c.magic[0] != 'B' || c.magic[1] != 'C' || c.group != GROUP) return;
  portENTER_CRITICAL(&lock);
  latest = c;
  heardAt = millis();
  portEXIT_CRITICAL(&lock);
}

void carLoop() {
  portENTER_CRITICAL(&lock);
  const Command c = latest;
  const unsigned long age = millis() - heardAt;
  portEXIT_CRITICAL(&lock);

  if (heardAt == 0 || age > TIMEOUT_MS) {
    drive(0, 0);
    if (connected) Serial.println("remote lost: motors stopped");
    connected = false;
    return;
  }
  if (!connected) Serial.println("remote connected");
  connected = true;

  int left, right;
  mix(c.x, c.y, left, right);
  if (c.slow) {
    left /= 2;
    right /= 2;
  }
  drive(left, right);
  static unsigned long lastPrint = 0;
  if (millis() - lastPrint > 500) {
    lastPrint = millis();
    Serial.printf("x = %d, y = %d, left = %d, right = %d%s\n", c.x, c.y, left, right, c.slow ? ", slow" : "");
  }
}

// ---- remote ----
int centerX = 2048, centerY = 2048;
bool slow = false;
uint16_t seq = 0;

int averageRead(int pin) {
  long sum = 0;
  for (int i = 0; i < 8; i++) sum += analogRead(pin);
  return sum / 8;
}

// Stick position from -100 to 100, with the dead zone around the centre removed.
int axis(int pin, int center, bool flip) {
  const int raw = averageRead(pin);
  const float span = raw >= center ? 4095 - center : center;
  float v = (raw - center) / (span > 0 ? span : 1);
  if (fabsf(v) < DEADZONE) return 0;
  v = (fabsf(v) - DEADZONE) / (1 - DEADZONE) * (v > 0 ? 1 : -1);
  return (int)roundf(constrain(v, -1.0f, 1.0f) * (flip ? -100 : 100));
}

void remoteLoop() {
  static bool wasDown = false;
  const bool down = digitalRead(JOY_BTN) == LOW;
  if (down && !wasDown) {
    slow = !slow;
    Serial.println(slow ? "slow mode" : "full speed");
  }
  wasDown = down;

  Command c = {{'B', 'C'}, GROUP, (int8_t)axis(JOY_X, centerX, FLIP_X), (int8_t)axis(JOY_Y, centerY, FLIP_Y), slow, ++seq};
  const esp_err_t r = esp_now_send(BROADCAST, (const uint8_t*)&c, sizeof c);
  static unsigned long lastPrint = 0;
  if (millis() - lastPrint > 500) {
    lastPrint = millis();
    Serial.printf("sent x = %d, y = %d%s%s\n", c.x, c.y, slow ? ", slow" : "", r == ESP_OK ? "" : " (send failed)");
  }
  delay(50);
}

void setup() {
  Serial.begin(115200);
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  esp_wifi_set_channel(CHANNEL, WIFI_SECOND_CHAN_NONE);
  if (esp_now_init() != ESP_OK) {
    Serial.println("esp-now init failed");
    while (true) delay(1000);
  }

  if (IS_REMOTE) {
    pinMode(JOY_BTN, INPUT_PULLUP);
    analogSetPinAttenuation(JOY_X, ADC_11db);
    analogSetPinAttenuation(JOY_Y, ADC_11db);
    delay(300);  // the stick rests at its centre now: remember where that is
    centerX = averageRead(JOY_X);
    centerY = averageRead(JOY_Y);
    esp_now_peer_info_t peer = {};
    memcpy(peer.peer_addr, BROADCAST, 6);
    peer.channel = CHANNEL;
    peer.ifidx = WIFI_IF_STA;
    esp_now_add_peer(&peer);
    Serial.printf("remote ready on channel %d, group %d\n", CHANNEL, GROUP);
  } else {
    motorsBegin();
    esp_now_register_recv_cb(onReceive);
    Serial.printf("car ready on channel %d, group %d: waiting for the remote\n", CHANNEL, GROUP);
  }
}

void loop() {
  if (IS_REMOTE) remoteLoop();
  else {
    carLoop();
    delay(20);
  }
}`,
    open: ["Not tested on hardware yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    notes: [
      "One sketch, two boards. Flash it to the car unchanged, then set IS_REMOTE to true and flash the remote. Pick the remote's board on this page before copying, so its joystick pins are right for that board.",
      "Watch both at once: on the Bench page, choose Add a second board and connect the car and the remote to one monitor each, with the car's wheels off the table.",
      "The remote sends 20 times a second. The car stops by itself 0.3 s after the last message, so a flat remote battery or a walk out of range never leaves it driving.",
      "Two cars in one room? Give each pair its own GROUP number. A car ignores remotes from any other group.",
      "ESP-NOW reaches about as far as Wi-Fi does, tens of metres in the open. Raise the remote a little and keep the car's board away from the motors and batteries for the best range.",
      "If pushing forward drives backwards, set FLIP_Y to true on the remote. FLIP_X does the same for steering.",
      ...POWER_NOTES,
      ...MOTOR_NOTES,
    ],
    sample: [
      "car ready on channel 1, group 7: waiting for the remote",
      "remote connected",
      "x = 0, y = 0, left = 0, right = 0",
      "x = 0, y = 84, left = 214, right = 214",
      "x = 37, y = 100, left = 255, right = 114",
      "x = 0, y = 100, left = 127, right = 127, slow",
      "x = -100, y = 0, left = -127, right = 127, slow",
      "remote lost: motors stopped",
    ],
  },
  {
    id: "obstacle-car", needs: [["motordriver"], ["chassis"], ["hcsr04"]], name: "Obstacle-avoiding robot car", level: "Intermediate", mins: 75, tags: ["robots", "motion", "sensors"], added: ADDED,
    sum: "The robot car drives itself: an HC-SR04 on the front watches the way ahead, and when something is close the car backs up, turns and tries again. Press BOOT to start and stop.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    vars: withMotors({
      esp32: { TRIG: "18", ECHO: "19" },
      esp32s3: { TRIG: "17", ECHO: "18" },
      esp32c3: { TRIG: "6", ECHO: "7" },
    }),
    pins: [...MOTOR_PINS, "5V", "%TRIG%", "%ECHO%", "%BTN%"], libs: [], baud: 115200,
    parts: [
      ...CAR_PARTS.slice(0, -1),
      [1, "HC-SR04 ultrasonic sensor"],
      [1, "1 kΩ resistor"],
      [1, "2 kΩ resistor"],
      [20, "Jumper wires"],
    ],
    wiring: [
      ...MOTOR_WIRING,
      ["HC-SR04 VCC", "5V", "The sensor needs 5 V. The 5V pin carries the power bank's USB supply"],
      ["HC-SR04 GND", "GND", ""],
      ["HC-SR04 TRIG", "GPIO %TRIG%", ""],
      ["HC-SR04 ECHO, through 1 kΩ", "GPIO %ECHO%", "The divider's top resistor"],
      ["2 kΩ resistor", "GPIO %ECHO% to GND", "The divider's bottom resistor: drops the 5 V echo to 3.3 V"],
      BOOT_ROW,
    ],
    code: R`// Obstacle-avoiding robot car: drive forward until the HC-SR04 sees something
// close, then back up, turn and try again. BOOT starts and stops it, so it never
// drives off the desk the moment it is flashed.
// The states come first: the Arduino IDE writes function prototypes above the
// first function, and enter(State) needs State declared by then.
enum State { STOPPED, FORWARD, BACKING, TURNING };

${MOTORS}

${BUTTON}

const int TRIG = %TRIG%;
const int ECHO = %ECHO%;  // through the 1 kΩ / 2 kΩ divider

const int CRUISE = 170;         // forward speed, of 255
const int TURN_SPEED = 180;
const int STOP_CM = 25;         // closer than this is an obstacle
const unsigned long BACK_MS = 350, TURN_MS = 450;

State state = STOPPED;
unsigned long stateAt = 0, lastObstacle = 0;
int turnDir = 1;  // 1 turns right, -1 turns left

// Distance in cm, or -1 when no echo comes back (nothing within about 4 m, or no sensor).
int distanceCm() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  const unsigned long us = pulseIn(ECHO, HIGH, 25000);
  return us == 0 ? -1 : (int)(us * 0.0343f / 2);
}

void enter(State s) {
  state = s;
  stateAt = millis();
}

void setup() {
  Serial.begin(115200);
  motorsBegin();
  pinMode(BUTTON, INPUT_PULLUP);
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  randomSeed(esp_random());
  Serial.println("Obstacle car ready. Press BOOT to start, and again to stop.");
}

void loop() {
  if (pressed()) {
    if (state == STOPPED) {
      Serial.println("running");
      enter(FORWARD);
    } else {
      drive(0, 0);
      Serial.println("stopped");
      enter(STOPPED);
    }
  }

  static unsigned long lastPing = 0, lastPrint = 0;
  static int cm = -1;
  if (millis() - lastPing >= 60) {  // the HC-SR04 needs about 60 ms between pings
    lastPing = millis();
    cm = distanceCm();
    if (millis() - lastPrint >= 500) {
      lastPrint = millis();
      if (cm < 0) Serial.println("no echo");
      else Serial.printf("distance_cm = %d\n", cm);
    }
  }

  const unsigned long inState = millis() - stateAt;
  switch (state) {
    case STOPPED:
      drive(0, 0);
      break;
    case FORWARD:
      if (cm >= 0 && cm < STOP_CM) {
        // Keep turning the same way in a corner; otherwise pick a side at random.
        if (millis() - lastObstacle > 1500) turnDir = random(2) ? 1 : -1;
        lastObstacle = millis();
        Serial.printf("obstacle at %d cm: backing up\n", cm);
        enter(BACKING);
      } else {
        drive(CRUISE, CRUISE);
      }
      break;
    case BACKING:
      drive(-CRUISE, -CRUISE);
      if (inState > BACK_MS) {
        Serial.println(turnDir > 0 ? "turning right" : "turning left");
        enter(TURNING);
      }
      break;
    case TURNING:
      drive(TURN_SPEED * turnDir, -TURN_SPEED * turnDir);
      if (inState > TURN_MS) enter(FORWARD);
      break;
  }
}`,
    open: ["Not tested on hardware yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    notes: [
      "Build the HC-SR04 distance project first if you have not: it is the same sensor and divider, and it shows the sensor works before the wheels get involved.",
      "The car waits for a press of BOOT, so it does not drive away the moment it is flashed. Press again to stop. While stopped it still prints the distance, so you can check the sensor by hand.",
      "Mount the sensor at the front, level and a few centimetres up. Pointed at the floor it sees an obstacle all the time; pointed up it misses low things such as chair legs.",
      "Soft things, such as curtains and sofas, and walls met at a shallow angle send little sound back. The car may not see them: lower CRUISE so it has time to react.",
      "The 5V pin only has power when the ESP32 runs from USB, which is why the sensor shares the power bank. On the C3 SuperMini, use the pin marked 5V, not 3.3.",
      ...POWER_NOTES,
      ...MOTOR_NOTES,
    ],
    sample: [
      "Obstacle car ready. Press BOOT to start, and again to stop.",
      "distance_cm = 142",
      "running",
      "distance_cm = 96",
      "distance_cm = 51",
      "obstacle at 23 cm: backing up",
      "turning left",
      "distance_cm = 210",
      "no echo",
      "obstacle at 19 cm: backing up",
      "turning left",
      "distance_cm = 88",
      "stopped",
    ],
  },
  {
    id: "line-follower", needs: [["motordriver"], ["chassis"], ["linesensor"]], name: "Line-following robot car", level: "Intermediate", mins: 75, tags: ["robots", "motion", "sensors"], added: ADDED,
    sum: "Two IR sensors under the front of the robot car watch a black tape line, and the car steers to keep the line between them. Press BOOT to start and stop.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    vars: withMotors({
      esp32: { LL: "34", LR: "35" },
      esp32s3: { LL: "10", LR: "11" },
      esp32c3: { LL: "6", LR: "7" },
    }),
    pins: [...MOTOR_PINS, "%LL%", "%LR%", "%BTN%"], libs: [], baud: 115200,
    parts: [
      ...CAR_PARTS.slice(0, -1),
      [2, "TCRT5000 IR line sensor modules, with a digital output and a trimmer"],
      [1, "Black electrical tape, 19 mm wide, on a light floor or a sheet of card"],
      [20, "Jumper wires"],
    ],
    wiring: [
      ...MOTOR_WIRING,
      ["Both line sensors VCC", "3V3", "At 3.3 V their outputs are safe for the ESP32"],
      ["Both line sensors GND", "GND", ""],
      ["Left line sensor DO", "GPIO %LL%", "The digital output, not AO"],
      ["Right line sensor DO", "GPIO %LR%", ""],
      BOOT_ROW,
    ],
    code: R`// Line-following robot car: two IR sensors sit either side of a black line.
// While both see the light floor the car drives straight; when one sees the line
// the car turns towards that side to bring the line back between them.
${MOTORS}

${BUTTON}

const int LEFT_SENSOR = %LL%;
const int RIGHT_SENSOR = %LR%;
const bool LINE_READS_HIGH = true;  // most TCRT5000 modules: output HIGH over black

const int SPEED = 140;      // straight-line speed, of 255
const int TURN_FAST = 170;  // outside wheel in a turn
const int TURN_SLOW = -70;  // inside wheel: a little backwards turns tighter

bool running = false;
const char* lastSteer = "";

bool onLine(int pin) {
  return (digitalRead(pin) == HIGH) == LINE_READS_HIGH;
}

void setup() {
  Serial.begin(115200);
  motorsBegin();
  pinMode(BUTTON, INPUT_PULLUP);
  pinMode(LEFT_SENSOR, INPUT);
  pinMode(RIGHT_SENSOR, INPUT);
  Serial.println("Line follower ready. Set the car on the line and press BOOT.");
}

void loop() {
  if (pressed()) {
    running = !running;
    if (!running) drive(0, 0);
    Serial.println(running ? "running" : "stopped");
  }

  const bool left = onLine(LEFT_SENSOR), right = onLine(RIGHT_SENSOR);
  const char* steer = left && right ? "across" : left ? "left" : right ? "right" : "straight";
  if (running) {
    if (left && !right) drive(TURN_SLOW, TURN_FAST);       // line under the left sensor: turn left
    else if (right && !left) drive(TURN_FAST, TURN_SLOW);  // under the right one: turn right
    else drive(SPEED, SPEED);  // between the sensors, or a crossing under both: straight on
  }
  // Print changes only, so the sensors can be tuned by hand while stopped.
  if (steer != lastSteer) {
    Serial.printf("left = %d, right = %d, steer = %s\n", left, right, steer);
    lastSteer = steer;
  }
  delay(2);
}`,
    open: ["Not tested on hardware yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    notes: [
      "Set up the sensors before the motors: with the car stopped, slide it over the line by hand. Each sensor should print 1 over the tape and 0 over the floor. Turn the small trimmer on each module until it does; the module's LED also shows what it sees.",
      "Mount the sensors 5 to 10 mm above the floor, pointing straight down, a little further apart than the tape is wide. Too high and they cannot tell black from white.",
      "If both sensors read the opposite way (0 over the tape), set LINE_READS_HIGH to false.",
      "Start slow. If the car overshoots bends and loses the line, lower SPEED and TURN_FAST. Tight bends need a more negative TURN_SLOW.",
      "Shiny tape on a dark or glossy floor confuses IR sensors. Matt black tape on white card, paper or a pale floor works best. Strong sunlight can also blind them.",
      "On the classic ESP32, GPIO 34 and 35 are inputs only, which is all the sensors need. They have no internal pull-up; the modules drive the line themselves.",
      ...POWER_NOTES,
      ...MOTOR_NOTES,
    ],
    sample: [
      "Line follower ready. Set the car on the line and press BOOT.",
      "left = 0, right = 0, steer = straight",
      "running",
      "left = 1, right = 0, steer = left",
      "left = 0, right = 0, steer = straight",
      "left = 0, right = 1, steer = right",
      "left = 0, right = 0, steer = straight",
      "left = 1, right = 1, steer = across",
      "left = 0, right = 0, steer = straight",
      "stopped",
    ],
  },
  {
    id: "balance-bot", needs: [["motordriver"], ["chassis"], ["mpu6050"]], name: "Self-balancing robot", level: "Advanced", mins: 150, tags: ["robots", "motion", "sensors"], added: ADDED,
    sum: "A two-wheeled robot that stands up by itself. An MPU-6050 measures the lean 200 times a second and a PID controller drives the wheels under it. Tune it live from the serial monitor.",
    boards: ["esp32", "esp32s3", "esp32c3"],
    vars: withMotors({
      esp32: { SDA: "21", SCL: "22" },
      esp32s3: { SDA: "8", SCL: "9" },
      esp32c3: { SDA: "6", SCL: "7" },
    }),
    pins: [...MOTOR_PINS, "%SDA%", "%SCL%"], libs: ["Wire (built in)", "Preferences (built in)"], baud: 115200,
    parts: [
      [1, "ESP32 dev board", BOM.esp32DevKit],
      [1, "or ESP32-S3-DevKitC-1", BOM.esp32S3DevKitC],
      [1, "or ESP32-C3-DevKitM-1", BOM.esp32C3DevKitM],
      [1, "MPU-6050 accelerometer and gyro board, such as a GY-521", BOM.mpu6050],
      [1, "TB6612FNG dual motor driver breakout", BOM.tb6612],
      [2, "TT gear motors with wheels, from a 2WD car chassis", BOM.ttMotor],
      [1, "Tall frame: two or three plates on 60 mm standoffs, card or a 3D print, about 20 cm high"],
      [1, "4 x AA battery holder with a switch, and four AA cells", BOM.aaHolder4],
      [1, "USB power bank, small enough to ride on the chassis"],
      [16, "Jumper wires"],
    ],
    wiring: [
      ...MOTOR_WIRING,
      ["MPU-6050 VCC", "3V3", ""],
      ["MPU-6050 GND", "GND", ""],
      ["MPU-6050 SDA", "GPIO %SDA%", "The board has its own pull-up resistors"],
      ["MPU-6050 SCL", "GPIO %SCL%", ""],
    ],
    code: R`// Self-balancing robot: an MPU-6050 measures how far the robot leans, 200 times
// a second, and a PID controller drives both wheels under the lean to catch it.
// Tune it live: type kp 25, ki 40, kd 0.8 or trim -1.5 in the serial monitor,
// show to see the values, and save to keep them through a restart.
//
// Mount the MPU-6050 flat against the front of the frame, chip facing forward and
// the X arrow pointing up, so a forward lean reads as a positive angle.
#include <Wire.h>
#include <Preferences.h>

${MOTORS}

const int SDA_PIN = %SDA%;
const int SCL_PIN = %SCL%;
const uint8_t MPU = 0x68;   // 0x69 if the board's AD0 pin is tied high
const int ANGLE_SIGN = 1;   // -1 if leaning forward prints a negative angle
const int MOTOR_SIGN = 1;   // -1 if the wheels run away from the lean instead of under it
const float FALLEN = 40;    // degrees: past this the robot has fallen and the motors stop
const float ALPHA = 0.98f;  // complementary filter: 98 % gyro, 2 % accelerometer
const unsigned long LOOP_US = 5000;  // 200 times a second

float kp = 20, ki = 40, kd = 0.6, trim = 0;  // tuned over serial and saved in flash
Preferences prefs;
float gyroBias = 0, angle = 0, integral = 0;
bool balancing = false;
unsigned long lastUs = 0, uprightSince = 0, lastPrint = 0;
int output = 0;

void writeReg(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(MPU);
  Wire.write(reg);
  Wire.write(value);
  Wire.endTransmission();
}

// Lean from the accelerometer, in degrees, and lean rate from the gyro, in degrees per second.
bool readLean(float& accAngle, float& rate) {
  Wire.beginTransmission(MPU);
  Wire.write(0x3B);  // ACCEL_XOUT_H
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom(MPU, (uint8_t)14) != 14) return false;
  int16_t raw[7];
  for (int i = 0; i < 7; i++) raw[i] = (int16_t)((Wire.read() << 8) | Wire.read());
  // X points up and Z forward, so the lean is the angle between gravity and X.
  accAngle = ANGLE_SIGN * degrees(atan2f(-raw[2], raw[0]));
  rate = -ANGLE_SIGN * (raw[5] / 131.0f - gyroBias);  // gyro Y, ±250 °/s range
  return true;
}

void show() {
  Serial.printf("kp = %.1f, ki = %.1f, kd = %.2f, trim = %.1f\n", kp, ki, kd, trim);
}

// Commands from the serial monitor: "kp 25", "ki 40", "kd 0.8", "trim -1.5", "show", "save".
void handleSerial() {
  static String line;
  while (Serial.available()) {
    const char ch = Serial.read();
    if (ch != '\n' && ch != '\r') {
      if (line.length() < 32) line += ch;
      continue;
    }
    line.trim();
    if (line.length() == 0) continue;
    const int space = line.indexOf(' ');
    const String name = space < 0 ? line : line.substring(0, space);
    const float value = space < 0 ? 0 : line.substring(space + 1).toFloat();
    if (name == "kp") kp = value;
    else if (name == "ki") ki = value;
    else if (name == "kd") kd = value;
    else if (name == "trim") trim = value;
    else if (name == "save") {
      prefs.putFloat("kp", kp);
      prefs.putFloat("ki", ki);
      prefs.putFloat("kd", kd);
      prefs.putFloat("trim", trim);
      Serial.println("saved");
    } else if (name != "show") Serial.println("commands: kp, ki, kd, trim, show, save");
    integral = 0;
    show();
    line = "";
  }
}

void setup() {
  Serial.begin(115200);
  motorsBegin();
  prefs.begin("balance");
  kp = prefs.getFloat("kp", kp);
  ki = prefs.getFloat("ki", ki);
  kd = prefs.getFloat("kd", kd);
  trim = prefs.getFloat("trim", trim);

  Wire.begin(SDA_PIN, SCL_PIN, 400000);
  Wire.beginTransmission(MPU);
  if (Wire.endTransmission() != 0) {
    Serial.println("MPU-6050 not found at 0x68: check SDA, SCL, 3V3 and GND");
    while (true) delay(1000);
  }
  writeReg(0x6B, 0x00);  // PWR_MGMT_1: wake up
  writeReg(0x1A, 0x03);  // CONFIG: 44 Hz low-pass filter, less motor vibration
  writeReg(0x1B, 0x00);  // GYRO_CONFIG: ±250 °/s
  writeReg(0x1C, 0x00);  // ACCEL_CONFIG: ±2 g

  Serial.println("Calibrating gyro: lay the robot down and keep it still");
  delay(500);
  float sum = 0;
  int n = 0;
  for (int i = 0; i < 400; i++) {
    float a, r;
    if (readLean(a, r)) {
      sum += -ANGLE_SIGN * r;  // the raw gyro reading, before the bias is taken off
      n++;
    }
    delay(3);
  }
  if (n > 0) gyroBias = sum / n;
  float a, r;
  if (readLean(a, r)) angle = a;
  show();
  Serial.println("Hold the robot upright to start");
  lastUs = micros();
}

void loop() {
  handleSerial();
  const unsigned long now = micros();
  if (now - lastUs < LOOP_US) return;
  const float dt = (now - lastUs) / 1e6f;
  lastUs = now;

  float accAngle, rate;
  if (!readLean(accAngle, rate)) {
    drive(0, 0);
    if (balancing) Serial.println("MPU-6050 stopped answering: motors off");
    balancing = false;
    return;
  }
  angle = ALPHA * (angle + rate * dt) + (1 - ALPHA) * accAngle;
  const float error = angle - trim;

  if (!balancing) {
    output = 0;
    drive(0, 0);
    // Start once it has been held within 3 degrees of upright for half a second.
    if (fabsf(error) < 3) {
      if (uprightSince == 0) uprightSince = millis();
      else if (millis() - uprightSince > 500) {
        balancing = true;
        integral = 0;
        Serial.println("balancing");
      }
    } else {
      uprightSince = 0;
    }
  } else if (fabsf(error) > FALLEN) {
    balancing = false;
    uprightSince = 0;
    output = 0;
    drive(0, 0);
    Serial.println("fallen over: motors off. Stand it up to start again");
  } else {
    // PID: lean (P), lean that lasts (I) and how fast it is falling (D, straight from the gyro).
    integral = constrain(integral + error * dt, -5.0f, 5.0f);
    output = constrain((int)(kp * error + ki * integral + kd * rate), -255, 255);
    drive(output * MOTOR_SIGN, output * MOTOR_SIGN);
  }

  if (millis() - lastPrint >= 100) {
    lastPrint = millis();
    Serial.printf("angle = %.1f, output = %d\n", angle, output);
  }
}`,
    open: ["Not tested on hardware yet. Compiles for every board listed with Arduino-ESP32 core 3.3.12."],
    notes: [
      "This is the hardest build in the library: expect an evening of tuning. Build the self-levelling platform first; it uses the same MPU-6050 code and complementary filter.",
      "Frame: stack two or three plates on standoffs with the motors at the bottom and the batteries at the top. A tall robot with its weight high falls slowly, which is easier to catch, the way a broom is easier to balance on a hand than a pencil.",
      "Check the signs before tuning. Hold the robot upright and lean it forward: the angle on the serial monitor should go positive, or set ANGLE_SIGN to -1. Then lean it forward with the wheels in the air: they should spin forward, to drive under the lean. If they spin backwards, set MOTOR_SIGN to -1.",
      "Tune in this order. Type ki 0 and kd 0, then raise kp until the robot catches itself but rocks back and forth. Raise kd in small steps, 0.1 at a time, until the rocking calms down. Finally add ki to stop it creeping in one direction. Type save when it stands.",
      "If it always drifts the same way, the balance point is not at exactly zero degrees. Watch the angle while it balances and type trim with that value, such as trim -1.5.",
      "The motors stop when it leans more than 40 degrees, and start again only after it has been held upright for half a second. Still, keep fingers clear of the wheels and test on the floor, not a table.",
      "TT gear motors have some play in their gears, so the robot will always wobble a little. Smaller N20 metal-gear motors with less play balance more smoothly with the same code.",
      "Keep the loop fast: printing more than ten lines a second, or adding delay() calls, makes it react late and fall over.",
      ...POWER_NOTES,
    ],
    sample: [
      "Calibrating gyro: lay the robot down and keep it still",
      "kp = 20.0, ki = 40.0, kd = 0.60, trim = 0.0",
      "Hold the robot upright to start",
      "angle = 74.2, output = 0",
      "angle = 31.5, output = 0",
      "angle = 1.8, output = 0",
      "balancing",
      "angle = 1.2, output = 31",
      "angle = -0.6, output = -18",
      "angle = 0.3, output = 9",
      "kp = 24.0, ki = 40.0, kd = 0.60, trim = 0.0",
      "angle = -0.2, output = -6",
      "fallen over: motors off. Stand it up to start again",
      "angle = 62.0, output = 0",
    ],
  },
];
