/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */
// @vitest-environment node

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { rewindCommand } from './rewindCommand.js';
import { type CommandContext } from './types.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import type { Config, GitService } from '@papert-code/papert-code-core';

describe('rewindCommand', () => {
  let mockContext: CommandContext;
  let mockConfig: Config;
  let mockGitService: GitService;
  let mockSetHistory: ReturnType<typeof vi.fn>;
  let testRootDir: string;
  let geminiTempDir: string;
  let checkpointsDir: string;

  beforeEach(async () => {
    testRootDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'rewind-command-test-'),
    );
    geminiTempDir = path.join(testRootDir, '.gemini');
    checkpointsDir = path.join(geminiTempDir, 'checkpoints');
    await fs.mkdir(checkpointsDir, { recursive: true });

    mockSetHistory = vi.fn().mockResolvedValue(undefined);
    mockGitService = {
      restoreProjectFromSnapshot: vi.fn().mockResolvedValue(undefined),
    } as unknown as GitService;

    mockConfig = {
      getCheckpointingEnabled: vi.fn().mockReturnValue(true),
      storage: {
        getProjectTempCheckpointsDir: vi.fn().mockReturnValue(checkpointsDir),
        getProjectTempDir: vi.fn().mockReturnValue(geminiTempDir),
      },
      getGeminiClient: vi.fn().mockReturnValue({
        setHistory: mockSetHistory,
      }),
    } as unknown as Config;

    mockContext = createMockCommandContext({
      invocation: {
        raw: '/rewind cp-1',
        name: 'rewind',
        args: 'cp-1',
      },
      services: {
        config: mockConfig,
        git: mockGitService,
      },
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(testRootDir, { recursive: true, force: true });
  });

  it('returns explanatory message if checkpointing is disabled', async () => {
    vi.mocked(mockConfig.getCheckpointingEnabled).mockReturnValue(false);
    const command = rewindCommand(mockConfig);
    const result = await command?.action?.(mockContext, '');
    expect(result).toEqual({
      type: 'message',
      messageType: 'info',
      content:
        'Checkpointing is disabled. Enable general.checkpointing.enabled in settings, then restart the CLI.',
    });
  });

  it('lists available rewind points when no args are provided', async () => {
    await fs.writeFile(
      path.join(checkpointsDir, 'cp-1.json'),
      JSON.stringify({ toolCall: { name: 'run_shell_command', args: 'ls' } }),
    );

    const command = rewindCommand(mockConfig);
    const result = await command?.action?.(mockContext, '');

    expect(result).toEqual({
      type: 'message',
      messageType: 'info',
      content: expect.stringContaining('Available rewind points (newest first):'),
    });
    expect((result as { content: string }).content).toContain('cp-1');
  });

  it('asks for explicit confirmation before restore', async () => {
    await fs.writeFile(
      path.join(checkpointsDir, 'cp-1.json'),
      JSON.stringify({
        commitHash: 'abc123',
        toolCall: { name: 'run_shell_command', args: 'ls' },
      }),
    );

    const command = rewindCommand(mockConfig);
    const result = await command?.action?.(mockContext, 'cp-1');

    expect(result).toEqual(
      expect.objectContaining({
        type: 'confirm_action',
        originalInvocation: { raw: '/rewind cp-1' },
      }),
    );
  });

  it('restores after confirmation', async () => {
    await fs.writeFile(
      path.join(checkpointsDir, 'cp-1.json'),
      JSON.stringify({
        history: [{ type: 'user', text: 'do a thing' }],
        clientHistory: [{ role: 'user', parts: [{ text: 'do a thing' }] }],
        commitHash: 'abc123',
        toolCall: { name: 'run_shell_command', args: 'ls' },
      }),
    );

    mockContext.overwriteConfirmed = true;

    const command = rewindCommand(mockConfig);
    const result = await command?.action?.(mockContext, 'cp-1');

    expect(result).toEqual({
      type: 'tool',
      toolName: 'run_shell_command',
      toolArgs: 'ls',
    });
    expect(mockGitService.restoreProjectFromSnapshot).toHaveBeenCalledWith(
      'abc123',
    );
    expect(mockSetHistory).toHaveBeenCalled();
    expect(mockContext.ui.loadHistory).toHaveBeenCalled();
  });

  it('returns error for unknown rewind point', async () => {
    const command = rewindCommand(mockConfig);
    const result = await command?.action?.(mockContext, 'missing');

    expect(result).toEqual({
      type: 'message',
      messageType: 'error',
      content: 'Rewind point not found: missing',
    });
  });
});
