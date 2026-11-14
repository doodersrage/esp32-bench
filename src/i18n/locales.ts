// The site's languages. English is the original and lives at the root; the
// others are machine-translated and live under /<code>/. Keep in step with
// `i18n.locales` in astro.config.mjs.

export const LOCALES = ["en", "es", "de", "fr", "pt-br"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** For <html lang> and hreflang */
export const HTML_LANG: Record<Locale, string> = { en: "en", es: "es", de: "de", fr: "fr", "pt-br": "pt-BR" };

/** Each language's name in itself, for the language menu */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
  de: "Deutsch",
  fr: "Français",
  "pt-br": "Português (Brasil)",
};

export const isLocale = (x: unknown): x is Locale => typeof x === "string" && (LOCALES as readonly string[]).includes(x);

/** The locale Astro worked out from the URL, defaulting to English. */
export const localeOf = (current: string | undefined): Locale => (isLocale(current) ? current : DEFAULT_LOCALE);

/** getStaticPaths for a page that exists in every language: { lang: undefined } is English at the root. */
export const localePaths = () => LOCALES.map((l) => ({ params: { lang: l === DEFAULT_LOCALE ? undefined : l }, props: { locale: l } }));

/** Cross a page's own static paths with every language. */
export function withLocales<P extends Record<string, string | undefined>, Q>(paths: { params: P; props?: Q }[]) {
  return LOCALES.flatMap((l) =>
    paths.map((p) => ({ params: { ...p.params, lang: l === DEFAULT_LOCALE ? undefined : l }, props: { ...(p.props ?? ({} as Q)), locale: l } })),
  );
}

/** Add the language prefix to a site path ("/shop/" becomes "/de/shop/"). */
export const localePath = (path: string, locale: Locale): string => (locale === DEFAULT_LOCALE ? path : `/${locale}${path}`);

/** Strip a language prefix from a site path, for language switch links. */
export function unlocalePath(path: string): { locale: Locale; path: string } {
  const m = /^\/([a-z]{2}(?:-[a-z]{2})?)(\/.*)?$/.exec(path);
  if (m && isLocale(m[1]) && m[1] !== DEFAULT_LOCALE) return { locale: m[1], path: m[2] ?? "/" };
  return { locale: DEFAULT_LOCALE, path };
}
