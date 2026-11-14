// Project write-ups in other languages. Every piece of project prose (name,
// summary, parts, wiring, notes, settings, the per-board phrases in `vars`) is
// looked up by its English text in src/i18n/content/<locale>.json, so a
// phrase used by many projects ("Jumper wires") is translated once. Anything
// missing falls back to English. Sketch code, pin names and serial output are
// never translated: they must match what the board prints and what the
// silkscreen says.
//
// `DUMP_I18N=1 npx astro build` writes every phrase to
// dist/i18n-dump/source.json; `node scripts/i18n-content.mjs` lists the ones a
// language is missing or no longer uses.
import es from "./content/es.json";
import de from "./content/de.json";
import fr from "./content/fr.json";
import ptBr from "./content/pt-br.json";
import { localeOf, type Locale } from "./locales";
import { kitItem } from "../lib/kit";
import type { Project } from "../data/projects";
import { LAB_EXPECT } from "../data/lab-expect";

const MAPS: Record<Exclude<Locale, "en">, Record<string, string>> = { es, de, fr, "pt-br": ptBr };

/** Pin names, pin numbers and placeholders: the same in every language. */
const isProse = (s: string): boolean => /[a-z]{2}/.test(s.replace(/%\w+%/g, "")) && !/^(GPIO\s*)?%?\w+%?$/.test(s);

/** Every phrase of a project that a translation should cover, in page order. */
export function projectPhrases(p: Project): string[] {
  const out: string[] = [p.name, p.sum];
  for (const part of p.parts) out.push(part[1], kitItem(part).label);
  for (const row of p.wiring) out.push(...row);
  for (const vars of Object.values(p.vars ?? {})) out.push(...Object.values(vars ?? {}));
  for (const s of p.settings ?? []) out.push(s.label, ...(s.hint ? [s.hint] : []));
  out.push(...(p.open ?? []), ...(p.notes ?? []), ...(p.flash?.after ?? []), ...(p.verified ?? []).map((v) => v.what));
  if (p.extraCode) out.push(p.extraCode.title);
  const lab = LAB_EXPECT[p.id];
  if (lab?.notes) out.push(lab.notes);
  return [...new Set(out.map((s) => s.trim()).filter((s) => s && isProse(s)))];
}

/** Translate project prose into one language; English, or a missing phrase, comes back as it is. */
export function contentTranslator(current: string | undefined): (english: string) => string {
  const locale = localeOf(current);
  if (locale === "en") return (s) => s;
  const map = MAPS[locale];
  return (s) => map[s.trim()] ?? s;
}
