/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as path from 'node:path';
import { createHash } from 'node:crypto';
import type { GitService } from '../services/gitService.js';
import type { GeminiClient } from '../core/client.js';
import { getErrorMessage } from './errors.js';
import { z } from 'zod';
import type { Content } from '@google/genai';
import type { ToolCallRequestInfo } from '../core/turn.js';

export interface ToolCallData<HistoryType = unknown, ArgsType = unknown> {
  history?: HistoryType;
  clientHistory?: Content[];
  commitHash?: string;
  toolCall: {
    name: string;
    args: ArgsType;
  };
  messageId?: string;
}

export const CHECKPOINT_INTEGRITY_VERSION = 1;
export const CHECKPOINT_INTEGRITY_ALGORITHM = 'sha256' as const;

export interface CheckpointEnvelope<HistoryType = unknown, ArgsType = unknown> {
  version: number;
  createdAt: string;
  data: ToolCallData<HistoryType, ArgsType>;
  integrity: {
    algorithm: typeof CHECKPOINT_INTEGRITY_ALGORITHM;
    hash: string;
  };
}

export interface ParsedCheckpoint<HistoryType = unknown, ArgsType = unknown> {
  data: ToolCallData<HistoryType, ArgsType>;
  integrityVerified: boolean;
  version: number | null;
  createdAt?: string | null;
}

export interface CheckpointParseError {
  code: 'invalid_json' | 'invalid_checkpoint' | 'integrity_mismatch';
  message: string;
}

export type CheckpointParseResult<
  HistoryType = unknown,
  ArgsType = unknown,
> =
  | { success: true; checkpoint: ParsedCheckpoint<HistoryType, ArgsType> }
  | { success: false; error: CheckpointParseError };

const ContentSchema = z
  .object({
    role: z.string().optional(),
    parts: z.array(z.record(z.unknown())),
  })
  .passthrough();

function stableNormalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stableNormalize(item));
  }

  if (value && typeof value === 'object') {
    const sortedEntries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nestedValue]) => [key, stableNormalize(nestedValue)]);
    return Object.fromEntries(sortedEntries);
  }

  return value;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(stableNormalize(value));
}

export function getToolCallDataSchema(historyItemSchema?: z.ZodTypeAny) {
  const schema = historyItemSchema ?? z.any();

  return z.object({
    history: z.array(schema).optional(),
    clientHistory: z.array(ContentSchema).optional(),
    commitHash: z.string().optional(),
    toolCall: z.object({
      name: z.string(),
      args: z.record(z.unknown()),
    }),
    messageId: z.string().optional(),
  });
}

function getCheckpointEnvelopeSchema(historyItemSchema?: z.ZodTypeAny) {
  return z.object({
    version: z.number().int().positive(),
    createdAt: z.string(),
    data: getToolCallDataSchema(historyItemSchema),
    integrity: z.object({
      algorithm: z.string(),
      hash: z.string().min(1),
    }),
  });
}

export function computeCheckpointHash<HistoryType = unknown, ArgsType = unknown>(
  data: ToolCallData<HistoryType, ArgsType>,
  version: number = CHECKPOINT_INTEGRITY_VERSION,
): string {
  return createHash(CHECKPOINT_INTEGRITY_ALGORITHM)
    .update(stableStringify({ version, data }))
    .digest('hex');
}

export function createCheckpointEnvelope<
  HistoryType = unknown,
  ArgsType = unknown,
>(
  data: ToolCallData<HistoryType, ArgsType>,
): CheckpointEnvelope<HistoryType, ArgsType> {
  const version = CHECKPOINT_INTEGRITY_VERSION;
  return {
    version,
    createdAt: new Date().toISOString(),
    data,
    integrity: {
      algorithm: CHECKPOINT_INTEGRITY_ALGORITHM,
      hash: computeCheckpointHash(data, version),
    },
  };
}

export function serializeCheckpointData<
  HistoryType = unknown,
  ArgsType = unknown,
>(data: ToolCallData<HistoryType, ArgsType>): string {
  return JSON.stringify(createCheckpointEnvelope(data), null, 2);
}

export function parseCheckpointContent<
  HistoryType = unknown,
  ArgsType = unknown,
>(
  rawContent: string,
  historyItemSchema?: z.ZodTypeAny,
): CheckpointParseResult<HistoryType, ArgsType> {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawContent);
  } catch {
    return {
      success: false,
      error: {
        code: 'invalid_json',
        message: 'Checkpoint JSON could not be parsed.',
      },
    };
  }

  const envelopeSchema = getCheckpointEnvelopeSchema(historyItemSchema);
  const envelopeResult = envelopeSchema.safeParse(parsedJson);
  if (envelopeResult.success) {
    const envelope = envelopeResult.data;

    if (envelope.integrity.algorithm !== CHECKPOINT_INTEGRITY_ALGORITHM) {
      return {
        success: false,
        error: {
          code: 'invalid_checkpoint',
          message: `Unsupported checkpoint integrity algorithm: ${envelope.integrity.algorithm}`,
        },
      };
    }

    const expectedHash = computeCheckpointHash(
      envelope.data,
      envelope.version,
    );
    if (expectedHash !== envelope.integrity.hash) {
      return {
        success: false,
        error: {
          code: 'integrity_mismatch',
          message: 'Checkpoint integrity hash mismatch.',
        },
      };
    }

    return {
      success: true,
      checkpoint: {
        data: envelope.data as ToolCallData<HistoryType, ArgsType>,
        integrityVerified: true,
        version: envelope.version,
        createdAt: envelope.createdAt,
      },
    };
  }

  const legacySchema = getToolCallDataSchema(historyItemSchema);
  const legacyResult = legacySchema.safeParse(parsedJson);
  if (!legacyResult.success) {
    return {
      success: false,
      error: {
        code: 'invalid_checkpoint',
        message: 'Checkpoint file is invalid or corrupted.',
      },
    };
  }

  return {
    success: true,
    checkpoint: {
      data: legacyResult.data as ToolCallData<HistoryType, ArgsType>,
      integrityVerified: false,
      version: null,
      createdAt: null,
    },
  };
}

export function generateCheckpointFileName(
  toolCall: ToolCallRequestInfo,
): string | null {
  const toolArgs = toolCall.args;
  const toolFilePath = toolArgs['file_path'] as string;

  if (!toolFilePath) {
    return null;
  }

  const timestamp = new Date()
    .toISOString()
    .replace(/:/g, '-')
    .replace(/\./g, '_');
  const toolName = toolCall.name;
  const fileName = path.basename(toolFilePath);

  return `${timestamp}-${fileName}-${toolName}`;
}

export function formatCheckpointDisplayList(filenames: string[]): string {
  return getTruncatedCheckpointNames(filenames).join('\n');
}

export function getTruncatedCheckpointNames(filenames: string[]): string[] {
  return filenames.map((file) => {
    const components = file.split('.');
    if (components.length <= 1) {
      return file;
    }
    components.pop();
    return components.join('.');
  });
}

export async function processRestorableToolCalls<HistoryType>(
  toolCalls: ToolCallRequestInfo[],
  gitService: GitService,
  geminiClient: GeminiClient,
  history?: HistoryType,
): Promise<{
  checkpointsToWrite: Map<string, string>;
  toolCallToCheckpointMap: Map<string, string>;
  errors: string[];
}> {
  const checkpointsToWrite = new Map<string, string>();
  const toolCallToCheckpointMap = new Map<string, string>();
  const errors: string[] = [];

  for (const toolCall of toolCalls) {
    try {
      let commitHash: string | undefined;
      try {
        commitHash = await gitService.createFileSnapshot(
          `Snapshot for ${toolCall.name}`,
        );
      } catch (error) {
        errors.push(
          `Failed to create new snapshot for ${
            toolCall.name
          }: ${getErrorMessage(error)}. Attempting to use current commit.`,
        );
        commitHash = await gitService.getCurrentCommitHash();
      }

      if (!commitHash) {
        errors.push(
          `Failed to create snapshot for ${toolCall.name}. Checkpointing may not be working properly. Ensure Git is installed and the project directory is accessible.`,
        );
        continue;
      }

      const checkpointFileName = generateCheckpointFileName(toolCall);
      if (!checkpointFileName) {
        errors.push(
          `Skipping restorable tool call due to missing file_path: ${toolCall.name}`,
        );
        continue;
      }

      const clientHistory = geminiClient.getHistory();
      const checkpointData: ToolCallData<HistoryType> = {
        history,
        clientHistory,
        toolCall: {
          name: toolCall.name,
          args: toolCall.args,
        },
        commitHash,
        messageId: toolCall.prompt_id,
      };

      const fileName = `${checkpointFileName}.json`;
      checkpointsToWrite.set(fileName, serializeCheckpointData(checkpointData));
      toolCallToCheckpointMap.set(
        toolCall.callId,
        fileName.replace('.json', ''),
      );
    } catch (error) {
      errors.push(
        `Failed to create checkpoint for ${toolCall.name}: ${getErrorMessage(
          error,
        )}`,
      );
    }
  }

  return { checkpointsToWrite, toolCallToCheckpointMap, errors };
}

export interface CheckpointInfo {
  messageId: string;
  checkpoint: string;
}

export function getCheckpointInfoList(
  checkpointFiles: Map<string, string>,
): CheckpointInfo[] {
  const checkpointInfoList: CheckpointInfo[] = [];

  for (const [file, content] of checkpointFiles) {
    const parsed = parseCheckpointContent(content);
    if (!parsed.success) {
      continue;
    }

    if (parsed.checkpoint.data.messageId) {
      checkpointInfoList.push({
        messageId: parsed.checkpoint.data.messageId,
        checkpoint: file.replace('.json', ''),
      });
    }
  }
  return checkpointInfoList;
}
