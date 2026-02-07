import * as fs from 'node:fs';
import path from 'node:path';
import { globSync } from 'glob';

export function loadBundleBudgets(configPath) {
  const raw = fs.readFileSync(configPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.budgets)) {
    throw new Error('Invalid bundle budgets config: missing budgets[]');
  }
  return parsed.budgets;
}

export function evaluateBundleBudgets({ budgets, rootDir }) {
  const results = [];
  for (const budget of budgets) {
    const files = globSync(budget.glob, {
      cwd: rootDir,
      nodir: true,
      absolute: true,
    });
    if (files.length === 0) {
      results.push({
        ...budget,
        file: '(none)',
        actualBytes: null,
        deltaBytes: null,
        pass: false,
        reason: 'no-matches',
      });
      continue;
    }

    for (const file of files) {
      const stat = fs.statSync(file);
      const deltaBytes = stat.size - Number(budget.maxBytes);
      results.push({
        ...budget,
        file: path.relative(rootDir, file),
        actualBytes: stat.size,
        deltaBytes,
        pass: stat.size <= Number(budget.maxBytes),
        reason: 'evaluated',
      });
    }
  }
  return results;
}

export function summarizeBundleResults(results) {
  const failed = results.filter((item) => !item.pass);
  return {
    totalCount: results.length,
    passedCount: results.length - failed.length,
    failed,
  };
}
