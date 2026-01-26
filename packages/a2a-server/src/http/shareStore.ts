/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export type ShareRecord = {
  id: string;
  secret: string;
  createdAt: string;
  sessionId?: string;
  payload: Record<string, unknown>;
};

const SHARE_ID_PATTERN = /^[a-zA-Z0-9_-]{6,64}$/;

function generateShareId(): string {
  return randomBytes(6).toString('base64url');
}

export class ShareStore {
  constructor(private baseDir: string) {}

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true });
  }

  private getSharePath(id: string): string {
    if (!SHARE_ID_PATTERN.test(id)) {
      throw new Error('Invalid share id.');
    }
    return path.join(this.baseDir, `${id}.json`);
  }

  private async readRecord(id: string): Promise<ShareRecord | null> {
    try {
      const raw = await fs.readFile(this.getSharePath(id), 'utf-8');
      return JSON.parse(raw) as ShareRecord;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async create(payload: Record<string, unknown>, sessionId?: string): Promise<ShareRecord> {
    await this.ensureDir();

    let id = generateShareId();
    // Avoid accidental collisions.
    let existing = await this.readRecord(id);
    for (let attempts = 0; attempts < 5 && existing; attempts += 1) {
      id = generateShareId();
      existing = await this.readRecord(id);
    }
    if (existing) {
      throw new Error('Failed to generate a unique share id.');
    }

    const record: ShareRecord = {
      id,
      secret: randomUUID(),
      createdAt: new Date().toISOString(),
      sessionId,
      payload,
    };

    await fs.writeFile(this.getSharePath(id), JSON.stringify(record, null, 2));

    return record;
  }

  async get(id: string): Promise<ShareRecord | null> {
    return this.readRecord(id);
  }

  async remove(id: string, secret: string): Promise<void> {
    const record = await this.readRecord(id);
    if (!record) {
      throw new Error('Share not found.');
    }
    if (record.secret !== secret) {
      throw new Error('Invalid share secret.');
    }
    await fs.unlink(this.getSharePath(id));
  }
}
