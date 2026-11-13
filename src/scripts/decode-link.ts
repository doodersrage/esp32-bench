// "Decode it": a crash translator line that sends the pasted log to the
// backtrace decoder, which finds library firmware's own .elf by itself.
import { elfShaIn } from "../lib/library-elf";
import { link } from "../lib/paths";

const HAS_ADDRESSES = /Backtrace:|MEPC\s*:|Guru Meditation/i;

/** A list item linking to the backtrace decoder with this log, or null when the log has no code addresses. */
export function decodeItem(log: string): HTMLLIElement | null {
  if (!HAS_ADDRESSES.test(log)) return null;
  const li = document.createElement("li");
  li.textContent = elfShaIn(log)
    ? "This crash names the firmware build it came from. If it is ESP32 Bench library firmware, the decoder fetches its .elf and shows the function and line. "
    : "With the firmware's .elf, the backtrace decoder shows which function and line crashed. ";
  const a = document.createElement("a");
  a.href = link("/tools/backtrace/");
  a.textContent = "Decode it";
  a.addEventListener("click", () => {
    try {
      sessionStorage.setItem("bench.btlog", log);
    } catch {
      // Without storage the decoder opens empty; the log can be pasted there.
    }
  });
  li.append(a);
  return li;
}
