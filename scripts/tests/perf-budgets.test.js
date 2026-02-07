import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { evaluateBudgets, summarizeResults } from '../lib/perfBudgets.mjs';

describe('perf budgets', () => {
  it('marks files as passing when size is within budget', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-budget-pass-'));
    const filePath = path.join(tempRoot, 'sample.ts');
    fs.writeFileSync(filePath, 'const a = 1;\n');

    const results = evaluateBudgets({
      rootDir: tempRoot,
      budgets: [{ path: 'sample.ts', maxBytes: 100, description: 'sample' }],
    });
    const summary = summarizeResults(results);

    expect(results[0].pass).toBe(true);
    expect(summary.failed).toHaveLength(0);
  });

  it('marks files as failing when size exceeds budget', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-budget-fail-'));
    const filePath = path.join(tempRoot, 'large.ts');
    fs.writeFileSync(filePath, 'x'.repeat(200));

    const results = evaluateBudgets({
      rootDir: tempRoot,
      budgets: [{ path: 'large.ts', maxBytes: 64, description: 'large' }],
    });
    const summary = summarizeResults(results);

    expect(results[0].pass).toBe(false);
    expect(results[0].deltaBytes).toBe(136);
    expect(summary.failed).toHaveLength(1);
  });
});
