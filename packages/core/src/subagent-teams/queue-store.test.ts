/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { TeamQueueStore, createQueuePaths } from './queue-store.js';
import type { TeamQueueMessage } from './types.js';

describe('TeamQueueStore', () => {
  let tmpRoot: string | null = null;

  afterEach(async () => {
    if (tmpRoot) {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
    tmpRoot = null;
  });

  async function createStore() {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'papert-team-queue-'));
    const paths = createQueuePaths(tmpRoot, 'dev', randomUUID());
    return new TeamQueueStore(paths);
  }

  it('moves incoming files to processing and acks them', async () => {
    const store = await createStore();
    await store.ensureReady();
    const message: TeamQueueMessage = {
      id: randomUUID(),
      conversationId: randomUUID(),
      agent: 'coder',
      message: 'fix bug',
      createdAt: Date.now(),
    };
    await store.enqueueIncoming(message);
    const batch = await store.dequeueIncomingBatch();
    expect(batch).toHaveLength(1);
    expect(batch[0].message.agent).toBe('coder');
    await store.ackProcessing(batch[0].filePath);
    const batchAfterAck = await store.dequeueIncomingBatch();
    expect(batchAfterAck).toHaveLength(0);
  });

  it('recovers processing files back to incoming', async () => {
    const store = await createStore();
    await store.ensureReady();
    const message: TeamQueueMessage = {
      id: randomUUID(),
      conversationId: randomUUID(),
      agent: 'reviewer',
      message: 'review code',
      createdAt: Date.now(),
    };
    await store.enqueueIncoming(message);
    const batch = await store.dequeueIncomingBatch();
    expect(batch).toHaveLength(1);
    await store.recoverProcessingToIncoming();
    const recovered = await store.dequeueIncomingBatch();
    expect(recovered).toHaveLength(1);
    expect(recovered[0].message.agent).toBe('reviewer');
  });
});
