/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContextManager } from './contextManager.js';
import * as memoryDiscovery from '../utils/memoryDiscovery.js';
import type { Config } from '../config/config.js';

// Mock memoryDiscovery module
vi.mock('../utils/memoryDiscovery.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../utils/memoryDiscovery.js')>();
  return {
    ...actual,
    loadGlobalMemory: vi.fn(),
    loadEnvironmentMemory: vi.fn(),
    loadJitSubdirectoryMemory: vi.fn(),
  };
});

describe('ContextManager', () => {
  let contextManager: ContextManager;
  let mockConfig: Config;

  beforeEach(() => {
    mockConfig = {
      getDebugMode: vi.fn().mockReturnValue(false),
      getWorkingDir: vi.fn().mockReturnValue('/app'),
    } as unknown as Config;

    contextManager = new ContextManager(mockConfig);
    vi.clearAllMocks();
  });

  describe('loadGlobalMemory', () => {
    it('loads and formats global memory', async () => {
      const mockResult: memoryDiscovery.MemoryLoadResult = {
        files: [
          { path: '/home/user/.papert/papert.md', content: 'Global Content' },
        ],
      };
      vi.mocked(memoryDiscovery.loadGlobalMemory).mockResolvedValue(mockResult);

      const result = await contextManager.loadGlobalMemory();

      expect(memoryDiscovery.loadGlobalMemory).toHaveBeenCalledWith(false);
      expect(result).toMatch(/--- Context from: .*papert\.md ---/);
      expect(result).toContain('Global Content');
      expect(contextManager.getLoadedPaths()).toContain(
        '/home/user/.papert/papert.md',
      );
      expect(contextManager.getGlobalMemory()).toBe(result);
    });
  });

  describe('loadEnvironmentMemory', () => {
    it('loads and formats environment memory', async () => {
      const mockResult: memoryDiscovery.MemoryLoadResult = {
        files: [{ path: '/app/papert.md', content: 'Env Content' }],
      };
      vi.mocked(memoryDiscovery.loadEnvironmentMemory).mockResolvedValue(
        mockResult,
      );

      const result = await contextManager.loadEnvironmentMemory(
        ['/app'],
        ['/app/ext/papert.md'],
      );

      expect(memoryDiscovery.loadEnvironmentMemory).toHaveBeenCalledWith(
        ['/app'],
        ['/app/ext/papert.md'],
        false,
      );
      expect(result).toContain('--- Context from: papert.md ---');
      expect(result).toContain('Env Content');
      expect(contextManager.getLoadedPaths()).toContain('/app/papert.md');
      expect(contextManager.getEnvironmentMemory()).toBe(result);
    });
  });

  describe('discoverContext', () => {
    it('discovers and loads new context', async () => {
      const mockResult: memoryDiscovery.MemoryLoadResult = {
        files: [{ path: '/app/src/papert.md', content: 'Src Content' }],
      };
      vi.mocked(memoryDiscovery.loadJitSubdirectoryMemory).mockResolvedValue(
        mockResult,
      );

      const result = await contextManager.discoverContext('/app/src/file.ts', [
        '/app',
      ]);

      expect(memoryDiscovery.loadJitSubdirectoryMemory).toHaveBeenCalledWith(
        '/app/src/file.ts',
        ['/app'],
        expect.any(Set),
        false,
      );
      expect(result).toMatch(/--- Context from: src[\\/]papert\.md ---/);
      expect(result).toContain('Src Content');
      expect(contextManager.getLoadedPaths()).toContain('/app/src/papert.md');
    });

    it('returns empty string if no new files found', async () => {
      const mockResult: memoryDiscovery.MemoryLoadResult = { files: [] };
      vi.mocked(memoryDiscovery.loadJitSubdirectoryMemory).mockResolvedValue(
        mockResult,
      );

      const result = await contextManager.discoverContext('/app/src/file.ts', [
        '/app',
      ]);

      expect(result).toBe('');
    });
  });

  describe('reset', () => {
    it('clears loaded paths and memory', async () => {
      const mockResult: memoryDiscovery.MemoryLoadResult = {
        files: [
          { path: '/home/user/.papert/papert.md', content: 'Global Content' },
        ],
      };
      vi.mocked(memoryDiscovery.loadGlobalMemory).mockResolvedValue(mockResult);
      await contextManager.loadGlobalMemory();

      expect(contextManager.getLoadedPaths().size).toBeGreaterThan(0);
      expect(contextManager.getGlobalMemory()).toBeTruthy();

      contextManager.reset();

      expect(contextManager.getLoadedPaths().size).toBe(0);
      expect(contextManager.getGlobalMemory()).toBe('');
      expect(contextManager.getEnvironmentMemory()).toBe('');
    });
  });
});
