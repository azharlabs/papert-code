/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  getCheckpointInfoList,
  getToolCallDataSchema,
  isNodeError,
} from '@papert-code/papert-code-core';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {
  Command,
  CommandContext,
  CommandExecutionResponse,
} from './types.js';

export class RestoreCommand implements Command {
  readonly name = 'restore';
  readonly description =
    'Restore to a previous checkpoint, or list available checkpoints to restore. This will reset the file history to the state it was in when the checkpoint was created.';
  readonly topLevel = true;
  readonly requiresWorkspace = true;
  readonly subCommands = [new ListCheckpointsCommand()];

  async execute(
    context: CommandContext,
    args: string[],
  ): Promise<CommandExecutionResponse> {
    const { config, git: gitService } = context;
    const argsStr = args.join(' ');

    try {
      const checkpointDir = config.storage.getProjectTempCheckpointsDir();
      await fs.mkdir(checkpointDir, { recursive: true });

      if (!argsStr) {
        const files = await fs.readdir(checkpointDir);
        const jsonFiles = files.filter((file) => file.endsWith('.json'));
        const available = jsonFiles.length
          ? jsonFiles.map((file) => file.replace('.json', '')).join('\n')
          : 'No restorable tool calls found.';
        return {
          name: this.name,
          data: {
            type: 'message',
            messageType: 'info',
            content: available,
          },
        };
      }

      const selectedFile = argsStr.endsWith('.json')
        ? argsStr
        : `${argsStr}.json`;

      const filePath = path.join(checkpointDir, selectedFile);

      let data: string;
      try {
        data = await fs.readFile(filePath, 'utf-8');
      } catch (error) {
        if (isNodeError(error) && error.code === 'ENOENT') {
          return {
            name: this.name,
            data: {
              type: 'message',
              messageType: 'error',
              content: `File not found: ${selectedFile}`,
            },
          };
        }
        throw error;
      }

      const toolCallData = JSON.parse(data);
      const ToolCallDataSchema = getToolCallDataSchema();
      const parseResult = ToolCallDataSchema.safeParse(toolCallData);

      if (!parseResult.success) {
        return {
          name: this.name,
          data: {
            type: 'message',
            messageType: 'error',
            content: 'Checkpoint file is invalid or corrupted.',
          },
        };
      }

      if (parseResult.data.commitHash) {
        await gitService?.restoreProjectFromSnapshot(
          parseResult.data.commitHash,
        );
      }

      return {
        name: this.name,
        data: {
          type: 'tool',
          toolName: parseResult.data.toolCall.name,
          toolArgs: parseResult.data.toolCall.args,
        },
      };
    } catch (_error) {
      return {
        name: this.name,
        data: {
          type: 'message',
          messageType: 'error',
          content: 'An unexpected error occurred during restore.',
        },
      };
    }
  }
}

export class ListCheckpointsCommand implements Command {
  readonly name = 'restore list';
  readonly description = 'Lists all available checkpoints.';
  readonly topLevel = false;

  async execute(context: CommandContext): Promise<CommandExecutionResponse> {
    const { config } = context;

    try {
      const checkpointDir = config.storage.getProjectTempCheckpointsDir();
      await fs.mkdir(checkpointDir, { recursive: true });
      const files = await fs.readdir(checkpointDir);
      const jsonFiles = files.filter((file) => file.endsWith('.json'));

      const checkpointFiles = new Map<string, string>();
      for (const file of jsonFiles) {
        const filePath = path.join(checkpointDir, file);
        const data = await fs.readFile(filePath, 'utf-8');
        checkpointFiles.set(file, data);
      }

      const checkpointInfoList = getCheckpointInfoList(checkpointFiles);

      return {
        name: this.name,
        data: {
          type: 'message',
          messageType: 'info',
          content: JSON.stringify(checkpointInfoList),
        },
      };
    } catch (_error) {
      return {
        name: this.name,
        data: {
          type: 'message',
          messageType: 'error',
          content: 'An unexpected error occurred while listing checkpoints.',
        },
      };
    }
  }
}
