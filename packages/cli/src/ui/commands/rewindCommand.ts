/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import path from 'node:path';
import React from 'react';
import { Text } from 'ink';
import type { Config } from '@papert-code/papert-code-core';
import {
  type CommandContext,
  type SlashCommand,
  type SlashCommandActionReturn,
  CommandKind,
} from './types.js';
import { restoreCommand } from './restoreCommand.js';

type CheckpointPreview = {
  checkpoint: string;
  toolName: string;
  hasFileRestore: boolean;
};

async function readCheckpointPreview(
  checkpointDir: string,
  checkpointName: string,
): Promise<CheckpointPreview | null> {
  try {
    const filePath = path.join(checkpointDir, `${checkpointName}.json`);
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);

    return {
      checkpoint: checkpointName,
      toolName:
        typeof parsed?.toolCall?.name === 'string'
          ? parsed.toolCall.name
          : 'unknown',
      hasFileRestore: typeof parsed?.commitHash === 'string' && parsed.commitHash.length > 0,
    };
  } catch (_error) {
    return null;
  }
}

async function listCheckpointNames(checkpointDir: string): Promise<string[]> {
  await fs.mkdir(checkpointDir, { recursive: true });
  const files = await fs.readdir(checkpointDir);

  const jsonFiles = files.filter((file) => file.endsWith('.json'));
  const stats = await Promise.all(
    jsonFiles.map(async (file) => {
      const filePath = path.join(checkpointDir, file);
      const stat = await fs.stat(filePath);
      return { file, mtimeMs: stat.mtimeMs };
    }),
  );

  return stats
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .map((entry) => entry.file.replace(/\.json$/, ''));
}

async function rewindAction(
  config: Config,
  context: CommandContext,
  args: string,
): Promise<void | SlashCommandActionReturn> {
  const checkpointDir = config.storage.getProjectTempCheckpointsDir();

  if (!checkpointDir) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Could not determine the .gemini directory path.',
    };
  }

  const checkpointName = args.trim();

  if (!checkpointName) {
    const checkpointNames = await listCheckpointNames(checkpointDir);
    if (checkpointNames.length === 0) {
      return {
        type: 'message',
        messageType: 'info',
        content: 'No rewind points found. Run a tool call first, then try /rewind again.',
      };
    }

    const previews = await Promise.all(
      checkpointNames.map((name) => readCheckpointPreview(checkpointDir, name)),
    );

    const lines = previews
      .filter((preview): preview is CheckpointPreview => preview !== null)
      .map((preview) => {
        const restoreLabel = preview.hasFileRestore ? 'file+chat restore' : 'chat restore';
        return `- ${preview.checkpoint} (${preview.toolName}, ${restoreLabel})`;
      });

    return {
      type: 'message',
      messageType: 'info',
      content:
        `Available rewind points (newest first):\n\n${lines.join('\n')}` +
        '\n\nUse /rewind <checkpoint-id> to preview and confirm restore.',
    };
  }

  const preview = await readCheckpointPreview(checkpointDir, checkpointName);
  if (!preview) {
    return {
      type: 'message',
      messageType: 'error',
      content: `Rewind point not found: ${checkpointName}`,
    };
  }

  if (!context.overwriteConfirmed) {
    const restoreLabel = preview.hasFileRestore
      ? 'This will restore both files and conversation state.'
      : 'This will restore conversation state.';

    return {
      type: 'confirm_action',
      prompt: React.createElement(
        Text,
        null,
        `Rewind to '${preview.checkpoint}' from tool '${preview.toolName}'? ${restoreLabel}`,
      ),
      originalInvocation: {
        raw: context.invocation?.raw || `/rewind ${checkpointName}`,
      },
    };
  }

  const restore = restoreCommand(config);
  return restore?.action?.(context, checkpointName);
}

export const rewindCommand = (config: Config | null): SlashCommand | null => {
  if (!config?.getCheckpointingEnabled()) {
    return null;
  }

  return {
    name: 'rewind',
    description:
      'Preview and restore a previous tool checkpoint with explicit confirmation',
    kind: CommandKind.BUILT_IN,
    action: (context, args) => rewindAction(config, context, args),
    completion: async (context, partialArg) => {
      const restore = restoreCommand(config);
      return restore?.completion?.(context, partialArg) ?? [];
    },
  };
};
