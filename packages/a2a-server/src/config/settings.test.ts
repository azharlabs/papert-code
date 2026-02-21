/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { loadSettings, USER_SETTINGS_PATH } from './settings.js';
import { debugLogger, PAPERT_DIR } from '@papert-code/papert-code-core';

const mocks = vi.hoisted(() => {
  const suffix = Math.random().toString(36).slice(2);
  return {
    suffix,
  };
});

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  const path = await import('node:path');
  return {
    ...actual,
    homedir: () => path.join(actual.tmpdir(), `papert-home-${mocks.suffix}`),
  };
});

vi.mock('@papert-code/papert-code-core', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@papert-code/papert-code-core')>();

  return {
    ...actual,
    debugLogger: {
      ...actual.debugLogger,
      error: vi.fn(),
    },
  };
});

describe('loadSettings', () => {
  const mockHomeDir = path.join(os.tmpdir(), `papert-home-${mocks.suffix}`);
  const mockWorkspaceDir = path.join(
    os.tmpdir(),
    `papert-workspace-${mocks.suffix}`,
  );
  const mockPapertHomeDir = path.join(mockHomeDir, PAPERT_DIR);
  const mockPapertWorkspaceDir = path.join(mockWorkspaceDir, PAPERT_DIR);

  beforeEach(() => {
    vi.clearAllMocks();
    // Create the directories using the real fs
    if (!fs.existsSync(mockPapertHomeDir)) {
      fs.mkdirSync(mockPapertHomeDir, { recursive: true });
    }
    if (!fs.existsSync(mockPapertWorkspaceDir)) {
      fs.mkdirSync(mockPapertWorkspaceDir, { recursive: true });
    }

    // Clean up settings files before each test
    if (fs.existsSync(USER_SETTINGS_PATH)) {
      fs.rmSync(USER_SETTINGS_PATH);
    }
    const workspaceSettingsPath = path.join(
      mockPapertWorkspaceDir,
      'settings.json',
    );
    if (fs.existsSync(workspaceSettingsPath)) {
      fs.rmSync(workspaceSettingsPath);
    }
  });

  afterEach(() => {
    try {
      if (fs.existsSync(mockHomeDir)) {
        fs.rmSync(mockHomeDir, { recursive: true, force: true });
      }
      if (fs.existsSync(mockWorkspaceDir)) {
        fs.rmSync(mockWorkspaceDir, { recursive: true, force: true });
      }
    } catch (e) {
      debugLogger.error('Failed to cleanup temp dirs', e);
    }
    vi.restoreAllMocks();
  });

  it('normalizes v2 nested settings into server-consumed canonical fields', () => {
    const settings = {
      tools: {
        core: ['read_file'],
        exclude: ['run_shell_command'],
      },
      ui: {
        showMemoryUsage: true,
      },
      general: {
        checkpointing: {
          enabled: true,
        },
        previewFeatures: true,
      },
      context: {
        fileFiltering: {
          respectGitIgnore: true,
          respectPapertIgnore: false,
          enableRecursiveFileSearch: true,
          customIgnoreFilePaths: ['.custom.ignore'],
        },
      },
      security: {
        folderTrust: {
          enabled: true,
        },
        auth: {
          selectedType: 'use_openai',
        },
      },
      mcp: {
        servers: {
          local: {
            command: 'node',
            args: ['server.js'],
          },
        },
      },
    };
    fs.writeFileSync(USER_SETTINGS_PATH, JSON.stringify(settings));

    const result = loadSettings(mockWorkspaceDir);
    expect(result.coreTools).toEqual(['read_file']);
    expect(result.excludeTools).toEqual(['run_shell_command']);
    expect(result.showMemoryUsage).toBe(true);
    expect(result.checkpointing?.enabled).toBe(true);
    expect(result.folderTrust).toBe(true);
    expect(result.mcpServers).toHaveProperty('local');
    expect(result.fileFiltering?.customIgnoreFilePaths).toEqual([
      '.custom.ignore',
    ]);
    expect(result.general?.previewFeatures).toBe(true);
  });

  it('keeps legacy flat settings compatible', () => {
    const settings = {
      coreTools: ['legacy-read'],
      excludeTools: ['legacy-shell'],
      showMemoryUsage: true,
      checkpointing: {
        enabled: true,
      },
      folderTrust: true,
      fileFiltering: {
        respectGitIgnore: true,
      },
    };
    const workspaceSettingsPath = path.join(
      mockPapertWorkspaceDir,
      'settings.json',
    );
    fs.writeFileSync(workspaceSettingsPath, JSON.stringify(settings));

    const result = loadSettings(mockWorkspaceDir);
    expect(result.coreTools).toEqual(['legacy-read']);
    expect(result.excludeTools).toEqual(['legacy-shell']);
    expect(result.showMemoryUsage).toBe(true);
    expect(result.checkpointing?.enabled).toBe(true);
    expect(result.folderTrust).toBe(true);
    expect(result.security?.folderTrust?.enabled).toBe(true);
    expect(result.fileFiltering?.respectGitIgnore).toBe(true);
  });

  it('deep merges nested objects while keeping workspace precedence', () => {
    const userSettings = {
      general: {
        checkpointing: {
          enabled: true,
        },
      },
      context: {
        fileFiltering: {
          respectGitIgnore: true,
          enableRecursiveFileSearch: true,
        },
      },
    };
    fs.writeFileSync(USER_SETTINGS_PATH, JSON.stringify(userSettings));

    const workspaceSettings = {
      general: {
        previewFeatures: true,
      },
      context: {
        fileFiltering: {
          respectPapertIgnore: false,
        },
      },
    };
    const workspaceSettingsPath = path.join(
      mockPapertWorkspaceDir,
      'settings.json',
    );
    fs.writeFileSync(workspaceSettingsPath, JSON.stringify(workspaceSettings));

    const result = loadSettings(mockWorkspaceDir);
    expect(result.general?.previewFeatures).toBe(true);
    expect(result.general?.checkpointing).toEqual({ enabled: true });
    expect(result.fileFiltering).toEqual({
      respectGitIgnore: true,
      respectPapertIgnore: false,
      enableRecursiveFileSearch: true,
    });
  });

  it('workspace arrays override user arrays for canonical tool fields', () => {
    fs.writeFileSync(
      USER_SETTINGS_PATH,
      JSON.stringify({
        tools: {
          core: ['read_file', 'grep'],
        },
      }),
    );
    const workspaceSettingsPath = path.join(
      mockPapertWorkspaceDir,
      'settings.json',
    );
    fs.writeFileSync(
      workspaceSettingsPath,
      JSON.stringify({
        tools: {
          core: ['write_file'],
        },
      }),
    );

    const result = loadSettings(mockWorkspaceDir);
    expect(result.coreTools).toEqual(['write_file']);
  });

  it('resolves environment variables in nested values', () => {
    process.env['TEST_PAPERT_BASE_URL'] = 'https://api.example.dev/v1';
    const settings = {
      security: {
        auth: {
          baseUrl: '$TEST_PAPERT_BASE_URL',
          selectedType: 'use_openai',
        },
      },
    };
    fs.writeFileSync(USER_SETTINGS_PATH, JSON.stringify(settings));

    const result = loadSettings(mockWorkspaceDir);
    expect(result.security?.auth?.baseUrl).toBe('https://api.example.dev/v1');
  });
});
