/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import yargs from 'yargs';
import { loadSettings, SettingScope } from '../../config/settings.js';
import { removeCommand } from './remove.js';

/**
 * IMPORTANT (Vitest hoisting):
 * - vi.mock() calls are hoisted to the top of the file.
 * - Anything referenced inside a vi.mock factory must be created via vi.hoisted(...)
 *   (or be a literal defined inside the factory), otherwise it can be undefined.
 */

const mockDefaultServers = vi.hoisted(() => ({
  'chrome-devtools': {
    command: 'npx',
    args: ['-y', 'chrome-devtools-mcp@latest'],
  },
}));

const fsMocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock('fs/promises', async (importOriginal) => {
  // Partial mock + provide a default export because some code-path imports it as default
  const actual =
    await importOriginal<typeof import('fs/promises')>();

  return {
    ...actual,
    readFile: fsMocks.readFile,
    writeFile: fsMocks.writeFile,

    // Some bundlers/transpilers end up doing `import fs from "fs/promises"`
    // so we provide a default export to keep that path happy.
    default: {
      readFile: fsMocks.readFile,
      writeFile: fsMocks.writeFile,
    },
  };
});

vi.mock('../../config/settings.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../config/settings.js')>();
  return {
    ...actual,
    loadSettings: vi.fn(),
  };
});

vi.mock('../../config/defaultMcpServers.js', () => ({
  getDefaultMcpServers: vi.fn(() => ({ ...mockDefaultServers })),
}));

const mockedLoadSettings = loadSettings as unknown as vi.Mock;

describe('mcp remove command', () => {
  let parser: yargs.Argv;
  let mockSetValue: vi.Mock;
  let mockSettings: Record<string, unknown>;

  beforeEach(() => {
    vi.resetAllMocks();

    const yargsInstance = yargs([]).command(removeCommand);
    parser = yargsInstance;

    mockSetValue = vi.fn();
    mockSettings = {
      mcpServers: {
        'test-server': {
          command: 'echo "hello"',
        },
      },
    };

    mockedLoadSettings.mockReturnValue({
      forScope: () => ({ settings: mockSettings }),
      setValue: mockSetValue,
      merged: {
        mcpServers: { ...mockDefaultServers, ...(mockSettings.mcpServers as object) },
      },
    });
  });

  it('should remove a server from project settings', async () => {
    await parser.parseAsync('remove test-server');

    expect(mockSetValue).toHaveBeenCalledWith(
      SettingScope.Workspace,
      'mcpServers',
      {},
    );
  });

  it('should show a message if server not found', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await parser.parseAsync('remove non-existent-server');

    expect(mockSetValue).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      'Server "non-existent-server" not found in project settings.',
    );
  });

  it('should exclude default servers when requested for removal', async () => {
    mockSettings = { mcpServers: {} };

    mockedLoadSettings.mockReturnValue({
      forScope: () => ({ settings: mockSettings }),
      setValue: mockSetValue,
      merged: { mcpServers: { ...mockDefaultServers } },
    });

    await parser.parseAsync('remove chrome-devtools');

    expect(mockSetValue).toHaveBeenCalledWith(
      SettingScope.Workspace,
      'mcp.excluded',
      ['chrome-devtools'],
    );
  });
});
