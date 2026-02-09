/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AddMemoryCommand,
  ListMemoryCommand,
  MemoryCommand,
  RefreshMemoryCommand,
  ShowMemoryCommand,
} from './memory.js';
import type { CommandContext } from './types.js';

describe('a2a-server memory commands', () => {
  let mockContext: CommandContext;
  let mockConfig: {
    getUserMemory: ReturnType<typeof vi.fn>;
    getGeminiMdFileCount: ReturnType<typeof vi.fn>;
    refreshContextMemory: ReturnType<typeof vi.fn>;
    getToolRegistry: ReturnType<typeof vi.fn>;
  };
  let mockToolRegistry: {
    getTool: ReturnType<typeof vi.fn>;
  };
  let mockSaveMemoryTool: {
    buildAndExecute: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockSaveMemoryTool = {
      buildAndExecute: vi.fn().mockResolvedValue(undefined),
    };

    mockToolRegistry = {
      getTool: vi.fn().mockReturnValue(mockSaveMemoryTool),
    };

    mockConfig = {
      getUserMemory: vi.fn().mockReturnValue('test memory content'),
      getGeminiMdFileCount: vi.fn().mockReturnValue(2),
      refreshContextMemory: vi.fn().mockResolvedValue(undefined),
      getToolRegistry: vi.fn().mockReturnValue(mockToolRegistry),
    };

    mockContext = {
      config: mockConfig as unknown as CommandContext['config'],
    };
  });

  describe('MemoryCommand', () => {
    it('delegates to ShowMemoryCommand', async () => {
      const command = new MemoryCommand();
      const response = await command.execute(mockContext, []);
      expect(response.data).toContain('Current memory content');
    });
  });

  describe('ShowMemoryCommand', () => {
    it('shows memory content', async () => {
      const command = new ShowMemoryCommand();
      const response = await command.execute(mockContext, []);

      expect(response.name).toBe('memory show');
      expect(response.data).toContain('test memory content');
    });

    it('returns empty message when no memory exists', async () => {
      mockConfig.getUserMemory.mockReturnValue('');
      const command = new ShowMemoryCommand();
      const response = await command.execute(mockContext, []);
      expect(response.data).toBe('Memory is currently empty.');
    });
  });

  describe('RefreshMemoryCommand', () => {
    it('refreshes memory and returns summary', async () => {
      const command = new RefreshMemoryCommand();
      const response = await command.execute(mockContext, []);

      expect(mockConfig.refreshContextMemory).toHaveBeenCalledWith({
        force: true,
      });
      expect(response.name).toBe('memory refresh');
      expect(response.data).toBe(
        'Memory refreshed successfully. Loaded 19 characters from 2 file(s).',
      );
    });
  });

  describe('ListMemoryCommand', () => {
    it('lists discovered memory files from context markers', async () => {
      mockConfig.getUserMemory.mockReturnValue(
        [
          '--- Context from: .papert/papert.md ---',
          'A',
          '--- End of Context from: .papert/papert.md ---',
          '--- Context from: papert.md ---',
          'B',
          '--- End of Context from: papert.md ---',
        ].join('\n'),
      );
      const command = new ListMemoryCommand();
      const response = await command.execute(mockContext, []);

      expect(response.name).toBe('memory list');
      expect(response.data).toBe(
        'There are 2 papert.md file(s) in use:\n\n.papert/papert.md\npapert.md',
      );
    });

    it('returns unavailable-paths message when only count is known', async () => {
      mockConfig.getUserMemory.mockReturnValue('');
      mockConfig.getGeminiMdFileCount.mockReturnValue(1);
      const command = new ListMemoryCommand();
      const response = await command.execute(mockContext, []);
      expect(response.data).toBe(
        'There are 1 papert.md file(s) in use, but file paths are unavailable in this runtime.',
      );
    });
  });

  describe('AddMemoryCommand', () => {
    it('returns usage when argument is empty', async () => {
      const command = new AddMemoryCommand();
      const response = await command.execute(mockContext, []);

      expect(response.name).toBe('memory add');
      expect(response.data).toBe('Usage: /memory add <text to remember>');
    });

    it('executes save_memory tool and refreshes memory', async () => {
      const command = new AddMemoryCommand();
      const fact = 'this is a new fact';
      const response = await command.execute(mockContext, [
        'this',
        'is',
        'a',
        'new',
        'fact',
      ]);

      expect(mockConfig.getToolRegistry).toHaveBeenCalled();
      expect(mockToolRegistry.getTool).toHaveBeenCalledWith('save_memory');
      expect(mockSaveMemoryTool.buildAndExecute).toHaveBeenCalledWith(
        { fact },
        expect.any(AbortSignal),
        undefined,
        undefined,
      );
      expect(mockConfig.refreshContextMemory).toHaveBeenCalledWith({
        force: true,
      });
      expect(response.name).toBe('memory add');
      expect(response.data).toBe(`Added memory: "${fact}"`);
    });

    it('returns an error if save_memory tool is not found', async () => {
      const command = new AddMemoryCommand();
      mockToolRegistry.getTool.mockReturnValue(undefined);

      const response = await command.execute(mockContext, ['another', 'fact']);

      expect(response.name).toBe('memory add');
      expect(response.data).toBe('Error: Tool save_memory not found.');
    });
  });
});
