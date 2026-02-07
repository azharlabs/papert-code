/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  TERMINAL_BENCH_TASKS,
  resolveTerminalBenchTasks,
} from './taskCatalog.js';

describe('terminal bench task catalog', () => {
  it('returns all tasks when no env selection is provided', () => {
    expect(resolveTerminalBenchTasks({})).toEqual([...TERMINAL_BENCH_TASKS]);
  });

  it('supports comma-separated task selection', () => {
    expect(resolveTerminalBenchTasks({ taskIds: 'hello-world,json-profile-update' })).toEqual([
      'hello-world',
      'json-profile-update',
    ]);
  });

  it('throws for unknown task IDs', () => {
    expect(() =>
      resolveTerminalBenchTasks({ taskIds: 'hello-world,unknown-task' }),
    ).toThrow(/Unknown TB task id\(s\): unknown-task/);
  });
});
