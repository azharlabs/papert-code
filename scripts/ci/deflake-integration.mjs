#!/usr/bin/env node
/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

function parseArgs(argv) {
  const args = {
    command: '',
    attempts: 3,
    outJson: '.artifacts/deflake/report.json',
    outMd: '.artifacts/deflake/report.md',
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token) {
      continue;
    }

    if (token === '--command') {
      args.command = argv[index + 1] || '';
      index += 1;
      continue;
    }

    if (token === '--attempts') {
      const parsed = Number.parseInt(argv[index + 1] || '', 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        args.attempts = parsed;
      }
      index += 1;
      continue;
    }

    if (token === '--out-json') {
      args.outJson = argv[index + 1] || args.outJson;
      index += 1;
      continue;
    }

    if (token === '--out-md') {
      args.outMd = argv[index + 1] || args.outMd;
      index += 1;
      continue;
    }
  }

  return args;
}

export function extractVitestFailureSignatures(output) {
  const signatures = new Set();
  const lines = output.split('\n');
  for (const line of lines) {
    const trimmed = line
      .replace(/\u001b\[[0-9;]*m/g, '')
      .replace(/\u001b\[[0-9;]*K/g, '')
      .trim();
    const failMatch = trimmed.match(/^FAIL\s+(.+)$/);
    if (failMatch && failMatch[1]) {
      signatures.add(failMatch[1]);
      continue;
    }
    const testMatch = trimmed.match(/^(?:×|✖|❯|>)\s+(.+)$/);
    if (testMatch && testMatch[1]) {
      signatures.add(testMatch[1]);
      continue;
    }
    const errorMatch = trimmed.match(/^Error:\s+(.+)$/);
    if (errorMatch && errorMatch[1]) {
      signatures.add(`Error: ${errorMatch[1]}`);
    }
  }
  return [...signatures].sort();
}

export function buildFlakyReport(command, results) {
  const finalResult = results[results.length - 1] ?? {
    attempt: 1,
    exitCode: 1,
    signatures: [],
  };
  const failedAttempts = results.filter((result) => result.exitCode !== 0);
  const flakySignatures = finalResult.exitCode === 0
    ? [
        ...new Set(
          failedAttempts.flatMap((result) => result.signatures),
        ),
      ].sort()
    : [];
  const persistentFailures = finalResult.exitCode === 0
    ? []
    : [...new Set(finalResult.signatures)].sort();

  return {
    command,
    attempts: results.length,
    finalExitCode: finalResult.exitCode,
    flakySignatures,
    persistentFailures,
    attemptsDetail: results,
    generatedAt: new Date().toISOString(),
  };
}

export function renderFlakyReportMarkdown(report) {
  const status = report.finalExitCode === 0 ? 'PASS' : 'FAIL';
  const lines = [
    '# Integration Deflake Report',
    '',
    `- Status: **${status}**`,
    `- Command: \`${report.command}\``,
    `- Attempts: ${report.attempts}`,
    `- Generated: ${report.generatedAt}`,
    '',
    '## Flaky Signatures',
  ];

  if (report.flakySignatures.length === 0) {
    lines.push('- none');
  } else {
    for (const signature of report.flakySignatures) {
      lines.push(`- ${signature}`);
    }
  }

  lines.push('', '## Persistent Failures');
  if (report.persistentFailures.length === 0) {
    lines.push('- none');
  } else {
    for (const signature of report.persistentFailures) {
      lines.push(`- ${signature}`);
    }
  }

  lines.push('', '## Attempt Details');
  for (const attempt of report.attemptsDetail) {
    lines.push(
      `- Attempt ${attempt.attempt}: exit=${attempt.exitCode}, signatures=${attempt.signatures.length}`,
    );
  }

  return `${lines.join('\n')}\n`;
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function runCommandAttempt(command) {
  const child = spawnSync(command, {
    shell: true,
    encoding: 'utf8',
    stdio: 'pipe',
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  });
  const exitCode = typeof child.status === 'number' ? child.status : 1;
  const combinedOutput = `${child.stdout ?? ''}\n${child.stderr ?? ''}`;
  return { exitCode, output: combinedOutput };
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.command) {
    console.error(
      'Missing --command. Example: node scripts/ci/deflake-integration.mjs --command "npm run test:integration:sandbox:none"',
    );
    process.exit(2);
  }

  const results = [];
  let finalExitCode = 1;

  for (let attempt = 1; attempt <= args.attempts; attempt += 1) {
    console.log(`[deflake] attempt ${attempt}/${args.attempts}: ${args.command}`);
    const attemptResult = runCommandAttempt(args.command);
    finalExitCode = attemptResult.exitCode;
    const signatures = extractVitestFailureSignatures(attemptResult.output);

    ensureParentDir(args.outJson);
    const attemptLogPath = path.join(
      path.dirname(args.outJson),
      `attempt-${attempt}.log`,
    );
    fs.writeFileSync(attemptLogPath, attemptResult.output, 'utf8');

    results.push({
      attempt,
      exitCode: attemptResult.exitCode,
      signatures,
      logPath: attemptLogPath,
    });

    console.log(
      `[deflake] attempt ${attempt} exit=${attemptResult.exitCode} signatures=${signatures.length}`,
    );

    if (attemptResult.exitCode === 0) {
      break;
    }
  }

  const report = buildFlakyReport(args.command, results);
  const markdown = renderFlakyReportMarkdown(report);

  ensureParentDir(args.outJson);
  ensureParentDir(args.outMd);
  fs.writeFileSync(args.outJson, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(args.outMd, markdown, 'utf8');

  if (report.flakySignatures.length > 0) {
    for (const signature of report.flakySignatures) {
      console.log(`::warning::Flaky test signature detected: ${signature}`);
    }
  }

  if (report.persistentFailures.length > 0) {
    for (const signature of report.persistentFailures) {
      console.log(`::error::Persistent failure signature: ${signature}`);
    }
  }

  process.exit(finalExitCode);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
