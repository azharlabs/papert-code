/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'node:crypto';
import type { ScheduledJob, ScheduledJobCreate, ScheduledJobPatch } from './types.js';
import type { SchedulerServiceState } from './state.js';
import { computeNextRunAtMs } from './schedule.js';

const STUCK_RUN_MS = 2 * 60 * 60 * 1000;

export function findJobOrThrow<Payload>(
  state: SchedulerServiceState<Payload>,
  id: string,
): ScheduledJob<Payload> {
  const job = state.store?.jobs.find((j) => j.id === id);
  if (!job) throw new Error(`unknown scheduled job id: ${id}`);
  return job;
}

export function computeJobNextRunAtMs<Payload>(
  job: ScheduledJob<Payload>,
  nowMs: number,
): number | undefined {
  if (!job.enabled) return undefined;
  return computeNextRunAtMs(job.schedule, nowMs, job);
}

export function recomputeNextRuns<Payload>(state: SchedulerServiceState<Payload>): void {
  if (!state.store) return;
  const now = state.deps.nowMs();
  for (const job of state.store.jobs) {
    if (!job.state) job.state = {};
    if (!job.enabled) {
      job.state.nextRunAtMs = undefined;
      job.state.runningAtMs = undefined;
      continue;
    }
    const runningAt = job.state.runningAtMs;
    if (typeof runningAt === 'number' && now - runningAt > STUCK_RUN_MS) {
      state.deps.log.warn(
        { jobId: job.id, runningAtMs: runningAt },
        'scheduler: clearing stuck running marker',
      );
      job.state.runningAtMs = undefined;
    }
    job.state.nextRunAtMs = computeJobNextRunAtMs(job, now);
  }
}

export function nextWakeAtMs<Payload>(
  state: SchedulerServiceState<Payload>,
): number | undefined {
  const jobs = state.store?.jobs ?? [];
  const enabled = jobs.filter(
    (j) => j.enabled && typeof j.state.nextRunAtMs === 'number',
  );
  if (enabled.length === 0) return undefined;
  return enabled.reduce(
    (min, j) => Math.min(min, j.state.nextRunAtMs as number),
    enabled[0].state.nextRunAtMs as number,
  );
}

export function createJob<Payload>(
  state: SchedulerServiceState<Payload>,
  input: ScheduledJobCreate<Payload>,
): ScheduledJob<Payload> {
  const now = state.deps.nowMs();
  const id = crypto.randomUUID();
  const job: ScheduledJob<Payload> = {
    id,
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    enabled: input.enabled !== false,
    deleteAfterRun: input.deleteAfterRun,
    noOverlap: input.noOverlap,
    createdAtMs: now,
    updatedAtMs: now,
    schedule: input.schedule,
    payload: input.payload,
    sessionTarget: input.sessionTarget,
    wakeMode: input.wakeMode,
    isolation: input.isolation,
    delivery: input.delivery,
    state: {
      ...input.state,
    },
  };
  job.state.nextRunAtMs = computeJobNextRunAtMs(job, now);
  return job;
}

export function applyJobPatch<Payload>(
  job: ScheduledJob<Payload>,
  patch: ScheduledJobPatch<Payload>,
): void {
  if ('name' in patch && patch.name) job.name = patch.name.trim();
  if ('description' in patch)
    job.description = patch.description?.trim() || undefined;
  if (typeof patch.enabled === 'boolean') job.enabled = patch.enabled;
  if (typeof patch.deleteAfterRun === 'boolean')
    job.deleteAfterRun = patch.deleteAfterRun;
  if (typeof patch.noOverlap === 'boolean') job.noOverlap = patch.noOverlap;
  if (patch.schedule) job.schedule = patch.schedule;
  if (patch.payload) job.payload = patch.payload;
  if (patch.sessionTarget) job.sessionTarget = patch.sessionTarget;
  if (patch.wakeMode) job.wakeMode = patch.wakeMode;
  if (patch.isolation) job.isolation = patch.isolation;
  if (patch.delivery) job.delivery = patch.delivery;
  if (patch.state) job.state = { ...job.state, ...patch.state };
}
