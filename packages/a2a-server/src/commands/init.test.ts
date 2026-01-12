/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InitCommand } from './init.js';
import { getCurrentGeminiMdFilename } from '@papert-code/papert-code-core';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CoderAgentExecutor } from '../agent/executor.js';
import { CoderAgentEvent } from '../types.js';
import type { ExecutionEventBus } from '@a2a-js/sdk/server';
import { createMockConfig } from '../utils/testing_utils.js';
import type { CommandContext } from './types.js';
import type { Config } from '@papert-code/papert-code-core';
import { logger } from '../utils/logger.js';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock('../agent/executor.js', () => ({
  CoderAgentExecutor: vi.fn().mockImplementation(() => ({
    execute: vi.fn(),
  })),
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('InitCommand', () => {
  let eventBus: ExecutionEventBus;
  let command: InitCommand;
  let context: CommandContext;
  let publishSpy: ReturnType<typeof vi.spyOn>;
  let mockExecute: ReturnType<typeof vi.fn>;
  const mockWorkspacePath = path.resolve('/tmp');

  beforeEach(() => {
    process.env['CODER_AGENT_WORKSPACE_PATH'] = mockWorkspacePath;
    eventBus = {
      publish: vi.fn(),
    } as unknown as ExecutionEventBus;
    command = new InitCommand();
    const mockConfig = createMockConfig({
      getModel: () => 'gemini-pro',
    });
    const mockExecutorInstance = new CoderAgentExecutor();
    context = {
      config: mockConfig as unknown as Config,
      agentExecutor: mockExecutorInstance,
      eventBus,
    } as CommandContext;
    publishSpy = vi.spyOn(eventBus, 'publish');
    mockExecute = vi.fn();
    vi.spyOn(mockExecutorInstance, 'execute').mockImplementation(mockExecute);
    vi.clearAllMocks();
  });

  it('has requiresWorkspace set to true', () => {
    expect(command.requiresWorkspace).toBe(true);
  });

  describe('execute', () => {
    it('handles info when papert.md already exists', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const contextFileName = getCurrentGeminiMdFilename();

      await command.execute(context, []);

      expect(logger.info).toHaveBeenCalledWith(
        '[EventBus event]: ',
        expect.objectContaining({
          kind: 'status-update',
          status: expect.objectContaining({
            state: 'completed',
            message: expect.objectContaining({
              parts: [
                {
                  kind: 'text',
                  text: expect.stringContaining(contextFileName),
                },
              ],
            }),
          }),
        }),
      );

      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'status-update',
          status: expect.objectContaining({
            state: 'completed',
            message: expect.objectContaining({
              parts: [
                {
                  kind: 'text',
                  text: expect.stringContaining(contextFileName),
                },
              ],
            }),
          }),
        }),
      );
    });

    it('returns an error if CODER_AGENT_WORKSPACE_PATH is missing', async () => {
      delete process.env['CODER_AGENT_WORKSPACE_PATH'];

      const result = await command.execute(context, []);

      expect(result.data).toEqual({
        type: 'message',
        messageType: 'error',
        content:
          'CODER_AGENT_WORKSPACE_PATH must be set to run the init command.',
      });
      expect(publishSpy).not.toHaveBeenCalled();
    });

    describe('when handling submit_prompt', () => {
      beforeEach(() => {
        vi.mocked(fs.existsSync).mockReturnValue(false);
      });

      it('writes the file and executes the agent', async () => {
        await command.execute(context, []);

        expect(fs.writeFileSync).toHaveBeenCalledWith(
          path.join(mockWorkspacePath, 'papert.md'),
          '',
          'utf8',
        );
        expect(mockExecute).toHaveBeenCalled();
      });

      it('passes autoExecute to the agent executor', async () => {
        await command.execute(context, []);

        const contextFileName = getCurrentGeminiMdFilename();
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            userMessage: expect.objectContaining({
              parts: expect.arrayContaining([
                expect.objectContaining({
                  text: expect.stringContaining(contextFileName),
                }),
              ]),
              metadata: {
                coderAgent: {
                  kind: CoderAgentEvent.StateAgentSettingsEvent,
                  workspacePath: mockWorkspacePath,
                  autoExecute: true,
                },
              },
            }),
          }),
          eventBus,
        );
      });
    });
  });
});
