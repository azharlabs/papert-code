/**
 * @license
 * Copyright 2025 Papert Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineConfig } from 'vitest/config';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const timeoutMinutes = Number(process.env['TB_TIMEOUT_MINUTES'] || '5');
const testTimeoutMs = timeoutMinutes * 60 * 1000;

function hasConfiguredAuth(): boolean {
  return Boolean(process.env['OPENAI_API_KEY'] || process.env['PAPERT_OAUTH']);
}

const authConfigured = hasConfiguredAuth();
if (!authConfigured) {
  console.warn(
    '[integration-tests] No auth configured (OPENAI_API_KEY or PAPERT_OAUTH). Skipping auth-required integration tests.',
  );
}

export default defineConfig({
  test: {
    testTimeout: testTimeoutMs,
    globalSetup: './globalSetup.ts',
    reporters: ['default'],
    include: authConfigured ? ['**/*.test.ts'] : ['**/__auth_required__/*.test.ts'],
    exclude: ['**/terminal-bench/*.test.ts', '**/node_modules/**'],
    passWithNoTests: !authConfigured,
    retry: 2,
    fileParallelism: true,
    poolOptions: {
      threads: {
        minThreads: 2,
        maxThreads: 4,
      },
    },
  },
  resolve: {
    alias: {
      // Use built SDK bundle for e2e tests
      '@papert-code/sdk-typescript': resolve(
        __dirname,
        '../packages/sdk-typescript/dist/index.mjs',
      ),
    },
  },
});
