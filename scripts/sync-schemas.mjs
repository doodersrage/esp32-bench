// Copy the desktop app's shared schemas into public/schema/, where their $id URLs
// point (https://esp32bench.dev/schema/<name>/v1.schema.json). The esp32-desktop
// repository's schema/ is the only copy anyone edits; run this after changing one:
//   node scripts/sync-schemas.mjs ../esp32-desktop
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const desktop = process.argv[2];
if (!desktop) {
  console.error("usage: node scripts/sync-schemas.mjs <esp32-desktop checkout>");
  process.exit(2);
}
for (const name of ["project-manifest", "circuit", "part-model"]) {
  const from = join(desktop, "schema", name, "v1.schema.json");
  const id = JSON.parse(readFileSync(from, "utf8")).$id;
  if (id !== `https://esp32bench.dev/schema/${name}/v1.schema.json`) throw new Error(`${from}: $id is ${id}`);
  mkdirSync(join("public", "schema", name), { recursive: true });
  copyFileSync(from, join("public", "schema", name, "v1.schema.json"));
  console.log(`public/schema/${name}/v1.schema.json`);
}
