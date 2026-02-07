#!/usr/bin/env node

import * as fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadBundleBudgets,
  evaluateBundleBudgets,
  summarizeBundleResults,
} from './lib/bundleBudgets.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const configPath = path.resolve(__dirname, 'bundle-budgets.json');

const args = process.argv.slice(2);
const outPath = (() => {
  const idx = args.indexOf('--out');
  return idx >= 0 && args[idx + 1]
    ? path.resolve(rootDir, args[idx + 1])
    : null;
})();

const budgets = loadBundleBudgets(configPath);
const results = evaluateBundleBudgets({ budgets, rootDir });
const summary = summarizeBundleResults(results);

console.log('Bundle budgets:');
for (const result of results) {
  const status = result.pass ? 'PASS' : 'FAIL';
  const actual = result.actualBytes === null ? 'missing' : result.actualBytes;
  const delta =
    typeof result.deltaBytes === 'number'
      ? `${result.deltaBytes >= 0 ? '+' : ''}${result.deltaBytes}`
      : 'n/a';
  console.log(
    `- [${status}] ${result.file} max=${result.maxBytes} actual=${actual} delta=${delta} :: ${result.description}`,
  );
}

if (outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        summary,
        results,
      },
      null,
      2,
    ),
    'utf8',
  );
  console.log(`Wrote bundle budget summary to ${outPath}`);
}

if (summary.failed.length > 0) {
  console.error(
    `Bundle budget check failed (${summary.failed.length}/${summary.totalCount} over budget).`,
  );
  process.exit(1);
}

console.log(
  `Bundle budget check passed (${summary.passedCount}/${summary.totalCount}).`,
);
