// llms.txt (https://llmstxt.org): a plain map of the site for AI assistants and
// answer engines, built from the same data as the pages.
import type { APIRoute } from "astro";
import { PROJECTS } from "../data/projects";
import { BOARDS } from "../data/boards";
import { ERRORS } from "../data/errors";
import { SITE, absolute } from "../lib/site";

export const GET: APIRoute = ({ site }) => {
  const url = (path: string) => absolute(path, site);
  const lines = [
    `# ${SITE.name}`,
    "",
    `> ${SITE.description}`,
    "",
    "Every project page has a parts list with quantities, a wiring table (board pin to part pin), the Arduino sketch, the serial output it prints when it works, and prebuilt firmware that flashes from the browser over Web Serial. Pin numbers are GPIO numbers. Projects are compiled for every board they list on every firmware build; some are also tested on real boards in a hardware lab, which their page says.",
    "",
    "Pages are in English; projects and tools are also machine-translated into Spanish (/es/), German (/de/), French (/fr/) and Brazilian Portuguese (/pt-br/).",
    "",
    "## Projects",
    "",
    ...PROJECTS.map((p) => `- [${p.name}](${url(`/projects/${p.id}/`)}): ${p.sum} (${p.level}, about ${p.mins} minutes)`),
    "",
    "## Boards",
    "",
    ...BOARDS.map((b) => `- [${b.name}](${url(`/boards/${b.id}/`)}): pinout with every pin's functions and whether it is safe to use`),
    `- [Compare ESP32 chips](${url("/boards/compare/")})`,
    `- [Which project runs on which board](${url("/boards/matrix/")})`,
    "",
    "## ESP32 errors explained",
    "",
    ...ERRORS.map((e) => `- [${e.title}](${url(`/errors/${e.slug}/`)}): ${e.means.split(". ")[0].replace(/\.$/, "")}.`),
    "",
    "## Tools in the browser",
    "",
    `- [Serial monitor](${url("/bench/")}): Web Serial monitor with crash highlighting and a plotter`,
    `- [Wiring checker](${url("/wire/")}): checks a planned pin choice for boot, flash and input-only pins`,
    `- [Pin detective](${url("/detective/")}): flash a helper and touch a pad to find its GPIO number`,
    `- [Backtrace decoder](${url("/tools/backtrace/")}): crash addresses to file and line with your .elf`,
    `- [Web flasher](${url("/tools/flash/")}): flash your own .bin from the browser`,
    `- [Build a sketch](${url("/tools/build/")}): compile an Arduino sketch online and flash it`,
    `- [Partition table builder](${url("/tools/partitions/")}): make a partitions.csv`,
    "",
    "## Optional",
    "",
    `- [Getting started with the ESP32](${url("/start/")})`,
    `- [Hall of flames: real ESP32 failures](${url("/flames/")})`,
    `- [About, privacy and buy links](${url("/about/")})`,
    `- [What's new](${url("/changes/")})`,
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
