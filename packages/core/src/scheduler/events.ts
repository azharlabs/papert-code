/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SchedulerServiceState } from './state.js';
import type { SchedulerEvent } from './types.js';

export function emit<Payload>(
  state: SchedulerServiceState<Payload>,
  evt: SchedulerEvent,
): void {
  try {
    state.deps.onEvent?.(evt);
  } catch {
    // ignore event handler errors
  }
}
