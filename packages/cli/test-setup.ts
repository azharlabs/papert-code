/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

// Unset NO_COLOR environment variable to ensure consistent theme behavior between local and CI test runs
if (process.env['NO_COLOR'] !== undefined) {
  delete process.env['NO_COLOR'];
}

// Vitest coverage writes worker output under coverage/.tmp.
// Ensure this directory exists to avoid ENOENT on parallel runs.
mkdirSync(join(process.cwd(), 'coverage', '.tmp'), { recursive: true });

import './src/test-utils/customMatchers.js';
