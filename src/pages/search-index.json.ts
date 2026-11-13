// Site search index, built from the data modules. Fetched by the header search
// box and /search/ the first time someone searches.
import type { APIRoute } from "astro";
import { PROJECTS, boardsOf } from "../data/projects";
import { BOARDS, boardById } from "../data/boards";
import { CHIPS } from "../data/chips";
import { ERRORS, GROUPS } from "../data/errors";
import { FLAMES } from "../data/flames";
import { TOOLS } from "../data/tools";
import { padRows, wiredRows } from "../lib/pins";
import { link } from "../lib/paths";
import { packIndex, type Entry } from "../lib/search";

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, s.lastIndexOf(" ", n - 1))}...` : s);
const uniq = (words: string[]) => [...new Set(words.filter(Boolean))].join(" ");

const PAGES: [string, string, string, string][] = [
  ["/", "Project library", "Every project with pinouts, wiring tables, parts lists and sketches.", "projects library build tonight drawer parts badges bench log"],
  ["/start/", "Getting started", "Cables, drivers, Linux permissions, the Arduino IDE and a first upload.", "guide beginner setup install"],
  ["/boards/", "Boards", "Pinouts for every supported ESP32 board.", "pinout pins header"],
  ["/boards/compare/", "Compare the ESP32 chips", "ESP32, S2, S3, C3 and C6 side by side.", "comparison wifi 6 bluetooth thread zigbee gpio adc touch dac usb cpu riscv xtensa"],
  ["/wire/", "Wiring pad", "Wire parts to a board on screen and have every wire checked.", "wiring checker breadboard remix boot pins 5v"],
  ["/detective/", "Pin detective", "Touch a jumper from GND to a pad and see its GPIO number.", "find pin gpio number passport mac address flash size chip"],
  ["/bench/", "Serial bench", "A serial monitor in the browser with plots, a Wi-Fi radar and a crash translator.", "serial monitor web serial baud plotter radar crash translator console"],
  ["/errors/", "Error reference", "Crash, reset, boot and upload errors explained.", "errors guru meditation panic reset upload"],
  ["/tools/", "Tools", "Backtrace decoder, flasher, partition builder and more.", "tools"],
  ["/flames/", "Hall of flames", "Real ESP32 failures and what was actually wrong.", "failures debugging stories"],
  ["/about/", "About ESP32 Bench", "How projects are tested, privacy, buy links and credits.", "about privacy affiliate license probeharbor"],
  ["/changes/", "What's new", "Release notes, newest first. Also an RSS feed.", "changelog release notes rss news"],
  ["/report/", "Send a report", "Build reports, corrections and messages, sent by email.", "contact feedback build report correction email"],
];

const GUIDE: [string, string, string][] = [
  ["need", "What you need", "board usb data cable charge only chrome edge opera"],
  ["board", "Pick a board", "esp32 s3 c3 which board choose"],
  ["plug", "Plug it in: drivers and Linux permissions", "driver cp2102 cp210x ch340 ch343 ch9102 windows macos linux dialout uucp brltty snap raw usb permission denied port"],
  ["check", "Check it talks", "bench connect port com ttyusb ttyacm cu usbserial poweron reset"],
  ["ide", "Set up the Arduino IDE", "arduino ide boards manager url espressif esp32 dev module usb cdc on boot"],
  ["upload", "First upload", "upload connecting boot button en download mode blink"],
  ["next", "What next", "next projects"],
];

export const GET: APIRoute = () => {
  const entries: Entry[] = [];

  for (const [url, title, snippet, text] of PAGES) entries.push({ title, url: link(url), kind: "Page", snippet, text });
  for (const [id, title, text] of GUIDE) {
    entries.push({ title, url: link(`/start/#${id}`), kind: "Guide", snippet: "Getting started guide", text });
  }

  for (const p of PROJECTS) {
    const boards = boardsOf(p).map((id) => boardById(id).name);
    entries.push({
      title: p.name,
      url: link(`/projects/${p.id}/`),
      kind: "Project",
      snippet: clip(p.sum, 120),
      text: uniq([p.id, p.level, ...p.tags, ...p.libs, ...p.parts.map(([, what]) => what), ...boards].map((s) => s.replace(/\(built in\)/, ""))),
    });
  }

  for (const b of BOARDS) {
    const chip = CHIPS[b.chip];
    entries.push({
      title: b.name,
      url: link(`/boards/${b.id}/`),
      kind: "Board",
      snippet: `${chip.name} pinout. Arduino board: ${b.arduinoBoard}.`,
      text: uniq([b.id, b.short, chip.name, chip.wireless, "pinout pins gpio", b.tested ? "hardware tested" : "", ...b.notes.map((n) => clip(n, 80))]),
    });

    const seen = new Set<number>();
    const pins =
      b.left.length > 0
        ? padRows(b).map((r) => ({ gpio: r.gpio, label: r.silk ?? r.label, functions: r.functions, note: `${r.verdict.label}: ${r.verdict.why}` }))
        : wiredRows(b).map((w) => ({ gpio: w.gpio as number | null, label: String(w.gpio), functions: w.functions, note: `Wired to ${w.job}` }));
    for (const pin of pins) {
      if (pin.gpio === null || seen.has(pin.gpio)) continue;
      seen.add(pin.gpio);
      const silk = pin.label !== String(pin.gpio) ? ` (${pin.label})` : "";
      entries.push({
        title: `GPIO ${pin.gpio}${silk}`,
        url: link(`/boards/${b.id}/#gpio-${pin.gpio}`),
        kind: "Pin",
        snippet: clip(`${b.name}. ${[pin.functions.join(", "), pin.note].filter(Boolean).join(". ")}`, 150),
        text: uniq([b.short, chip.name, pin.functions.join(" ")]),
      });
    }
  }

  const groupName = Object.fromEntries(GROUPS.map(([id, name]) => [id, name]));
  for (const e of ERRORS) {
    entries.push({
      title: e.title,
      url: link(`/errors/${e.slug}/`),
      kind: "Error",
      snippet: clip(e.means, 130),
      text: uniq([e.match, groupName[e.group] ?? "", e.slug.replace(/-/g, " ")]),
    });
  }

  for (const t of TOOLS.filter((t) => !PAGES.some(([href]) => href === t.href))) entries.push({ title: t.name, url: link(t.href), kind: "Tool", snippet: t.sum, text: t.tags.join(" ") });

  for (const f of FLAMES) {
    entries.push({
      title: f.title,
      url: link(`/flames/#${f.id}`),
      kind: "Flame",
      snippet: clip(f.cause, 130),
      text: uniq([f.board, clip(f.mistaken, 100), f.log.slice(0, 3).join(" ").slice(0, 160)]),
    });
  }

  return new Response(JSON.stringify(packIndex(entries)), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
};
