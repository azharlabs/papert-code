/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { Config } from '@papert-code/papert-code-core';

export type ShareLinkRecord = {
  sessionId: string;
  shareId: string;
  shareUrl: string;
  secret: string;
  createdAt: string;
  baseUrl?: string;
};

async function ensureShareDir(config: Config): Promise<string> {
  const shareDir = path.join(config.storage.getProjectTempDir(), 'shares');
  await fs.mkdir(shareDir, { recursive: true });
  return shareDir;
}

function getShareFilePath(shareDir: string, sessionId: string): string {
  return path.join(shareDir, `${sessionId}.json`);
}

export async function loadShareLinkRecord(
  config: Config,
  sessionId: string,
): Promise<ShareLinkRecord | null> {
  const shareDir = await ensureShareDir(config);
  const filePath = getShareFilePath(shareDir, sessionId);
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as ShareLinkRecord;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function saveShareLinkRecord(
  config: Config,
  record: ShareLinkRecord,
): Promise<void> {
  const shareDir = await ensureShareDir(config);
  const filePath = getShareFilePath(shareDir, record.sessionId);
  await fs.writeFile(filePath, JSON.stringify(record, null, 2));
}

export async function removeShareLinkRecord(
  config: Config,
  sessionId: string,
): Promise<void> {
  const shareDir = await ensureShareDir(config);
  const filePath = getShareFilePath(shareDir, sessionId);
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}
