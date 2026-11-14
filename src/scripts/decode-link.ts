// "Decode it": a crash translator line that sends the pasted log to the
// backtrace decoder, which finds library firmware's own .elf by itself.
import { elfShaIn } from "../lib/library-elf";
import { localLink } from "../lib/paths";
import { pageLocale, translator } from "../i18n/t";
import { BENCH } from "../i18n/strings/bench";

const HAS_ADDRESSES = /Backtrace:|MEPC\s*:|Guru Meditation/i;

/** A list item linking to the backtrace decoder with this log, or null when the log has no code addresses. */
export function decodeItem(log: string): HTMLLIElement | null {
  if (!HAS_ADDRESSES.test(log)) return null;
  const li = document.createElement("li");
  const t = translator(BENCH, pageLocale());
  li.textContent = `${elfShaIn(log) ? t("decodeNamed") : t("decodeElf")} `;
  const a = document.createElement("a");
  a.href = localLink(pageLocale())("/tools/backtrace/");
  a.textContent = t("decodeIt");
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
