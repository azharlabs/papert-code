/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ScheduledJob } from './types.js';
import type { SchedulerServiceState } from './state.js';
import { computeJobNextRunAtMs, nextWakeAtMs } from './jobs.js';
import { isScheduleDue } from './schedule.js';
import { locked } from './locked.js';
import { ensureLoaded, persist, refreshFromDisk } from './store-ops.js';
import { emit } from './events.js';

const MAX_TIMEOUT_MS = 2 ** 31 - 1;

export function armTimer<Payload>(state: SchedulerServiceState<Payload>): void {
  if (state.timer) clearTimeout(state.timer);
  state.timer = null;
  if (!state.deps.schedulerEnabled) return;
  const nextAt = nextWakeAtMs(state);
  if (!nextAt) return;
  const delay = Math.max(nextAt - state.deps.nowMs(), 0);
  const clampedDelay = Math.min(delay, MAX_TIMEOUT_MS);
  state.timer = setTimeout(() => {
    void onTimer(state).catch((err) => {
      state.deps.log.error({ err: String(err) }, 'scheduler: timer tick failed');
    });
  }, clampedDelay);
  state.timer.unref?.();
}

export async function onTimer<Payload>(state: SchedulerServiceState<Payload>): Promise<void> {
  if (state.running) return;
  state.running = true;
  try {
    await locked(state, async () => {
      await ensureLoaded(state);
      await refreshFromDisk(state);
      await runDueJobs(state);
      await persist(state);
      armTimer(state);
    });
  } finally {
    state.running = false;
  }
}

export async function runDueJobs<Payload>(
  state: SchedulerServiceState<Payload>,
): Promise<void> {
  if (!state.store) return;
  const now = state.deps.nowMs();
  const due = state.store.jobs.filter((j) => {
    if (!j.enabled) return false;
    if (typeof j.state.runningAtMs === 'number') return false;
    return isScheduleDue(j, now);
  });
  for (const job of due) {
    await executeJob(state, job, now, { forced: false });
  }
}

export async function executeJob<Payload>(
  state: SchedulerServiceState<Payload>,
  job: ScheduledJob<Payload>,
  nowMs: number,
  opts: { forced: boolean },
): Promise<void> {
  const startedAt = state.deps.nowMs();
  job.state.runningAtMs = startedAt;
  job.state.lastError = undefined;
  emit(state, { jobId: job.id, action: 'started', runAtMs: startedAt });

  let deleted = false;

  const finish = async (
    status: 'ok' | 'error' | 'skipped',
    err?: string,
    summary?: string,
  ) => {
    const endedAt = state.deps.nowMs();
    job.state.runningAtMs = undefined;
    job.state.lastRunAtMs = startedAt;
    job.state.lastStatus = status;
    job.state.lastDurationMs = Math.max(0, endedAt - startedAt);
    job.state.lastError = err;

    const shouldDelete =
      job.schedule.kind === 'at' && status === 'ok' && job.deleteAfterRun === true;

    if (!shouldDelete) {
      if (job.schedule.kind === 'at' && status === 'ok') {
        job.enabled = false;
        job.state.nextRunAtMs = undefined;
      } else if (job.enabled) {
        job.state.nextRunAtMs = computeJobNextRunAtMs(job, endedAt);
      } else {
        job.state.nextRunAtMs = undefined;
      }
    }

    emit(state, {
      jobId: job.id,
      action: 'finished',
      status,
      error: err,
      summary,
      runAtMs: startedAt,
      durationMs: job.state.lastDurationMs,
      nextRunAtMs: job.state.nextRunAtMs,
    });

    if (shouldDelete && state.store) {
      state.store.jobs = state.store.jobs.filter((j) => j.id !== job.id);
      deleted = true;
      emit(state, { jobId: job.id, action: 'removed' });
    }
  };

  try {
    const result = await state.deps.runJob(job);
    if (result.status === 'ok') await finish('ok', undefined, result.summary);
    else if (result.status === 'skipped')
      await finish('skipped', result.error, result.summary);
    else await finish('error', result.error ?? 'scheduled job failed', result.summary);
  } catch (err) {
    await finish('error', String(err));
  } finally {
    job.updatedAtMs = nowMs;
    if (!opts.forced && job.enabled && !deleted) {
      job.state.nextRunAtMs = computeJobNextRunAtMs(job, state.deps.nowMs());
    }
  }
}

export function stopTimer<Payload>(state: SchedulerServiceState<Payload>): void {
  if (state.timer) clearTimeout(state.timer);
  state.timer = null;
}
