/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

export const TERMINAL_BENCH_TASKS = [
  'hello-world',
  'json-profile-update',
  'markdown-release-notes',
  'swe-bench-astropy-1',
] as const;

export type TerminalBenchTaskId = (typeof TERMINAL_BENCH_TASKS)[number];

export function resolveTerminalBenchTasks(options: {
  taskId?: string;
  taskIds?: string;
}): TerminalBenchTaskId[] {
  const { taskId, taskIds } = options;
  if (!taskId && !taskIds) {
    return [...TERMINAL_BENCH_TASKS];
  }

  const requested = (taskIds || taskId || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const available = new Set<string>(TERMINAL_BENCH_TASKS);
  const unknown = requested.filter((value) => !available.has(value));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown TB task id(s): ${unknown.join(', ')}. Available: ${TERMINAL_BENCH_TASKS.join(', ')}`,
    );
  }

  const selected = TERMINAL_BENCH_TASKS.filter((task) =>
    requested.includes(task),
  );
  if (selected.length === 0) {
    throw new Error('No tasks selected via TB_TASK_ID/TB_TASK_IDS.');
  }

  return selected;
}
