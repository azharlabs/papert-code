/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineConfig } from 'vitest/config';

const timeoutMinutes = Number(process.env.TB_TIMEOUT_MINUTES || '30');
const testTimeoutMs = timeoutMinutes * 60 * 1000;

export default defineConfig({
  test: {
    testTimeout: testTimeoutMs,
    globalSetup: './globalSetup.ts',
    reporters: ['default'],
    include: ['**/terminal-bench/*.test.ts'],
    retry: 2,
    fileParallelism: false,
  },
});
