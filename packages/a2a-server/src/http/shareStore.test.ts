/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ShareStore } from './shareStore.js';

describe('ShareStore', () => {
  let tempDir: string;
  let store: ShareStore;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'papert-share-'));
    store = new ShareStore(tempDir);
  });

  afterEach(() => {
    // temp dir is in OS temp; leave cleanup to OS
  });

  it('creates and retrieves share records', async () => {
    const record = await store.create({ hello: 'world' }, 'session-123');

    expect(record.id).toBeTruthy();
    expect(record.secret).toBeTruthy();
    expect(record.sessionId).toBe('session-123');

    const loaded = await store.get(record.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.payload).toEqual({ hello: 'world' });
  });

  it('removes share records with valid secret', async () => {
    const record = await store.create({ foo: 'bar' });

    await store.remove(record.id, record.secret);

    const loaded = await store.get(record.id);
    expect(loaded).toBeNull();
  });

  it('rejects removal with invalid secret', async () => {
    const record = await store.create({ foo: 'bar' });

    await expect(store.remove(record.id, 'wrong-secret')).rejects.toThrow(
      'Invalid share secret.',
    );
  });
});
