// Which project phrases each language is missing, and which translations are
// no longer used (the English changed or went away). Missing phrases show in
// English on the page, so this reports rather than fails.
//
//   DUMP_I18N=1 npx astro build && node scripts/i18n-content.mjs [--strict]
import { existsSync, readFileSync } from "node:fs";

const dump = "dist/i18n-dump/source.json";
if (!existsSync(dump)) {
  console.error(`No ${dump}: run DUMP_I18N=1 npx astro build first.`);
  process.exit(2);
}
const byProject = JSON.parse(readFileSync(dump, "utf8"));
const phrases = new Set(Object.values(byProject).flat());
let missingTotal = 0;
for (const locale of ["es", "de", "fr", "pt-br"]) {
  const map = JSON.parse(readFileSync(`src/i18n/content/${locale}.json`, "utf8"));
  const missing = [...phrases].filter((p) => !(p in map));
  const unused = Object.keys(map).filter((k) => !phrases.has(k));
  // A translation must keep every %PLACEHOLDER% of its English.
  const broken = Object.entries(map).filter(([en, tr]) => (en.match(/%\w+%/g) ?? []).some((v) => !tr.includes(v)));
  missingTotal += missing.length + broken.length;
  console.log(`${locale}: ${phrases.size - missing.length} of ${phrases.size} phrases, ${missing.length} missing, ${unused.length} unused, ${broken.length} with a lost %PLACEHOLDER%`);
  for (const [id, list] of Object.entries(byProject)) {
    const gaps = list.filter((p) => !(p in map));
    if (gaps.length) console.log(`  ${id}: ${gaps.map((g) => JSON.stringify(g.slice(0, 60))).join(", ")}`);
  }
  for (const [en] of broken) console.log(`  placeholder lost: ${JSON.stringify(en.slice(0, 80))}`);
}
process.exit(process.argv.includes("--strict") && missingTotal > 0 ? 1 : 0);
