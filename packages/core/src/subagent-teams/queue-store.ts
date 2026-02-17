/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { TeamQueueMessage } from './types.js';

export interface QueueStorePaths {
  rootDir: string;
  incomingDir: string;
  processingDir: string;
  outgoingDir: string;
}

function messageFileName(message: TeamQueueMessage): string {
  return `${message.createdAt}_${message.id}.json`;
}

export class TeamQueueStore {
  constructor(private readonly paths: QueueStorePaths) {}

  async ensureReady(): Promise<void> {
    await fs.mkdir(this.paths.rootDir, { recursive: true });
    await fs.mkdir(this.paths.incomingDir, { recursive: true });
    await fs.mkdir(this.paths.processingDir, { recursive: true });
    await fs.mkdir(this.paths.outgoingDir, { recursive: true });
  }

  async recoverProcessingToIncoming(): Promise<void> {
    await this.ensureReady();
    const files = await fs.readdir(this.paths.processingDir);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      await fs.rename(
        path.join(this.paths.processingDir, file),
        path.join(this.paths.incomingDir, file),
      );
    }
  }

  async enqueueIncoming(message: TeamQueueMessage): Promise<void> {
    await this.ensureReady();
    const filePath = path.join(this.paths.incomingDir, messageFileName(message));
    await fs.writeFile(filePath, JSON.stringify(message, null, 2), 'utf8');
  }

  async dequeueIncomingBatch(): Promise<Array<{ filePath: string; message: TeamQueueMessage }>> {
    await this.ensureReady();
    const files = (await fs.readdir(this.paths.incomingDir))
      .filter((file) => file.endsWith('.json'))
      .sort();

    const result: Array<{ filePath: string; message: TeamQueueMessage }> = [];
    for (const file of files) {
      const sourcePath = path.join(this.paths.incomingDir, file);
      const targetPath = path.join(this.paths.processingDir, file);
      await fs.rename(sourcePath, targetPath);
      const raw = await fs.readFile(targetPath, 'utf8');
      result.push({
        filePath: targetPath,
        message: JSON.parse(raw) as TeamQueueMessage,
      });
    }
    return result;
  }

  async ackProcessing(filePath: string): Promise<void> {
    await fs.rm(filePath, { force: true });
  }

  async failProcessing(filePath: string): Promise<void> {
    const fileName = path.basename(filePath);
    await fs.rename(filePath, path.join(this.paths.incomingDir, fileName));
  }

  async writeOutgoing(conversationId: string, payload: unknown): Promise<string> {
    await this.ensureReady();
    const filePath = path.join(this.paths.outgoingDir, `${conversationId}.json`);
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
    return filePath;
  }
}

export function createQueuePaths(
  projectRoot: string,
  teamId: string,
  conversationId: string,
): QueueStorePaths {
  const rootDir = path.join(
    projectRoot,
    '.papert',
    'runtime',
    'subagent-teams',
    teamId,
    'conversations',
    conversationId,
    'queue',
  );
  return {
    rootDir,
    incomingDir: path.join(rootDir, 'incoming'),
    processingDir: path.join(rootDir, 'processing'),
    outgoingDir: path.join(rootDir, 'outgoing'),
  };
}
