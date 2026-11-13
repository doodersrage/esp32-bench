// Run:  node --experimental-strip-types tests/flash-hook.test.ts
// The Flasher component reads ESP Web Tools' private dialog state when the
// install dialog closes, to record finished flashes for the bench log. This
// checks the installed version still keeps that state where Flasher looks.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dialog = readFileSync("node_modules/esp-web-tools/dist/install-dialog.js", "utf8");
const event = readFileSync("node_modules/esp-web-tools/dist/util/fire-event.js", "utf8");

assert.match(dialog, /this\._installState = state;/, "the dialog stores the flash state in _installState");
assert.match(dialog, /_installState\.state === "finished"/, "a finished flash has state \"finished\"");
assert.match(dialog, /fireEvent\(this, "closed"\)/, "the dialog fires \"closed\"");
assert.match(event, /bubbles: options\.bubbles === undefined \? true/, "dialog events bubble by default");
console.log("flash hook: 4 checks passed");
