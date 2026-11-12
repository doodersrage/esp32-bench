import type { APIRoute } from "astro";
import { toolCard, type Tag } from "../../../lib/og";

/** Preview cards for /tools/ and each tool page. */
export const TOOL_CARDS: Record<string, { name: string; sum: string; meta: Tag[] }> = {
  index: {
    name: "ESP32 tools in your browser",
    sum: "Decode crashes, flash your own firmware and build partition tables. Nothing to install.",
    meta: [{ text: "Backtrace decoder" }, { text: "Web flasher" }, { text: "Partition builder" }],
  },
  backtrace: {
    name: "ESP32 backtrace decoder",
    sum: "Drop in your .elf, paste a Guru Meditation crash, get function names and line numbers.",
    meta: [{ text: "Xtensa + RISC-V", tone: "ink" }, { text: "No install", tone: "ok" }, { text: "Runs in your browser" }],
  },
  flash: {
    name: "Flash your own ESP32 firmware",
    sum: "Write .bin files from Chrome or Edge at the right offsets for each chip, or erase the flash.",
    meta: [{ text: "Web Serial", tone: "ink" }, { text: "esptool-js" }, { text: "ESP32 · S2 · S3 · C3 · C6" }],
  },
  partitions: {
    name: "ESP32 partition table builder",
    sum: "Start from an Arduino layout, resize the app and file system, check it fits, export partitions.csv.",
    meta: [{ text: "partitions.csv", tone: "pad" }, { text: "4, 8 and 16 MB" }, { text: "Overlap checks", tone: "ok" }],
  },
};

export function getStaticPaths() {
  return Object.keys(TOOL_CARDS).map((id) => ({ params: { id } }));
}

export const GET: APIRoute = ({ params }) => toolCard(TOOL_CARDS[params.id as string]);
