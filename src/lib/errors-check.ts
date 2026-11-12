// Build-time guard for src/data/errors.ts. The error pages call this from
// getStaticPaths, so the build fails if the reference and the crash
// translator in src/lib/crash.ts drift apart.
import { ERRORS } from "../data/errors";
import { explainLog } from "./crash";

export function checkErrors(): void {
  const problems: string[] = [];
  const slugs = new Set<string>();
  for (const e of ERRORS) {
    if (slugs.has(e.slug)) problems.push(`duplicate slug "${e.slug}"`);
    slugs.add(e.slug);
  }
  for (const e of ERRORS) {
    const found = explainLog(e.example.join("\n")).map((x) => x.key);
    for (const key of e.keys ?? []) {
      if (!found.includes(key)) {
        problems.push(`"${e.slug}": the crash translator no longer reports "${key}" for its example (got ${found.join(", ") || "nothing"})`);
      }
    }
    for (const r of e.related) if (!slugs.has(r)) problems.push(`"${e.slug}": related slug "${r}" does not exist`);
  }
  if (problems.length > 0) {
    throw new Error(`src/data/errors.ts is out of step with src/lib/crash.ts:\n- ${problems.join("\n- ")}`);
  }
}
