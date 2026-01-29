/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { SchedulerStoreFile } from './types.js';

export async function loadSchedulerStore<Payload>(
  storePath: string,
): Promise<SchedulerStoreFile<Payload>> {
  try {
    const raw = await fs.readFile(storePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<SchedulerStoreFile<Payload>> | null;
    return {
      version: 1,
      jobs: Array.isArray(parsed?.jobs) ? (parsed?.jobs as SchedulerStoreFile<Payload>['jobs']) : [],
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { version: 1, jobs: [] };
    }
    return { version: 1, jobs: [] };
  }
}

export async function saveSchedulerStore<Payload>(
  storePath: string,
  store: SchedulerStoreFile<Payload>,
): Promise<void> {
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(store, null, 2));
}
