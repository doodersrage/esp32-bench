import type { APIRoute } from "astro";
import { ERRORS, GROUPS, type ErrorEntry } from "../../../data/errors";
import { errorCard } from "../../../lib/og";

export function getStaticPaths() {
  return ERRORS.map((e) => ({ params: { slug: e.slug }, props: { e } }));
}

export const GET: APIRoute = ({ props }) => {
  const e = (props as { e: ErrorEntry }).e;
  const group = GROUPS.find(([id]) => id === e.group)?.[1] ?? e.group;
  return errorCard({ title: e.title, match: e.match, group });
};
