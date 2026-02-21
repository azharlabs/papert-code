/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RestoreCommand, ListCheckpointsCommand } from './restore.js';
import type { CommandContext } from './types.js';
import {
  serializeCheckpointData,
  type Config,
} from '@papert-code/papert-code-core';
import { createMockConfig } from '../utils/testing_utils.js';

beforeEach(() => {
  vi.clearAllMocks();
});

const mockLoggerInfo = vi.hoisted(() => vi.fn());
const mockGetCheckpointInfoList = vi.hoisted(() => vi.fn());

vi.mock('@papert-code/papert-code-core', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@papert-code/papert-code-core')>();
  return {
    ...original,
    getCheckpointInfoList: mockGetCheckpointInfoList,
  };
});

const mockFs = vi.hoisted(() => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
  mkdir: vi.fn(),
}));

vi.mock('node:fs/promises', () => mockFs);

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: mockLoggerInfo,
  },
}));

describe('RestoreCommand', () => {
  it('requires checkpoint name when none is provided', async () => {
    const mockContext = {
      config: createMockConfig() as Config,
      git: {},
    } as CommandContext;
    const command = new RestoreCommand();
    const result = await command.execute(mockContext, []);
    expect(result.data).toEqual({
      type: 'message',
      messageType: 'error',
      content: 'Please provide a checkpoint name to restore.',
    });
  });

  it('returns load_history when checkpoint includes history', async () => {
    const mockContext = {
      config: createMockConfig() as Config,
      git: {},
    } as CommandContext;
    const command = new RestoreCommand();
    const toolCallData = {
      toolCall: {
        name: 'test-tool',
        args: {},
      },
      history: [{ role: 'user', text: 'hello' }],
      clientHistory: [{ role: 'user', parts: [] }],
    };
    mockFs.readFile.mockResolvedValue(JSON.stringify(toolCallData));
    const result = await command.execute(mockContext, ['checkpoint1.json']);
    expect(result.data).toEqual([
      {
        type: 'load_history',
        history: [{ role: 'user', text: 'hello' }],
        clientHistory: [{ role: 'user', parts: [] }],
      },
    ]);
  });

  it('should show "file not found" error for a non-existent checkpoint', async () => {
    const mockContext = {
      config: createMockConfig() as Config,
      git: {},
    } as CommandContext;
    const command = new RestoreCommand();
    const error = new Error('File not found');
    (error as NodeJS.ErrnoException).code = 'ENOENT';
    mockFs.readFile.mockRejectedValue(error);
    const result = await command.execute(mockContext, ['checkpoint2.json']);
    expect(result.data).toEqual({
      type: 'message',
      messageType: 'error',
      content: 'File not found: checkpoint2.json',
    });
  });

  it('should handle invalid JSON in checkpoint file', async () => {
    const mockContext = {
      config: createMockConfig() as Config,
      git: {},
    } as CommandContext;
    const command = new RestoreCommand();
    mockFs.readFile.mockResolvedValue('invalid json');
    const result = await command.execute(mockContext, ['checkpoint1.json']);
    expect(result.data).toEqual({
      type: 'message',
      messageType: 'error',
      content: "Checkpoint 'checkpoint1.json' contains invalid JSON.",
    });
  });

  it('rejects checkpoints with integrity mismatches', async () => {
    const mockContext = {
      config: createMockConfig() as Config,
      git: {},
    } as CommandContext;
    const command = new RestoreCommand();
    const serialized = serializeCheckpointData({
      toolCall: {
        name: 'test-tool',
        args: {},
      },
    });
    const parsed = JSON.parse(serialized) as {
      data: { toolCall: { name: string; args: Record<string, unknown> } };
    };
    parsed.data.toolCall.name = 'different-tool';
    mockFs.readFile.mockResolvedValue(JSON.stringify(parsed));

    const result = await command.execute(mockContext, ['checkpoint1.json']);

    expect(result.data).toEqual({
      type: 'message',
      messageType: 'error',
      content:
        "Checkpoint integrity check failed for 'checkpoint1.json'. The checkpoint may be corrupted or tampered with.",
    });
  });

  it('returns git service missing error when commitHash exists but git is unavailable', async () => {
    const mockContext = {
      config: createMockConfig() as Config,
      git: undefined,
    } as CommandContext;
    const command = new RestoreCommand();
    const toolCallData = {
      toolCall: {
        name: 'test-tool',
        args: {},
      },
      commitHash: 'abc123',
    };
    mockFs.readFile.mockResolvedValue(JSON.stringify(toolCallData));
    const result = await command.execute(mockContext, ['checkpoint1.json']);
    expect(result.data).toEqual([
      {
        type: 'message',
        messageType: 'error',
        content:
          'Git service is not available, cannot restore checkpoint. Please ensure you are in a git repository.',
      },
    ]);
  });

  it('restores snapshot and returns success info message', async () => {
    const mockGit = {
      restoreProjectFromSnapshot: vi.fn().mockResolvedValue(undefined),
    };
    const mockContext = {
      config: createMockConfig() as Config,
      git: mockGit,
    } as CommandContext;
    const command = new RestoreCommand();
    const toolCallData = {
      toolCall: {
        name: 'test-tool',
        args: {},
      },
      commitHash: 'abc123',
    };
    mockFs.readFile.mockResolvedValue(JSON.stringify(toolCallData));
    const result = await command.execute(mockContext, ['checkpoint1.json']);
    expect(mockGit.restoreProjectFromSnapshot).toHaveBeenCalledWith('abc123');
    expect(result.data).toEqual([
      {
        type: 'message',
        messageType: 'info',
        content: 'Restored project to the state before the tool call.',
      },
    ]);
  });

  it('returns invalid commit message when git restore fails with missing tree', async () => {
    const mockGit = {
      restoreProjectFromSnapshot: vi
        .fn()
        .mockRejectedValue(new Error('fatal: unable to read tree abc123')),
    };
    const mockContext = {
      config: createMockConfig() as Config,
      git: mockGit,
    } as CommandContext;
    const command = new RestoreCommand();
    const toolCallData = {
      toolCall: {
        name: 'test-tool',
        args: {},
      },
      commitHash: 'abc123',
    };
    mockFs.readFile.mockResolvedValue(JSON.stringify(toolCallData));
    const result = await command.execute(mockContext, ['checkpoint1.json']);
    expect(result.data).toEqual([
      {
        type: 'message',
        messageType: 'error',
        content:
          "The commit hash 'abc123' associated with this checkpoint could not be found in your Git repository. This can happen if the repository has been re-cloned, reset, or if old commits have been garbage collected. This checkpoint cannot be restored.",
      },
    ]);
  });
});

describe('ListCheckpointsCommand', () => {
  const mockConfig = {
    config: createMockConfig() as Config,
  } as CommandContext;

  it('should list all available checkpoints', async () => {
    const command = new ListCheckpointsCommand();
    const checkpointInfo = [{ file: 'checkpoint1.json', description: 'Test' }];
    mockFs.readdir.mockResolvedValue(['checkpoint1.json']);
    mockFs.readFile.mockResolvedValue(
      JSON.stringify({ toolCall: { name: 'Test', args: {} } }),
    );
    mockGetCheckpointInfoList.mockReturnValue(checkpointInfo);
    const result = await command.execute(mockConfig);
    expect((result.data as { content: string }).content).toEqual(
      JSON.stringify(checkpointInfo),
    );
  });

  it('should handle errors when listing checkpoints', async () => {
    const command = new ListCheckpointsCommand();
    mockFs.readdir.mockRejectedValue(new Error('Read error'));
    const result = await command.execute(mockConfig);
    expect((result.data as { content: string }).content).toContain(
      'An unexpected error occurred while listing checkpoints.',
    );
  });
});
