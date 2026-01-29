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
};

export type SchedulerServiceState<Payload = unknown> = {
  deps: SchedulerServiceDepsInternal<Payload>;
  store: SchedulerStoreFile<Payload> | null;
  timer: NodeJS.Timeout | null;
  running: boolean;
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
    },
    store: null,
    timer: null,
    running: false,
    op: Promise.resolve(),
    warnedDisabled: false,
    lastLoadedMtimeMs: undefined,
  };
}

export type SchedulerEventHandler = (evt: SchedulerEvent) => void;
