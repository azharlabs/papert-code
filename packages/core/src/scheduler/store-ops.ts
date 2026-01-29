/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import { loadSchedulerStore, saveSchedulerStore } from './store.js';
import type { SchedulerServiceState } from './state.js';
import { recomputeNextRuns } from './jobs.js';

export async function ensureLoaded<Payload>(
  state: SchedulerServiceState<Payload>,
  opts?: { force?: boolean },
): Promise<void> {
  if (state.store && !opts?.force) return;
  const nextStore = await loadSchedulerStore<Payload>(state.deps.storePath);
  state.store = nextStore;
  recomputeNextRuns(state);
}

export async function refreshFromDisk<Payload>(
  state: SchedulerServiceState<Payload>,
): Promise<void> {
  try {
    const stat = await fs.stat(state.deps.storePath);
    const mtimeMs = stat.mtimeMs;
    if (state.lastLoadedMtimeMs !== mtimeMs) {
      await ensureLoaded(state, { force: true });
      state.lastLoadedMtimeMs = mtimeMs;
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      if (!state.store || state.store.jobs.length > 0) {
        await ensureLoaded(state, { force: true });
      }
      state.lastLoadedMtimeMs = undefined;
      return;
    }
    // Ignore stat errors; keep current store.
  }
}

export async function persist<Payload>(
  state: SchedulerServiceState<Payload>,
): Promise<void> {
  if (!state.store) return;
  await saveSchedulerStore(state.deps.storePath, state.store);
  try {
    const stat = await fs.stat(state.deps.storePath);
    state.lastLoadedMtimeMs = stat.mtimeMs;
  } catch {
    // ignore
  }
}

export function warnIfDisabled<Payload>(
  state: SchedulerServiceState<Payload>,
  action: string,
): void {
  if (state.deps.schedulerEnabled) return;
  if (state.warnedDisabled) return;
  state.warnedDisabled = true;
  state.deps.log.warn(
    { action, enabled: false },
    'scheduler: disabled, jobs will not run automatically',
  );
}
