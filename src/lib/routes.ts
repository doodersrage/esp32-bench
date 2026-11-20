// Every page on the site, for the sitemap and the service worker's offline copy.
import { PROJECTS } from "../data/projects";
import { ERRORS } from "../data/errors";
import { BOARDS } from "../data/boards";

export const STATIC_PAGES = [
  "/",
  "/start/",
  "/boards/",
  "/boards/compare/",
  "/boards/matrix/",
  "/wire/",
  "/detective/",
  "/bench/",
  "/errors/",
  "/tools/",
  "/tools/backtrace/",
  "/tools/build/",
  "/tools/flash/",
  "/tools/partitions/",
  "/flames/",
  "/about/",
  "/desktop/",
  "/report/",
  "/search/",
  "/changes/",
  "/shop/",
  "/prints/",
  "/prints/make/",
];

export function allPages(): string[] {
  return [
    ...STATIC_PAGES,
    ...BOARDS.map((b) => `/boards/${b.id}/`),
    ...PROJECTS.map((p) => `/projects/${p.id}/`),
    ...ERRORS.map((e) => `/errors/${e.slug}/`),
  ];
}
