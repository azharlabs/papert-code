/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, type MockInstance } from 'vitest';
import {
  runDeferredCommand,
  defer,
  setDeferredCommand,
  type DeferredCommand,
} from './deferred.js';
import type { ArgumentsCamelCase, CommandModule } from 'yargs';
import type { Config } from '@papert-code/papert-code-core';

const { mockRunExitCleanup, mockGetAdminErrorMessage } = vi.hoisted(() => ({
  mockRunExitCleanup: vi.fn(),
  mockGetAdminErrorMessage: vi.fn(() => 'admin disabled'),
}));

vi.mock('@papert-code/papert-code-core', async () => {
  return {
    getAdminErrorMessage: mockGetAdminErrorMessage,
  };
});

vi.mock('./utils/cleanup.js', () => ({
  runExitCleanup: mockRunExitCleanup,
}));

let mockExit: MockInstance<(code?: number | string | null | undefined) => never>;
let mockConsoleError: ReturnType<typeof vi.spyOn>;

const createConfig = (
  adminSettings: Record<string, unknown> | undefined = {},
): Config =>
  ({
    getRemoteAdminSettings: () => adminSettings,
  }) as unknown as Config;

describe('deferred', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExit = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never) as MockInstance<
        (code?: number | string | null | undefined) => never
      >;
    mockConsoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    setDeferredCommand(undefined as unknown as DeferredCommand);
  });

  describe('runDeferredCommand', () => {
    it('should do nothing if no deferred command is set', async () => {
      await runDeferredCommand(createConfig());
      expect(mockConsoleError).not.toHaveBeenCalled();
      expect(mockExit).not.toHaveBeenCalled();
    });

    it('should execute the deferred command if enabled', async () => {
      const mockHandler = vi.fn();
      setDeferredCommand({
        handler: mockHandler,
        argv: { _: [], $0: 'papert' } as ArgumentsCamelCase,
        commandName: 'mcp',
      });

      await runDeferredCommand(createConfig({ mcp: { enabled: true } }));
      expect(mockHandler).toHaveBeenCalled();
      expect(mockRunExitCleanup).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should exit if MCP is disabled', async () => {
      setDeferredCommand({
        handler: vi.fn(),
        argv: {} as ArgumentsCamelCase,
        commandName: 'mcp',
      });

      await runDeferredCommand(createConfig({ mcp: { enabled: false } }));

      expect(mockGetAdminErrorMessage).toHaveBeenCalledWith(
        'MCP',
        expect.any(Object),
      );
      expect(mockConsoleError).toHaveBeenCalledWith('admin disabled');
      expect(mockRunExitCleanup).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should exit if extensions are disabled', async () => {
      setDeferredCommand({
        handler: vi.fn(),
        argv: {} as ArgumentsCamelCase,
        commandName: 'extensions',
      });

      await runDeferredCommand(createConfig({ extensions: { enabled: false } }));

      expect(mockGetAdminErrorMessage).toHaveBeenCalledWith(
        'Extensions',
        expect.any(Object),
      );
      expect(mockConsoleError).toHaveBeenCalledWith('admin disabled');
      expect(mockRunExitCleanup).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should exit if skills are disabled', async () => {
      setDeferredCommand({
        handler: vi.fn(),
        argv: {} as ArgumentsCamelCase,
        commandName: 'skills',
      });

      await runDeferredCommand(createConfig({ skills: { enabled: false } }));

      expect(mockGetAdminErrorMessage).toHaveBeenCalledWith(
        'Agent skills',
        expect.any(Object),
      );
      expect(mockConsoleError).toHaveBeenCalledWith('admin disabled');
      expect(mockRunExitCleanup).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should execute if admin settings are undefined (implicit enable)', async () => {
      const mockHandler = vi.fn();
      setDeferredCommand({
        handler: mockHandler,
        argv: {} as ArgumentsCamelCase,
        commandName: 'mcp',
      });

      await runDeferredCommand(createConfig(undefined));

      expect(mockHandler).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(0);
    });
  });

  describe('defer', () => {
    it('should wrap a command module and defer execution', async () => {
      const originalHandler = vi.fn();
      const commandModule: CommandModule = {
        command: 'test',
        describe: 'test command',
        handler: originalHandler,
      };

      const deferredModule = defer(commandModule);
      expect(deferredModule.command).toBe(commandModule.command);

      const argv = { _: [], $0: 'papert' } as ArgumentsCamelCase;
      await deferredModule.handler(argv);

      expect(originalHandler).not.toHaveBeenCalled();

      await runDeferredCommand(createConfig());
      expect(originalHandler).toHaveBeenCalledWith(argv);
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should use parentCommandName if provided', async () => {
      const commandModule: CommandModule = {
        command: 'subcommand',
        describe: 'sub command',
        handler: vi.fn(),
      };

      const deferredModule = defer(commandModule, 'parent');
      await deferredModule.handler({} as ArgumentsCamelCase);

      const deferredMcp = defer(commandModule, 'mcp');
      await deferredMcp.handler({} as ArgumentsCamelCase);

      await runDeferredCommand(createConfig({ mcp: { enabled: false } }));

      expect(mockGetAdminErrorMessage).toHaveBeenCalledWith(
        'MCP',
        expect.any(Object),
      );
    });

    it('should fallback to unknown if no parentCommandName is provided', async () => {
      const mockHandler = vi.fn();
      const commandModule: CommandModule = {
        command: ['foo', 'infoo'],
        describe: 'foo command',
        handler: mockHandler,
      };

      const deferredModule = defer(commandModule);
      await deferredModule.handler({} as ArgumentsCamelCase);

      await runDeferredCommand(
        createConfig({
          mcp: { enabled: false },
          extensions: { enabled: false },
          skills: { enabled: false },
        }),
      );

      expect(mockHandler).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(0);
    });
  });
});
