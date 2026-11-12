import type { APIRoute } from "astro";
import { PROJECTS, boardsOf, forBoard, type Project } from "../../../data/projects";
import { boardById } from "../../../data/boards";
import { projectCard, type Tag } from "../../../lib/og";

export function getStaticPaths() {
  return PROJECTS.map((p) => ({ params: { id: p.id }, props: { p } }));
}

export const GET: APIRoute = ({ props }) => {
  const p = (props as { p: Project }).p;
  const boards = boardsOf(p);
  // The signal pins; power and ground pads add nothing to a preview.
  const pins = forBoard(p, boards[0]).pins.filter((x) => !/^(3V3|5V|GND|VIN|EN)$/i.test(x) && !x.includes("%"));
  const meta: Tag[] = [
    { text: p.level, tone: "ink" },
    { text: `${p.mins} min` },
    { text: boards.map((b) => boardById(b).short).join(" · ") },
  ];
  if (p.flash) meta.push({ text: "Browser flash", tone: "accent" });
  if ((p.verified ?? []).length > 0) meta.push({ text: "Hardware tested", tone: "ok" });
  return projectCard({ name: p.name, sum: p.sum, meta, pins });
};
