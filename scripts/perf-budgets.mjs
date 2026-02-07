#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadBudgets,
  evaluateBudgets,
  summarizeResults,
} from './lib/perfBudgets.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const configPath = path.resolve(__dirname, 'perf-budgets.json');

const budgets = loadBudgets(configPath);
const results = evaluateBudgets({ budgets, rootDir });
const summary = summarizeResults(results);

console.log('Performance budgets:');
for (const result of results) {
  const status = result.pass ? 'PASS' : 'FAIL';
  const actual = result.actualBytes ?? 'missing';
  const delta =
    typeof result.deltaBytes === 'number'
      ? `${result.deltaBytes >= 0 ? '+' : ''}${result.deltaBytes}`
      : 'n/a';
  console.log(
    `- [${status}] ${result.path} actual=${actual} max=${result.maxBytes} delta=${delta} :: ${result.description || 'no description'}`,
  );
}

if (summary.failed.length > 0) {
  console.error(
    `Performance budget check failed (${summary.failed.length}/${summary.totalCount} over budget).`,
  );
  process.exit(1);
}

console.log(
  `Performance budget check passed (${summary.passedCount}/${summary.totalCount}).`,
);
