// Every page on the site, for the sitemap and the service worker's offline copy.
import { PROJECTS } from "../data/projects";
import { ERRORS } from "../data/errors";

export const STATIC_PAGES = [
  "/",
  "/start/",
  "/boards/",
  "/wire/",
  "/detective/",
  "/bench/",
  "/errors/",
  "/flames/",
  "/about/",
  "/changes/",
];

export function allPages(): string[] {
  return [
    ...STATIC_PAGES,
    ...PROJECTS.map((p) => `/projects/${p.id}/`),
    ...ERRORS.map((e) => `/errors/${e.slug}/`),
  ];
}
