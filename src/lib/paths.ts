import { localeOf, localePath } from "../i18n/locales";

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

/** Prefix an absolute site path with the configured `base`. */
export const link = (path: string): string => `${base}${path}`;

// Pages that exist in every language. The rest (board pages, the error guide,
// the hall of flames, the changelog) are English only, as are files.
const ENGLISH_ONLY = /^\/(boards|errors|flames|changes)\//;
export const isTranslatedPage = (path: string): boolean => {
  const page = path.split(/[?#]/)[0];
  return page.endsWith("/") && !ENGLISH_ONLY.test(page);
};

/** `link` for one language: translated pages get the language prefix, everything else stays as it is. */
export const localLink =
  (current: string | undefined) =>
  (path: string): string =>
    link(isTranslatedPage(path) ? localePath(path, localeOf(current)) : path);
