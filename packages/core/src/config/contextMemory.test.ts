/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Config } from './config.js';
import { AuthType } from '../core/contentGenerator.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const memoryMocks = vi.hoisted(() => {
  const mockLoadGlobalMemory = vi.fn();
  const mockLoadEnvironmentMemory = vi.fn();
  const mockLoadJitSubdirectoryMemory = vi.fn();
  const mockConcatenate = vi.fn(
    (files: Array<{ filePath: string; content: string }>) =>
      files
        .map(
          (f) =>
            `--- Context from: ${f.filePath} ---\n${f.content}\n--- End of Context from: ${f.filePath} ---`,
        )
        .join('\n\n'),
  );

  return {
    mockLoadGlobalMemory,
    mockLoadEnvironmentMemory,
    mockLoadJitSubdirectoryMemory,
    mockConcatenate,
  };
});

vi.mock('../utils/memoryDiscovery.js', () => ({
  loadGlobalMemory: memoryMocks.mockLoadGlobalMemory,
  loadEnvironmentMemory: memoryMocks.mockLoadEnvironmentMemory,
  loadJitSubdirectoryMemory: memoryMocks.mockLoadJitSubdirectoryMemory,
  concatenateInstructions: memoryMocks.mockConcatenate,
}));

function createConfig(
  overrides: Partial<ConstructorParameters<typeof Config>[0]> = {},
) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'papert-context-'));
  return new Config({
    targetDir: dir,
    includeDirectories: [dir],
    debugMode: false,
    generationConfig: {
      model: 'qwen3-coder-14b',
      authType: AuthType.USE_GEMINI,
    },
    ...overrides,
  });
}

describe('Config.refreshContextMemory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    memoryMocks.mockLoadGlobalMemory.mockResolvedValue({
      files: [{ path: '/home/.papert/papert.md', content: 'global' }],
    });
    memoryMocks.mockLoadEnvironmentMemory.mockResolvedValue({
      files: [{ path: '/app/papert.md', content: 'env' }],
    });
    memoryMocks.mockLoadJitSubdirectoryMemory.mockResolvedValue({ files: [] });
  });

  it('loads global and environment memory and sets userMemory/count', async () => {
    const config = createConfig();
    const dirs = config.getWorkspaceContext().getDirectories();

    await config.refreshContextMemory({ force: true });

    expect(memoryMocks.mockLoadGlobalMemory).toHaveBeenCalled();
    expect(memoryMocks.mockLoadEnvironmentMemory).toHaveBeenCalledWith(
      dirs,
      [],
      false,
    );
    expect(config.getUserMemory()).toContain('global');
    expect(config.getUserMemory()).toContain('env');
    expect(config.getGeminiMdFileCount()).toBe(2);
  });

  it('skips environment memory when folder is untrusted', async () => {
    const config = createConfig({ trustedFolder: false });

    await config.refreshContextMemory({ force: true });

    expect(memoryMocks.mockLoadGlobalMemory).toHaveBeenCalled();
    expect(memoryMocks.mockLoadEnvironmentMemory).not.toHaveBeenCalled();
  });

  it('does not overwrite existing userMemory unless forced', async () => {
    const config = createConfig({ userMemory: 'keep me' });

    await config.refreshContextMemory();

    expect(memoryMocks.mockLoadGlobalMemory).not.toHaveBeenCalled();
    expect(config.getUserMemory()).toBe('keep me');
  });
});
