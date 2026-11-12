// Every page on the site, for the sitemap and the service worker's offline copy.
import { PROJECTS } from "../data/projects";

export const STATIC_PAGES = [
  "/",
  "/start/",
  "/boards/",
  "/wire/",
  "/detective/",
  "/bench/",
  "/flames/",
  "/about/",
  "/changes/",
];

export function allPages(): string[] {
  return [...STATIC_PAGES, ...PROJECTS.map((p) => `/projects/${p.id}/`)];
}
