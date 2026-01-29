/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { Cron } from 'croner';
import type { Schedule, ScheduledJob } from './types.js';

export function computeNextRunAtMs(
  schedule: Schedule,
  nowMs: number,
  job?: ScheduledJob,
): number | undefined {
  if (schedule.kind === 'at') {
    // One-shot jobs stay due until they successfully finish.
    if (job?.state?.lastStatus === 'ok' && job.state.lastRunAtMs) {
      return undefined;
    }
    return schedule.atMs;
  }

  if (schedule.kind === 'cron') {
    const expr = schedule.expr.trim();
    if (!expr) return undefined;
    const cron = new Cron(expr, {
      timezone: schedule.tz?.trim() || undefined,
      catch: false,
    });
    const next = cron.nextRun(new Date(nowMs));
    return next ? next.getTime() : undefined;
  }

  const everyMs = Math.max(1, Math.floor(schedule.everyMs));
  const anchor = Math.max(0, Math.floor(schedule.anchorMs ?? nowMs));
  if (nowMs < anchor) return anchor;
  const elapsed = nowMs - anchor;
  const steps = Math.max(1, Math.floor((elapsed + everyMs - 1) / everyMs));
  return anchor + steps * everyMs;
}

export function isScheduleDue(job: ScheduledJob, nowMs: number): boolean {
  if (!job.enabled) return false;
  return typeof job.state.nextRunAtMs === 'number' && nowMs >= job.state.nextRunAtMs;
}
