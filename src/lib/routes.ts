// Every page on the site, for the sitemap and the service worker's offline copy.
import { PROJECTS } from "../data/projects";
import { ERRORS } from "../data/errors";
import { BOARDS } from "../data/boards";

export const STATIC_PAGES = [
  "/",
  "/start/",
  "/boards/",
  "/boards/compare/",
  "/wire/",
  "/detective/",
  "/bench/",
  "/errors/",
  "/tools/",
  "/tools/backtrace/",
  "/tools/flash/",
  "/tools/partitions/",
  "/flames/",
  "/about/",
  "/report/",
  "/search/",
  "/changes/",
];

export function allPages(): string[] {
  return [
    ...STATIC_PAGES,
    ...BOARDS.map((b) => `/boards/${b.id}/`),
    ...PROJECTS.map((p) => `/projects/${p.id}/`),
    ...ERRORS.map((e) => `/errors/${e.slug}/`),
  ];
}
