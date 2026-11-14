// UI strings. Each area of the site has one file in src/i18n/strings/ that
// holds every language:
//
//   export const SHOP = defineStrings({
//     en: { title: "Shopping list", count: "{n} parts" },
//     es: { title: "Lista de compras", count: "{n} piezas" },
//     ...
//   });
//
// The type makes every language list every English key, so a missing
// translation fails `astro check`. {name} placeholders are filled from `vars`.
//
// In an .astro file:  const t = translator(SHOP, Astro.currentLocale);
// In a browser script: const t = translator(SHOP, pageLocale());
import { DEFAULT_LOCALE, localeOf, type Locale } from "./locales";

type Dict = Record<string, string>;
export type Strings<T extends Dict> = { en: T } & { [L in Exclude<Locale, "en">]: { [K in keyof T]: string } };

export const defineStrings = <T extends Dict>(s: Strings<T>): Strings<T> => s;

export type Translate<T extends Dict> = (key: keyof T & string, vars?: Record<string, string | number>) => string;

export function translator<T extends Dict>(strings: Strings<T>, current: string | undefined): Translate<T> {
  const locale = localeOf(current);
  const dict = strings[locale] as Dict;
  const en = strings[DEFAULT_LOCALE] as Dict;
  return (key, vars) => {
    const raw = dict[key] ?? en[key] ?? key;
    return vars ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : raw;
  };
}

/** The page's language, in a browser script (set on <html data-locale> by Base.astro). */
export const pageLocale = (): Locale => localeOf(typeof document === "undefined" ? undefined : document.documentElement.dataset.locale);
