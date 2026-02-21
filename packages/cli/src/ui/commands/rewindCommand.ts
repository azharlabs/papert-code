/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import path from 'node:path';
import React from 'react';
import { Text } from 'ink';
import {
  isNodeError,
  parseCheckpointContent,
  type Config,
} from '@papert-code/papert-code-core';
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
  integrityVerified: boolean;
  createdAt: string | null;
  updatedAt: string;
  commitHash: string | null;
};

type CheckpointPreviewResult =
  | { kind: 'ok'; preview: CheckpointPreview }
  | { kind: 'missing' }
  | {
      kind: 'invalid';
      code: 'invalid_json' | 'invalid_checkpoint' | 'integrity_mismatch';
    }
  | { kind: 'error' };

type ParsedRewindArgs =
  | { checkpointName: null; allowLegacy: boolean }
  | { checkpointName: string; allowLegacy: boolean }
  | { error: string };

function formatCheckpointErrorMessage(
  checkpointName: string,
  code: 'invalid_json' | 'invalid_checkpoint' | 'integrity_mismatch',
): string {
  switch (code) {
    case 'integrity_mismatch':
      return `Checkpoint integrity check failed for '${checkpointName}'. The checkpoint may be corrupted or tampered with.`;
    case 'invalid_json':
      return `Checkpoint '${checkpointName}' contains invalid JSON.`;
    case 'invalid_checkpoint':
    default:
      return `Checkpoint '${checkpointName}' is invalid or corrupted.`;
  }
}

async function readCheckpointPreview(
  checkpointDir: string,
  checkpointName: string,
): Promise<CheckpointPreviewResult> {
  const filePath = path.join(checkpointDir, `${checkpointName}.json`);
  let updatedAt: string | null = null;
  try {
    const stat = await fs.stat(filePath);
    updatedAt = new Date(stat.mtimeMs).toISOString();
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return { kind: 'missing' };
    }
    return { kind: 'error' };
  }

  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return { kind: 'missing' };
    }
    return { kind: 'error' };
  }

  const parsedCheckpoint = parseCheckpointContent(raw);
  if (!parsedCheckpoint.success) {
    return { kind: 'invalid', code: parsedCheckpoint.error.code };
  }

  return {
    kind: 'ok',
    preview: {
      checkpoint: checkpointName,
      toolName: parsedCheckpoint.checkpoint.data.toolCall.name,
      hasFileRestore:
        typeof parsedCheckpoint.checkpoint.data.commitHash === 'string' &&
        parsedCheckpoint.checkpoint.data.commitHash.length > 0,
      integrityVerified: parsedCheckpoint.checkpoint.integrityVerified,
      createdAt: parsedCheckpoint.checkpoint.createdAt ?? null,
      updatedAt: updatedAt ?? new Date().toISOString(),
      commitHash:
        typeof parsedCheckpoint.checkpoint.data.commitHash === 'string' &&
        parsedCheckpoint.checkpoint.data.commitHash.length > 0
          ? parsedCheckpoint.checkpoint.data.commitHash
          : null,
    },
  };
}

function parseRewindArgs(args: string): ParsedRewindArgs {
  const tokens = args
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    return { checkpointName: null, allowLegacy: false };
  }

  let checkpointName: string | null = null;
  let allowLegacy = false;
  for (const token of tokens) {
    if (token === '--allow-legacy') {
      allowLegacy = true;
      continue;
    }

    if (token.startsWith('--')) {
      return {
        error: `Unknown flag: ${token}. Supported flags: --allow-legacy`,
      };
    }

    if (checkpointName) {
      return {
        error:
          'Provide exactly one checkpoint id. Usage: /rewind <checkpoint-id> [--allow-legacy]',
      };
    }

    checkpointName = token;
  }

  return { checkpointName, allowLegacy };
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
  if (!config.getCheckpointingEnabled()) {
    return {
      type: 'message',
      messageType: 'info',
      content:
        'Checkpointing is disabled. Enable general.checkpointing.enabled in settings, then restart the CLI.',
    };
  }

  const checkpointDir = config.storage.getProjectTempCheckpointsDir();

  if (!checkpointDir) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Could not determine the .gemini directory path.',
    };
  }

  const parsedArgs = parseRewindArgs(args);
  if ('error' in parsedArgs) {
    return {
      type: 'message',
      messageType: 'error',
      content: parsedArgs.error,
    };
  }

  const { checkpointName, allowLegacy } = parsedArgs;

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
      .filter(
        (
          preview,
        ): preview is {
          kind: 'ok';
          preview: CheckpointPreview;
        } => preview.kind === 'ok',
      )
      .map(({ preview }) => {
        const restoreLabel = preview.hasFileRestore ? 'file+chat' : 'chat-only';
        const integrityLabel = preview.integrityVerified ? 'verified' : 'legacy';
        const createdAt = preview.createdAt ?? preview.updatedAt;
        return `- ${preview.checkpoint} | tool=${preview.toolName} | restore=${restoreLabel} | integrity=${integrityLabel} | created=${createdAt}`;
      });

    if (lines.length === 0) {
      return {
        type: 'message',
        messageType: 'error',
        content:
          'No usable rewind points found. Existing checkpoint files appear invalid or corrupted.',
      };
    }

    return {
      type: 'message',
      messageType: 'info',
      content:
        `Available rewind points (newest first):\n\n${lines.join('\n')}` +
        '\n\nUse /rewind <checkpoint-id> to preview and confirm restore. For legacy checkpoints, use /rewind <checkpoint-id> --allow-legacy.',
    };
  }

  const previewResult = await readCheckpointPreview(checkpointDir, checkpointName);

  if (previewResult.kind === 'missing') {
    return {
      type: 'message',
      messageType: 'error',
      content: `Rewind point not found: ${checkpointName}`,
    };
  }

  if (previewResult.kind === 'invalid') {
    return {
      type: 'message',
      messageType: 'error',
      content: formatCheckpointErrorMessage(checkpointName, previewResult.code),
    };
  }

  if (previewResult.kind === 'error') {
    return {
      type: 'message',
      messageType: 'error',
      content: `Could not load rewind point: ${checkpointName}`,
    };
  }

  const preview = previewResult.preview;

  if (!preview.integrityVerified && !allowLegacy) {
    return {
      type: 'message',
      messageType: 'error',
      content: `Checkpoint '${checkpointName}' uses legacy format without integrity metadata. Re-run with /rewind ${checkpointName} --allow-legacy to continue.`,
    };
  }

  if (!context.overwriteConfirmed) {
    const restoreScope = preview.hasFileRestore
      ? 'files + conversation'
      : 'conversation only';
    const integrityLabel = preview.integrityVerified
      ? 'verified (hash checked)'
      : 'legacy (no integrity metadata)';
    const createdAt = preview.createdAt ?? preview.updatedAt;
    const commitDetails = preview.commitHash
      ? `\nGit snapshot: ${preview.commitHash.slice(0, 12)}...`
      : '\nGit snapshot: none';

    return {
      type: 'confirm_action',
      prompt: React.createElement(
        Text,
        null,
        `Rewind preview\nCheckpoint: ${preview.checkpoint}\nTool: ${preview.toolName}\nRestore scope: ${restoreScope}\nIntegrity: ${integrityLabel}\nCreated: ${createdAt}${commitDetails}\n\nProceed with restore?`,
      ),
      originalInvocation: {
        raw: `/rewind ${checkpointName}${
          allowLegacy ? ' --allow-legacy' : ''
        }`,
      },
    };
  }

  const restore = restoreCommand(config);
  return restore?.action?.(context, checkpointName);
}

export const rewindCommand = (config: Config | null): SlashCommand | null => {
  if (!config) {
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
