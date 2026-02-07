import * as fs from 'node:fs';
import path from 'node:path';

export function loadBudgets(configPath) {
  const raw = fs.readFileSync(configPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.budgets)) {
    throw new Error('Invalid performance budgets config: missing budgets[]');
  }
  return parsed.budgets;
}

export function evaluateBudgets({ budgets, rootDir }) {
  return budgets.map((budget) => {
    const filePath = path.resolve(rootDir, budget.path);
    const exists = fs.existsSync(filePath);
    const actualBytes = exists ? fs.statSync(filePath).size : null;
    const deltaBytes =
      actualBytes === null ? null : actualBytes - Number(budget.maxBytes);
    const pass = actualBytes !== null && actualBytes <= Number(budget.maxBytes);
    return {
      ...budget,
      actualBytes,
      deltaBytes,
      pass,
    };
  });
}

export function summarizeResults(results) {
  const failed = results.filter((result) => !result.pass);
  return {
    failed,
    passedCount: results.length - failed.length,
    totalCount: results.length,
  };
}
