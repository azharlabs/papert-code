/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { listMcpServers } from './list.js';
import { loadSettings } from '../../config/settings.js';
import { ExtensionStorage, loadExtensions } from '../../config/extension.js';
import { createTransport } from '@papert-code/papert-code-core';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

const mockDefaultServers = {
  'chrome-devtools': {
    command: 'npx',
    args: ['-y', 'chrome-devtools-mcp@latest'],
  },
};

vi.mock('../../config/settings.js', () => ({
  loadSettings: vi.fn(),
}));

vi.mock('../../config/extension.js', () => ({
  loadExtensions: vi.fn(),
  ExtensionStorage: {
    getUserExtensionsDir: vi.fn(),
  },
}));

vi.mock('../../config/defaultMcpServers.js', () => ({
  getDefaultMcpServers: vi.fn(() => ({ ...mockDefaultServers })),
}));

vi.mock('@papert-code/papert-code-core', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@papert-code/papert-code-core')>();

  // ✅ Storage needs BOTH constructor usage + static helpers used by SkillStorage
  const StorageCtor = vi.fn().mockImplementation((_cwd: string) => ({
    getGlobalSettingsPath: () => '/tmp/papert/settings.json',
    getWorkspaceSettingsPath: () => '/tmp/papert/workspace-settings.json',
    getProjectTempDir: () => '/test/home/.papert/tmp/mocked_hash',
  }));

  // ✅ static APIs used by src/config/skill.ts
  StorageCtor.getUserSkillsDir = vi.fn(() => '/tmp/papert/skills');
  StorageCtor.getWorkspaceSkillsDir = vi.fn(() => '/tmp/papert/workspace-skills');
  StorageCtor.getUserPapertDir = vi.fn(() => '/tmp/papert');
  StorageCtor.getGlobalPapertDir = vi.fn(() => '/tmp/papert');
  StorageCtor.getPapertConfigDir = vi.fn(() => '/tmp/papert/.papert');

  return {
    ...actual,
    createTransport: vi.fn(),
    MCPServerStatus: {
      CONNECTED: 'CONNECTED',
      CONNECTING: 'CONNECTING',
      DISCONNECTED: 'DISCONNECTED',
    },
    Storage: StorageCtor as any,

    PAPERT_CONFIG_DIR: '.papert',
    PAPERT_DIR: '/tmp/papert', // required by src/config/skill.ts
    getErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  };
});

vi.mock('@modelcontextprotocol/sdk/client/index.js');

const mockedExtensionStorage = ExtensionStorage as unknown as vi.Mock;
const mockedLoadSettings = loadSettings as unknown as vi.Mock;
const mockedLoadExtensions = loadExtensions as unknown as vi.Mock;
const mockedCreateTransport = createTransport as unknown as vi.Mock;
const MockedClient = Client as unknown as vi.Mock;

interface MockClient {
  connect: vi.Mock;
  ping: vi.Mock;
  close: vi.Mock;
}

interface MockTransport {
  close: vi.Mock;
}

describe('mcp list command', () => {
  let consoleSpy: vi.SpyInstance;
  let mockClient: MockClient;
  let mockTransport: MockTransport;

  beforeEach(() => {
    vi.resetAllMocks();

    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    mockTransport = { close: vi.fn() };
    mockClient = {
      connect: vi.fn(),
      ping: vi.fn(),
      close: vi.fn(),
    };

    MockedClient.mockImplementation(() => mockClient);
    mockedCreateTransport.mockResolvedValue(mockTransport);

    mockedLoadExtensions.mockReturnValue([]);
    mockedExtensionStorage.getUserExtensionsDir.mockReturnValue(
      '/mocked/extensions/dir',
    );
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should list default servers when no user servers are configured', async () => {
    mockedLoadSettings.mockReturnValue({ merged: { mcpServers: {} } });

    mockClient.connect.mockResolvedValue(undefined);
    mockClient.ping.mockResolvedValue(undefined);

    await listMcpServers();

    expect(consoleSpy).toHaveBeenCalledWith('Configured MCP servers:\n');
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'chrome-devtools: npx -y chrome-devtools-mcp@latest (stdio) - Connected',
      ),
    );
  });

  it('should display different server types with connected status', async () => {
    mockedLoadSettings.mockReturnValue({
      merged: {
        mcpServers: {
          'stdio-server': { command: '/path/to/server', args: ['arg1'] },
          'sse-server': { url: 'https://example.com/sse' },
          'http-server': { httpUrl: 'https://example.com/http' },
        },
      },
    });

    mockClient.connect.mockResolvedValue(undefined);
    mockClient.ping.mockResolvedValue(undefined);

    await listMcpServers();

    expect(consoleSpy).toHaveBeenCalledWith('Configured MCP servers:\n');
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'stdio-server: /path/to/server arg1 (stdio) - Connected',
      ),
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'sse-server: https://example.com/sse (sse) - Connected',
      ),
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'http-server: https://example.com/http (http) - Connected',
      ),
    );
  });

  it('should display disconnected status when connection fails', async () => {
    mockedLoadSettings.mockReturnValue({
      merged: {
        mcpServers: {
          'test-server': { command: '/test/server' },
        },
      },
    });

    mockClient.connect.mockRejectedValue(new Error('Connection failed'));

    await listMcpServers();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'test-server: /test/server  (stdio) - Disconnected',
      ),
    );
  });

  it('should merge extension servers with config servers', async () => {
    mockedLoadSettings.mockReturnValue({
      merged: {
        mcpServers: { 'config-server': { command: '/config/server' } },
      },
    });

    mockedLoadExtensions.mockReturnValue([
      {
        config: {
          name: 'test-extension',
          mcpServers: { 'extension-server': { command: '/ext/server' } },
        },
      },
    ]);

    mockClient.connect.mockResolvedValue(undefined);
    mockClient.ping.mockResolvedValue(undefined);

    await listMcpServers();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'config-server: /config/server  (stdio) - Connected',
      ),
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'extension-server (from test-extension): /ext/server  (stdio) - Connected',
      ),
    );
  });
});
