/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

export type ScheduleEvery = {
  kind: 'every';
  everyMs: number;
  /**
   * Optional anchor time in ms. If now is before anchor, the next run is anchor.
   * Otherwise, the next run is computed as anchor + N * everyMs.
   */
  anchorMs?: number;
};

export type ScheduleAt = {
  kind: 'at';
  atMs: number;
};

export type Schedule = ScheduleEvery | ScheduleAt;

export type ScheduledJobState = {
  nextRunAtMs?: number;
  lastRunAtMs?: number;
  lastStatus?: 'ok' | 'error' | 'skipped';
  lastError?: string;
  lastDurationMs?: number;
  runningAtMs?: number;
};

export type ScheduledJob<Payload = unknown> = {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  deleteAfterRun?: boolean;
  createdAtMs: number;
  updatedAtMs: number;
  schedule: Schedule;
  payload: Payload;
  state: ScheduledJobState;
};

export type ScheduledJobCreate<Payload = unknown> = {
  name: string;
  description?: string;
  enabled?: boolean;
  deleteAfterRun?: boolean;
  schedule: Schedule;
  payload: Payload;
  state?: ScheduledJobState;
};

export type ScheduledJobPatch<Payload = unknown> = {
  name?: string;
  description?: string;
  enabled?: boolean;
  deleteAfterRun?: boolean;
  schedule?: Schedule;
  payload?: Payload;
  state?: ScheduledJobState;
};

export type SchedulerLogger = {
  debug: (obj: unknown, msg?: string) => void;
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
};

export type SchedulerEvent = {
  jobId: string;
  action: 'added' | 'updated' | 'removed' | 'started' | 'finished';
  runAtMs?: number;
  durationMs?: number;
  status?: 'ok' | 'error' | 'skipped';
  error?: string;
  summary?: string;
  nextRunAtMs?: number;
};

export type SchedulerRunResult = {
  status: 'ok' | 'error' | 'skipped';
  summary?: string;
  error?: string;
};

export type SchedulerStatusSummary = {
  enabled: boolean;
  storePath: string;
  jobs: number;
  nextWakeAtMs: number | null;
};

export type SchedulerServiceDeps<Payload = unknown> = {
  nowMs?: () => number;
  log: SchedulerLogger;
  storePath: string;
  schedulerEnabled?: boolean;
  runJob: (job: ScheduledJob<Payload>) => Promise<SchedulerRunResult>;
  onEvent?: (evt: SchedulerEvent) => void;
};

export type SchedulerStoreFile<Payload = unknown> = {
  version: 1;
  jobs: ScheduledJob<Payload>[];
};
