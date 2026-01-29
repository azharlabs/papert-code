/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ScheduledJobCreate,
  ScheduledJobPatch,
  SchedulerStatusSummary,
} from './types.js';
import type { SchedulerServiceDeps } from './types.js';
import { createSchedulerServiceState } from './state.js';
import type { SchedulerServiceState } from './state.js';
import { locked } from './locked.js';
import { ensureLoaded, persist, refreshFromDisk, warnIfDisabled } from './store-ops.js';
import {
  applyJobPatch,
  computeJobNextRunAtMs,
  createJob,
  findJobOrThrow,
  nextWakeAtMs,
  recomputeNextRuns,
} from './jobs.js';
import { armTimer, executeJob, stopTimer } from './timer.js';
import { emit } from './events.js';
import { isScheduleDue } from './schedule.js';

export class TaskScheduler<Payload = unknown> {
  private readonly state: SchedulerServiceState<Payload>;

  constructor(deps: SchedulerServiceDeps<Payload>) {
    this.state = createSchedulerServiceState(deps);
  }

  async start(): Promise<void> {
    await locked(this.state, async () => {
      if (!this.state.deps.schedulerEnabled) {
        this.state.deps.log.info({ enabled: false }, 'scheduler: disabled');
        return;
      }
      await ensureLoaded(this.state);
      recomputeNextRuns(this.state);
      await persist(this.state);
      armTimer(this.state);
      this.state.deps.log.info(
        {
          enabled: true,
          jobs: this.state.store?.jobs.length ?? 0,
          nextWakeAtMs: nextWakeAtMs(this.state) ?? null,
        },
        'scheduler: started',
      );
    });
  }

  stop(): void {
    stopTimer(this.state);
  }

  async status(): Promise<SchedulerStatusSummary> {
    return await locked(this.state, async () => {
      await ensureLoaded(this.state);
      await refreshFromDisk(this.state);
      return {
        enabled: this.state.deps.schedulerEnabled,
        storePath: this.state.deps.storePath,
        jobs: this.state.store?.jobs.length ?? 0,
        nextWakeAtMs: this.state.deps.schedulerEnabled
          ? nextWakeAtMs(this.state) ?? null
          : null,
        running: this.state.activeRuns,
      };
    });
  }

  async list(opts?: { includeDisabled?: boolean }) {
    return await locked(this.state, async () => {
      await ensureLoaded(this.state);
      await refreshFromDisk(this.state);
      const includeDisabled = opts?.includeDisabled === true;
      const jobs = (this.state.store?.jobs ?? []).filter(
        (j) => includeDisabled || j.enabled,
      );
      return jobs.sort(
        (a, b) => (a.state.nextRunAtMs ?? 0) - (b.state.nextRunAtMs ?? 0),
      );
    });
  }

  async add(input: ScheduledJobCreate<Payload>) {
    return await locked(this.state, async () => {
      warnIfDisabled(this.state, 'add');
      await ensureLoaded(this.state);
      const job = createJob(this.state, input);
      this.state.store?.jobs.push(job);
      await persist(this.state);
      armTimer(this.state);
      emit(this.state, {
        jobId: job.id,
        action: 'added',
        nextRunAtMs: job.state.nextRunAtMs,
      });
      return job;
    });
  }

  async update(id: string, patch: ScheduledJobPatch<Payload>) {
    return await locked(this.state, async () => {
      warnIfDisabled(this.state, 'update');
      await ensureLoaded(this.state);
      const job = findJobOrThrow(this.state, id);
      const now = this.state.deps.nowMs();
      applyJobPatch(job, patch);
      job.updatedAtMs = now;
      if (job.enabled) {
        job.state.nextRunAtMs = computeJobNextRunAtMs(job, now);
      } else {
        job.state.nextRunAtMs = undefined;
        job.state.runningAtMs = undefined;
      }
      await persist(this.state);
      armTimer(this.state);
      emit(this.state, {
        jobId: id,
        action: 'updated',
        nextRunAtMs: job.state.nextRunAtMs,
      });
      return job;
    });
  }

  async remove(id: string) {
    return await locked(this.state, async () => {
      warnIfDisabled(this.state, 'remove');
      await ensureLoaded(this.state);
      const before = this.state.store?.jobs.length ?? 0;
      if (!this.state.store) return { ok: false, removed: false } as const;
      this.state.store.jobs = this.state.store.jobs.filter((j) => j.id !== id);
      const removed = (this.state.store.jobs.length ?? 0) !== before;
      await persist(this.state);
      armTimer(this.state);
      if (removed) emit(this.state, { jobId: id, action: 'removed' });
      return { ok: true, removed } as const;
    });
  }

  async run(id: string, mode?: 'due' | 'force') {
    return await locked(this.state, async () => {
      warnIfDisabled(this.state, 'run');
      await ensureLoaded(this.state);
      const job = findJobOrThrow(this.state, id);
      const now = this.state.deps.nowMs();
      const due = mode === 'force' ? true : isScheduleDue(job, now);
      if (!due) return { ok: true, ran: false, reason: 'not-due' } as const;
      await executeJob(this.state, job, now, { forced: mode === 'force' });
      await persist(this.state);
      armTimer(this.state);
      return { ok: true, ran: true } as const;
    });
  }
}
