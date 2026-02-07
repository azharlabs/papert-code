#!/usr/bin/env node

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

function walk(dir) {
  const result = [];
  if (!fs.existsSync(dir)) return result;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...walk(full));
    } else if (entry.isFile() && entry.name === 'results.json') {
      result.push(full);
    }
  }
  return result;
}

function inferTaskId(filePath) {
  const match = filePath.match(/(?:oracle|papert)-([^/]+)\/[^/]+\/results\.json$/);
  return match?.[1] || 'unknown-task';
}

function parseResult(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  const taskId = inferTaskId(filePath);
  const resolved = Number(parsed.n_resolved || 0);
  const unresolved = Number(parsed.n_unresolved || 0);
  const total = resolved + unresolved || 1;
  const accuracy =
    typeof parsed.accuracy === 'number' ? parsed.accuracy : resolved / total;
  return { taskId, resolved, total, accuracy, filePath };
}

export function summarizeResults(baseDir) {
  const resultFiles = walk(baseDir);
  const runs = resultFiles.map(parseResult);

  /** @type {Record<string, {resolved:number,total:number,runs:number,avgAccuracy:number}>} */
  const byTask = {};
  for (const run of runs) {
    const item = byTask[run.taskId] || {
      resolved: 0,
      total: 0,
      runs: 0,
      avgAccuracy: 0,
    };
    item.resolved += run.resolved;
    item.total += run.total;
    item.runs += 1;
    item.avgAccuracy += run.accuracy;
    byTask[run.taskId] = item;
  }

  for (const taskId of Object.keys(byTask)) {
    const item = byTask[taskId];
    item.avgAccuracy = item.runs > 0 ? item.avgAccuracy / item.runs : 0;
  }

  return {
    generatedAt: new Date().toISOString(),
    totalRuns: runs.length,
    byTask,
    runs,
  };
}

export function toMarkdown(summary) {
  const lines = [
    '# Terminal-Bench Summary',
    '',
    `Generated: ${summary.generatedAt}`,
    `Runs: ${summary.totalRuns}`,
    '',
    '| Task | Runs | Resolved | Total | Pass Rate | Avg Accuracy |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
  ];
  Object.entries(summary.byTask)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([taskId, item]) => {
      const passRate = item.total > 0 ? item.resolved / item.total : 0;
      lines.push(
        `| ${taskId} | ${item.runs} | ${item.resolved} | ${item.total} | ${(passRate * 100).toFixed(1)}% | ${(item.avgAccuracy * 100).toFixed(1)}% |`,
      );
    });
  return lines.join('\n') + '\n';
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const args = process.argv.slice(2);
  const arg = (name, fallback) => {
    const idx = args.indexOf(name);
    return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
  };

  const base = arg('--base', '.integration-tests');
  const outJson = arg('--out-json', '.integration-tests/terminal-bench-summary.json');
  const outMd = arg('--out-md', '.integration-tests/terminal-bench-summary.md');

  const summary = summarizeResults(base);
  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.mkdirSync(path.dirname(outMd), { recursive: true });
  fs.writeFileSync(outJson, JSON.stringify(summary, null, 2), 'utf8');
  fs.writeFileSync(outMd, toMarkdown(summary), 'utf8');

  console.log(
    `Summarized ${summary.totalRuns} run(s) across ${Object.keys(summary.byTask).length} task(s).`,
  );
}
