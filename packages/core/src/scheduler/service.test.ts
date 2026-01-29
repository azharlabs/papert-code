/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { TaskScheduler } from './service.js';
import { readRunLogEntries } from './run-log.js';
import type { SchedulerLogger } from './types.js';

const logger: SchedulerLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

async function createStorePath(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'papert-scheduler-'));
  return path.join(dir, 'schedule', 'jobs.json');
}

describe('TaskScheduler', () => {
  it('schedules recurring jobs and updates next run after execution', async () => {
    const nowRef = { current: 1000 };
    const runJob = vi.fn().mockResolvedValue({ status: 'ok' as const });
    const scheduler = new TaskScheduler({
      storePath: await createStorePath(),
      log: logger,
      nowMs: () => nowRef.current,
      runJob,
    });

    const job = await scheduler.add({
      name: 'recurring',
      schedule: { kind: 'every', everyMs: 1000, anchorMs: 1000 },
      payload: { kind: 'noop' },
    });

    expect(job.state.nextRunAtMs).toBe(2000);

    nowRef.current = 2000;
    const runResult = await scheduler.run(job.id, 'due');
    expect(runResult.ok).toBe(true);
    expect(runJob).toHaveBeenCalledTimes(1);

    const [updated] = await scheduler.list({ includeDisabled: true });
    expect(updated.state.lastRunAtMs).toBe(2000);
    expect(updated.state.nextRunAtMs).toBe(3000);
  });

  it('disables one-shot jobs after a successful run', async () => {
    const nowRef = { current: 1000 };
    const scheduler = new TaskScheduler({
      storePath: await createStorePath(),
      log: logger,
      nowMs: () => nowRef.current,
      runJob: vi.fn().mockResolvedValue({ status: 'ok' as const }),
    });

    const job = await scheduler.add({
      name: 'one-shot',
      schedule: { kind: 'at', atMs: 2000 },
      payload: { kind: 'noop' },
    });

    nowRef.current = 2000;
    await scheduler.run(job.id, 'due');

    const [updated] = await scheduler.list({ includeDisabled: true });
    expect(updated.enabled).toBe(false);
    expect(updated.state.nextRunAtMs).toBeUndefined();
  });

  it('deletes one-shot jobs when deleteAfterRun is true', async () => {
    const nowRef = { current: 1000 };
    const scheduler = new TaskScheduler({
      storePath: await createStorePath(),
      log: logger,
      nowMs: () => nowRef.current,
      runJob: vi.fn().mockResolvedValue({ status: 'ok' as const }),
    });

    const job = await scheduler.add({
      name: 'delete-after-run',
      schedule: { kind: 'at', atMs: 1500 },
      deleteAfterRun: true,
      payload: { kind: 'noop' },
    });

    nowRef.current = 1500;
    await scheduler.run(job.id, 'due');

    const jobs = await scheduler.list({ includeDisabled: true });
    expect(jobs).toHaveLength(0);
  });

  it('does not run disabled jobs', async () => {
    const nowRef = { current: 1000 };
    const runJob = vi.fn().mockResolvedValue({ status: 'ok' as const });
    const scheduler = new TaskScheduler({
      storePath: await createStorePath(),
      log: logger,
      nowMs: () => nowRef.current,
      runJob,
    });

    const job = await scheduler.add({
      name: 'disabled',
      enabled: false,
      schedule: { kind: 'every', everyMs: 1000, anchorMs: 0 },
      payload: { kind: 'noop' },
    });

    nowRef.current = 5000;
    const runResult = await scheduler.run(job.id, 'due');
    expect(runResult.ran).toBe(false);
    expect(runJob).not.toHaveBeenCalled();
  });

  it('supports cron schedules', async () => {
    const nowRef = { current: Date.UTC(2026, 0, 1, 0, 0, 0) };
    const scheduler = new TaskScheduler({
      storePath: await createStorePath(),
      log: logger,
      nowMs: () => nowRef.current,
      runJob: vi.fn().mockResolvedValue({ status: 'ok' as const }),
    });

    const job = await scheduler.add({
      name: 'cron-job',
      schedule: { kind: 'cron', expr: '*/5 * * * *', tz: 'UTC' },
      payload: { kind: 'noop' },
    });

    expect(typeof job.state.nextRunAtMs).toBe('number');
  });

  it('records run history entries', async () => {
    const nowRef = { current: 1000 };
    const storePath = await createStorePath();
    const scheduler = new TaskScheduler({
      storePath,
      log: logger,
      nowMs: () => nowRef.current,
      runJob: vi.fn().mockResolvedValue({ status: 'ok' as const, summary: 'ok' }),
    });

    const job = await scheduler.add({
      name: 'history',
      schedule: { kind: 'every', everyMs: 1000, anchorMs: 0 },
      payload: { kind: 'noop' },
    });

    nowRef.current = 2000;
    await scheduler.run(job.id, 'due');

    const entries = await readRunLogEntries(storePath, job.id, { limit: 1 });
    expect(entries.length).toBe(1);
    expect(entries[0]?.jobId).toBe(job.id);
    expect(entries[0]?.status).toBe('ok');
  });
});
