#!/usr/bin/env tsx
/**
 * Reproducible benchmark for the deterministic ASO lint engine.
 *   npm run bench
 * Reports p50/p95/p99/mean over N runs across all fixtures — the engine that
 * powers the grade, the repair loop's validator, and the public /api/analyze.
 */
import fs from "node:fs";
import path from "node:path";
import { lint } from "../src/lib/aso-lint/index";
import type { AppListing } from "../src/lib/aso-lint/types";

const N = Number(process.env.BENCH_N ?? 5000);
const dir = path.join(process.cwd(), "data", "fixtures");
const fixtures: AppListing[] = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));

function pct(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

// warm up (JIT)
for (let i = 0; i < 500; i++) lint(fixtures[i % fixtures.length]);

const times: number[] = [];
for (let i = 0; i < N; i++) {
  const l = fixtures[i % fixtures.length];
  const t0 = performance.now();
  lint(l);
  times.push(performance.now() - t0);
}
times.sort((a, b) => a - b);

const mean = times.reduce((a, b) => a + b, 0) / times.length;
const ms = (x: number) => `${x.toFixed(4)} ms`;

console.log(`\n  ASO lint engine — ${N.toLocaleString()} runs over ${fixtures.length} fixtures\n`);
console.log(`  mean   ${ms(mean)}`);
console.log(`  p50    ${ms(pct(times, 50))}`);
console.log(`  p95    ${ms(pct(times, 95))}`);
console.log(`  p99    ${ms(pct(times, 99))}`);
console.log(`  min    ${ms(times[0])}`);
console.log(`  max    ${ms(times[times.length - 1])}`);
console.log(`  throughput  ${Math.round(1000 / mean).toLocaleString()} listings/sec\n`);
