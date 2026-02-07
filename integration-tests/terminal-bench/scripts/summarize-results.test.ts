/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { summarizeResults, toMarkdown } from './summarize-results.mjs';

describe('terminal bench summarize results', () => {
  it('aggregates pass rate by task from results.json files', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-summary-'));
    const runDir = path.join(root, 'terminal-bench-output', 'oracle-hello-world', '2026-02-07');
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(
      path.join(runDir, 'results.json'),
      JSON.stringify({ accuracy: 1, n_resolved: 1, n_unresolved: 0 }),
      'utf8',
    );

    const summary = summarizeResults(root);
    expect(summary.totalRuns).toBe(1);
    expect(summary.byTask['hello-world']).toEqual(
      expect.objectContaining({
        runs: 1,
        resolved: 1,
        total: 1,
      }),
    );

    const md = toMarkdown(summary);
    expect(md).toContain('| hello-world | 1 | 1 | 1 | 100.0% | 100.0% |');
  });
});
