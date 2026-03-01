/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export type ShareRecord = {
  id: string;
  secretHash: string;
  createdAt: string;
  sessionId?: string;
  payload: Record<string, unknown>;
  /**
   * Legacy plaintext secret from old records. Kept optional for migration-only reads.
   */
  secret?: string;
};

const SHARE_ID_PATTERN = /^[a-zA-Z0-9_-]{6,64}$/;

function generateShareId(): string {
  return randomBytes(6).toString('base64url');
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'hex');
  const bBuf = Buffer.from(b, 'hex');
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export type CreatedShareRecord = ShareRecord & { secret: string };

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

  async create(
    payload: Record<string, unknown>,
    sessionId?: string,
  ): Promise<CreatedShareRecord> {
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

    const secret = randomUUID();
    const record: ShareRecord = {
      id,
      secretHash: sha256(secret),
      createdAt: new Date().toISOString(),
      sessionId,
      payload,
    };

    await fs.writeFile(this.getSharePath(id), JSON.stringify(record, null, 2));

    return {
      ...record,
      secret,
    };
  }

  async get(id: string): Promise<ShareRecord | null> {
    return this.readRecord(id);
  }

  async remove(id: string, secret: string): Promise<void> {
    const record = await this.readRecord(id);
    if (!record) {
      throw new Error('Share not found.');
    }
    const providedHash = sha256(secret);
    const storedHash =
      typeof record.secretHash === 'string' && record.secretHash.length > 0
        ? record.secretHash
        : typeof record.secret === 'string' && record.secret.length > 0
          ? sha256(record.secret)
          : '';
    if (!storedHash || !safeEqualHex(storedHash, providedHash)) {
      throw new Error('Invalid share secret.');
    }
    await fs.unlink(this.getSharePath(id));
  }
}
