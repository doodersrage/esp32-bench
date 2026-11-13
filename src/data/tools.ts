// The tools listed on /tools/, also used by site search.

export interface Tool {
  href: string;
  name: string;
  sum: string;
  tags: string[];
}

export const TOOLS: Tool[] = [
  {
    href: "/tools/backtrace/",
    name: "Backtrace decoder",
    sum: "Drop in the firmware .elf, paste a Guru Meditation crash, and see which function and line each address is. Xtensa and RISC-V.",
    tags: ["Crash", "No install"],
  },
  {
    href: "/tools/build/",
    name: "Build a sketch",
    sum: "Paste an Arduino sketch, pick a board and libraries, compile it online, see errors by line and flash the result from the browser.",
    tags: ["Compile", "No install"],
  },
  {
    href: "/tools/flash/",
    name: "Flash your own firmware",
    sum: "Write your .bin files to a board from Chrome or Edge, at the right offsets for each chip. Read the chip, MAC and flash size, or erase it.",
    tags: ["Web Serial", "esptool"],
  },
  {
    href: "/tools/partitions/",
    name: "Partition table builder",
    sum: "Start from an Arduino layout, resize the app and file system, check alignment and overlaps, and export partitions.csv.",
    tags: ["Flash layout", "partitions.csv"],
  },
  {
    href: "/bench/",
    name: "Serial bench",
    sum: "A serial monitor in the browser with live plots, a Wi-Fi radar and a crash translator.",
    tags: ["Web Serial"],
  },
  {
    href: "/detective/",
    name: "Pin detective",
    sum: "Flash a helper firmware, touch a jumper from GND to any pad and see its GPIO number. Also reads the chip, flash size and MAC address.",
    tags: ["Web Serial", "Unlabelled boards"],
  },
  {
    href: "/detective/",
    name: "Pin detective",
    sum: "Flash a helper, touch a jumper from GND to any pad, and see its GPIO number.",
    tags: ["Web Serial", "Pins"],
  },
  {
    href: "/wire/",
    name: "Wiring checker",
    sum: "Wire parts to a board on screen and have every connection checked for boot pins, input-only pins and 5 V.",
    tags: ["Pins"],
  },
];
