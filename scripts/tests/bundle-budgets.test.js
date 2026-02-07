import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  evaluateBundleBudgets,
  summarizeBundleResults,
} from '../lib/bundleBudgets.mjs';

describe('bundle budgets', () => {
  it('passes when matching bundles are under budget', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-budget-pass-'));
    const dir = path.join(root, 'dist');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'app.js'), 'x'.repeat(100), 'utf8');

    const results = evaluateBundleBudgets({
      rootDir: root,
      budgets: [{ glob: 'dist/*.js', maxBytes: 200, description: 'js budget' }],
    });
    const summary = summarizeBundleResults(results);

    expect(results[0].pass).toBe(true);
    expect(summary.failed).toHaveLength(0);
  });

  it('fails when no bundle files match a budget', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-budget-missing-'));
    const results = evaluateBundleBudgets({
      rootDir: root,
      budgets: [{ glob: 'dist/*.js', maxBytes: 200, description: 'js budget' }],
    });
    const summary = summarizeBundleResults(results);

    expect(results[0].pass).toBe(false);
    expect(results[0].reason).toBe('no-matches');
    expect(summary.failed).toHaveLength(1);
  });
});
