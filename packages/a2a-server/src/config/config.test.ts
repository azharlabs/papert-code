/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from './config.js';
import type { Settings } from './settings.js';

const mockVerifyGitAvailability = vi.hoisted(() => vi.fn());
const mockConfigCtor = vi.hoisted(() => vi.fn());

vi.mock('@papert-code/papert-code-core', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@papert-code/papert-code-core')>();

  class MockConfig {
    initialize = vi.fn().mockResolvedValue(undefined);
    refreshAuth = vi.fn().mockResolvedValue(undefined);
    constructor(params: unknown) {
      mockConfigCtor(params);
    }
  }

  class MockFileDiscoveryService {
    constructor(_workspaceDir: string) {}
  }

  return {
    ...actual,
    Config: MockConfig,
    FileDiscoveryService: MockFileDiscoveryService,
    loadServerHierarchicalMemory: vi
      .fn()
      .mockResolvedValue({ memoryContent: '', fileCount: 0 }),
    GitService: {
      verifyGitAvailability: mockVerifyGitAvailability,
    },
  };
});

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('loadConfig checkpointing guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env['PAPERT_OAUTH'] = '1';
  });

  it('disables checkpointing when git is unavailable', async () => {
    mockVerifyGitAvailability.mockResolvedValue(false);
    const settings: Settings = {
      checkpointing: { enabled: true },
    };

    await loadConfig(settings, [], 'task-id');

    expect(mockVerifyGitAvailability).toHaveBeenCalled();
    expect(mockConfigCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        checkpointing: false,
      }),
    );
  });

  it('keeps checkpointing enabled when git is available', async () => {
    mockVerifyGitAvailability.mockResolvedValue(true);
    const settings: Settings = {
      checkpointing: { enabled: true },
    };

    await loadConfig(settings, [], 'task-id');

    expect(mockConfigCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        checkpointing: true,
      }),
    );
  });
});
