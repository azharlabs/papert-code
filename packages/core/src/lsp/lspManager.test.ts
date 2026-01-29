/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Config } from '../config/config.js';
import { LspManager } from './lspManager.js';
import type { BuiltInLspServer } from './lspRegistry.js';

vi.mock('./lspClient.js', () => {
  class MockLspClient {
    constructor(_options: unknown) {}
    onNotification() {}
    async initialize() {}
    dispose() {}
  }
  return { LspClient: MockLspClient };
});

vi.mock('./lspRegistry.js', async () => {
  const actual = await vi.importActual<
    typeof import('./lspRegistry.js')
  >('./lspRegistry.js');
  return {
    ...actual,
    getBuiltInLspServers: vi.fn(),
    resolveBuiltInCommand: vi.fn(),
    findExecutable: vi.fn(() => null),
  };
});

describe('LspManager auto-install behavior', () => {
  const projectRoot = path.resolve(__dirname, '../../../..');
  const filePath = path.join(projectRoot, 'index.ts');
  const builtinServer: BuiltInLspServer = {
    id: 'typescript',
    label: 'TypeScript',
    extensions: ['.ts'],
    command: ['typescript-language-server', '--stdio'],
    npm: { packages: ['typescript', 'typescript-language-server'] },
  };

  let getBuiltInLspServers: ReturnType<typeof vi.fn>;
  let resolveBuiltInCommand: ReturnType<typeof vi.fn>;

  const createConfig = (
    overrides: Partial<ConstructorParameters<typeof Config>[0]> = {},
  ) =>
    new Config({
      targetDir: projectRoot,
      cwd: projectRoot,
      debugMode: true,
      lsp: {
        enabled: true,
        autoDetect: true,
        autoInstall: true,
        servers: {},
      },
      trustedFolder: true,
      ...overrides,
    });

  beforeEach(async () => {
    const registry = await import('./lspRegistry.js');
    getBuiltInLspServers = vi.mocked(
      registry.getBuiltInLspServers,
    ) as ReturnType<typeof vi.fn>;
    resolveBuiltInCommand = vi.mocked(
      registry.resolveBuiltInCommand,
    ) as ReturnType<typeof vi.fn>;
    getBuiltInLspServers.mockReturnValue([builtinServer]);
    resolveBuiltInCommand.mockImplementation(async (_server, allowInstall) => {
      if (!allowInstall) return null;
      return {
        command: ['/bin/tsserver', '--stdio'],
        source: 'install',
      };
    });
  });

  afterEach(() => {
    delete process.env['PAPERT_DISABLE_LSP_DOWNLOAD'];
    delete process.env['SEATBELT_PROFILE'];
    vi.clearAllMocks();
  });

  it('attempts auto-install when enabled and trusted', async () => {
    const config = createConfig();
    const manager = new LspManager(config);

    const result = await manager.getClientForFile(filePath);

    expect(result).not.toBeNull();
    expect(resolveBuiltInCommand).toHaveBeenCalledWith(builtinServer, false);
    expect(resolveBuiltInCommand).toHaveBeenCalledWith(builtinServer, true);
  });

  it('skips auto-install when disabled in settings', async () => {
    const config = createConfig({
      lsp: {
        enabled: true,
        autoDetect: true,
        autoInstall: false,
        servers: {},
      },
    });
    const manager = new LspManager(config);

    const result = await manager.getClientForFile(filePath);

    expect(result).toBeNull();
    expect(resolveBuiltInCommand).toHaveBeenCalledWith(builtinServer, false);
    expect(resolveBuiltInCommand).not.toHaveBeenCalledWith(builtinServer, true);
  });

  it('skips auto-install when workspace is untrusted', async () => {
    const config = createConfig({ trustedFolder: false });
    const manager = new LspManager(config);

    const result = await manager.getClientForFile(filePath);

    expect(result).toBeNull();
    expect(resolveBuiltInCommand).toHaveBeenCalledWith(builtinServer, false);
    expect(resolveBuiltInCommand).not.toHaveBeenCalledWith(builtinServer, true);
  });

  it('skips auto-install when download is disabled by env', async () => {
    process.env['PAPERT_DISABLE_LSP_DOWNLOAD'] = 'true';
    const config = createConfig();
    const manager = new LspManager(config);

    const result = await manager.getClientForFile(filePath);

    expect(result).toBeNull();
    expect(resolveBuiltInCommand).toHaveBeenCalledWith(builtinServer, false);
    expect(resolveBuiltInCommand).not.toHaveBeenCalledWith(builtinServer, true);
  });

  it('skips auto-install in restrictive sandbox', async () => {
    process.env['SEATBELT_PROFILE'] = 'restrictive-test';
    const config = createConfig({
      sandbox: { command: 'sandbox-exec', image: 'test-image' },
    });
    const manager = new LspManager(config);

    const result = await manager.getClientForFile(filePath);

    expect(result).toBeNull();
    expect(resolveBuiltInCommand).toHaveBeenCalledWith(builtinServer, false);
    expect(resolveBuiltInCommand).not.toHaveBeenCalledWith(builtinServer, true);
  });
});
