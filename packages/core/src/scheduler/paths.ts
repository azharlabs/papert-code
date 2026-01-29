/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as path from 'node:path';
import { Storage } from '../config/storage.js';

export const SCHEDULER_DIRNAME = 'schedule';
export const SCHEDULER_STORE_FILENAME = 'jobs.json';

export function resolveSchedulerStorePath(cwd: string): string {
  const storage = new Storage(cwd);
  return path.join(storage.getProjectDir(), SCHEDULER_DIRNAME, SCHEDULER_STORE_FILENAME);
}
