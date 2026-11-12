import type { APIRoute } from "astro";
import { BOARDS, type Board } from "../../../data/boards";
import { CHIPS } from "../../../data/chips";
import { padRows } from "../../../lib/pins";
import { boardCard, type PadTone, type Tag } from "../../../lib/og";

export function getStaticPaths() {
  return BOARDS.map((b) => ({ params: { id: b.id }, props: { b } }));
}

export const GET: APIRoute = ({ props }) => {
  const b = (props as { b: Board }).b;
  const chip = CHIPS[b.chip];
  const rows = padRows(b);
  const safe = new Set(rows.filter((r) => r.verdict.level === "safe").map((r) => r.gpio)).size;
  const side = (s: "Left" | "Right"): PadTone[] => rows.filter((r) => r.side === s).map((r) => r.verdict.level);
  const pads = rows.length ? [side("Left"), side("Right")] : [];
  const meta: Tag[] = [{ text: chip.name, tone: "ink" }];
  if (rows.length) meta.push({ text: `${safe} safe GPIOs`, tone: "ok" }, { text: `${rows.length} pads` });
  else meta.push({ text: "Pin map" });
  meta.push(b.tested ? { text: "Hardware tested", tone: "ok" } : { text: "From vendor docs" });
  return boardCard({
    name: rows.length ? `${b.name} pinout` : `${b.name} pin map`,
    sum: `${chip.cpu}. ${chip.wireless}.`.replace(/\.\.+/g, "."),
    meta,
    pads,
  });
};
