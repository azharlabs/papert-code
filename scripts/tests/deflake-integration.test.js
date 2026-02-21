/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  buildFlakyReport,
  extractVitestFailureSignatures,
  renderFlakyReportMarkdown,
} from '../ci/deflake-integration.mjs';

describe('deflake-integration script helpers', () => {
  it('extracts unique failure signatures from vitest output', () => {
    const output = `
 FAIL  src/a.test.ts > suite a > case 1
 FAIL  src/b.test.ts > suite b > case 2
 × suite a > case 1
`;

    expect(extractVitestFailureSignatures(output)).toEqual([
      'src/a.test.ts > suite a > case 1',
      'src/b.test.ts > suite b > case 2',
      'suite a > case 1',
    ]);
  });

  it('reports flaky signatures when retries eventually pass', () => {
    const report = buildFlakyReport('npm run test:integration:sandbox:none', [
      {
        attempt: 1,
        exitCode: 1,
        signatures: ['src/a.test.ts > suite > test'],
      },
      {
        attempt: 2,
        exitCode: 0,
        signatures: [],
      },
    ]);

    expect(report.finalExitCode).toBe(0);
    expect(report.flakySignatures).toEqual(['src/a.test.ts > suite > test']);
    expect(report.persistentFailures).toEqual([]);
  });

  it('reports persistent failures when final attempt still fails', () => {
    const report = buildFlakyReport('npm run test:integration:sandbox:none', [
      {
        attempt: 1,
        exitCode: 1,
        signatures: ['src/a.test.ts > suite > test'],
      },
      {
        attempt: 2,
        exitCode: 1,
        signatures: ['src/b.test.ts > suite > test'],
      },
    ]);

    expect(report.finalExitCode).toBe(1);
    expect(report.flakySignatures).toEqual([]);
    expect(report.persistentFailures).toEqual(['src/b.test.ts > suite > test']);
  });

  it('renders markdown summary with sections', () => {
    const markdown = renderFlakyReportMarkdown({
      command: 'npm run test:integration:sandbox:none',
      attempts: 2,
      finalExitCode: 0,
      flakySignatures: ['sig-a'],
      persistentFailures: [],
      attemptsDetail: [
        { attempt: 1, exitCode: 1, signatures: ['sig-a'] },
        { attempt: 2, exitCode: 0, signatures: [] },
      ],
      generatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(markdown).toContain('# Integration Deflake Report');
    expect(markdown).toContain('## Flaky Signatures');
    expect(markdown).toContain('- sig-a');
    expect(markdown).toContain('## Attempt Details');
  });
});
