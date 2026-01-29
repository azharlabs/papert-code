/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  SchedulerEvent,
  SchedulerServiceDeps,
  SchedulerStoreFile,
} from './types.js';

export type SchedulerServiceDepsInternal<Payload = unknown> = Omit<
  SchedulerServiceDeps<Payload>,
  'nowMs'
> & {
  nowMs: () => number;
  schedulerEnabled: boolean;
  maxConcurrentRuns: number;
  queuePolicy: 'queue' | 'skip';
};

export type SchedulerServiceState<Payload = unknown> = {
  deps: SchedulerServiceDepsInternal<Payload>;
  store: SchedulerStoreFile<Payload> | null;
  timer: NodeJS.Timeout | null;
  running: boolean;
  activeRuns: number;
  op: Promise<unknown>;
  warnedDisabled: boolean;
  lastLoadedMtimeMs?: number;
};

export function createSchedulerServiceState<Payload>(
  deps: SchedulerServiceDeps<Payload>,
): SchedulerServiceState<Payload> {
  return {
    deps: {
      ...deps,
      nowMs: deps.nowMs ?? (() => Date.now()),
      schedulerEnabled: deps.schedulerEnabled !== false,
      maxConcurrentRuns: Math.max(1, deps.maxConcurrentRuns ?? 1),
      queuePolicy: deps.queuePolicy ?? 'queue',
    },
    store: null,
    timer: null,
    running: false,
    activeRuns: 0,
    op: Promise.resolve(),
    warnedDisabled: false,
    lastLoadedMtimeMs: undefined,
  };
}

export type SchedulerEventHandler = (evt: SchedulerEvent) => void;
