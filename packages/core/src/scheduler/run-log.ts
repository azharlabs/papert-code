/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export type SchedulerRunLogEntry = {
  jobId: string;
  runAtMs: number;
  status: 'ok' | 'error' | 'skipped';
  durationMs?: number;
  error?: string;
  summary?: string;
  nextRunAtMs?: number;
};

export function resolveRunLogPath(storePath: string, jobId: string): string {
  const baseDir = path.join(path.dirname(storePath), 'runs');
  return path.join(baseDir, `${jobId}.jsonl`);
}

export async function appendRunLogEntry(
  storePath: string,
  entry: SchedulerRunLogEntry,
): Promise<void> {
  const logPath = resolveRunLogPath(storePath, entry.jobId);
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  await fs.appendFile(logPath, `${JSON.stringify(entry)}\n`);
}

export async function readRunLogEntries(
  storePath: string,
  jobId: string,
  opts?: { limit?: number },
): Promise<SchedulerRunLogEntry[]> {
  const logPath = resolveRunLogPath(storePath, jobId);
  try {
    const raw = await fs.readFile(logPath, 'utf8');
    const lines = raw.split('\n').filter(Boolean);
    const parsed = lines
      .map((line) => {
        try {
          return JSON.parse(line) as SchedulerRunLogEntry;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as SchedulerRunLogEntry[];
    if (opts?.limit && parsed.length > opts.limit) {
      return parsed.slice(-opts.limit);
    }
    return parsed;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    return [];
  }
}
