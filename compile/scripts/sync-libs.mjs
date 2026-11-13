// Copies the site's library list (src/data/compile-libs.json, the single source of
// truth shared with the firmware builds and the editor's library picker) into the
// container build context, where the image build and the Worker both read it.
//
//   node scripts/sync-libs.mjs [path/to/compile-libs.json]
//
// Run it before `cf deploy`; `--check` exits non-zero if the copy is out of date.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const check = args.includes("--check");
const source = resolve(args.find((a) => !a.startsWith("--")) ?? join(here, "..", "..", "src", "data", "compile-libs.json"));
const target = join(here, "..", "container", "compile-libs.json");

if (!existsSync(source)) {
	console.error(`No library list at ${source}`);
	process.exit(2);
}
const data = JSON.parse(readFileSync(source, "utf8"));
if (!data.libs || typeof data.libs !== "object" || !Array.isArray(data.hugeApp)) {
	console.error(`${source} must have "libs" (name to registry id) and "hugeApp" (project ids).`);
	process.exit(2);
}
const text = JSON.stringify(data, null, 2) + "\n";
const current = existsSync(target) ? readFileSync(target, "utf8") : "";
if (check) {
	if (current !== text) {
		console.error(`compile/container/compile-libs.json is out of date with ${source}. Run node scripts/sync-libs.mjs.`);
		process.exit(1);
	}
	console.log("library list in sync");
} else {
	writeFileSync(target, text);
	console.log(`copied ${Object.keys(data.libs).length} libraries from ${source}${current === text ? " (unchanged)" : ""}`);
}
