#!/usr/bin/env tsx
/**
 * Terminal ASO linter — the same 28-rule engine that powers the app.
 *
 *   npm run aso-lint -- data/fixtures/pocketplants.json
 */
import fs from "node:fs";
import { lint } from "../src/lib/aso-lint/index";
import { AppListingSchema } from "../src/lib/schemas/listing";

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run aso-lint -- <listing.json>");
  process.exit(2);
}

const raw = JSON.parse(fs.readFileSync(file, "utf8"));
const parsed = AppListingSchema.safeParse(raw);
if (!parsed.success) {
  console.error("Invalid listing:");
  for (const i of parsed.error.issues) {
    console.error(`  ${i.path.join(".")}: ${i.message}`);
  }
  process.exit(2);
}

const r = lint(parsed.data);
const icon = { critical: "✖", warn: "▲", info: "ℹ" } as const;

console.log(`\n  ${parsed.data.appName} — ASO score ${r.score}/100 (${r.grade})\n`);
for (const [field, s] of Object.entries(r.fieldStats)) {
  console.log(`  ${field.padEnd(18)} ${s.used}/${s.max} chars`);
}
console.log("");
for (const f of r.findings) {
  console.log(`  ${icon[f.severity]} [${f.ruleId}] ${f.message}`);
  console.log(`     fix: ${f.fix}\n`);
}
if (r.findings.length === 0) console.log("  No findings — ship it.\n");

process.exit(r.grade === "F" ? 1 : 0);
