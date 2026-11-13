// "What you'll need" kit card for each project: /og/kits/<id>.png
import type { APIRoute } from "astro";
import { PROJECTS, type Project } from "../../../data/projects";
import { kitFor } from "../../../lib/kit";
import { kitCard } from "../../../lib/og";

export function getStaticPaths() {
  return PROJECTS.map((p) => ({ params: { id: p.id }, props: { p } }));
}

export const GET: APIRoute = ({ props }) => {
  const p = (props as { p: Project }).p;
  return kitCard({ name: p.name, items: kitFor(p.parts) });
};
