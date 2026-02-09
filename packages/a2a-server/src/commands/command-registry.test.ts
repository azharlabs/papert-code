/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Command } from './types.js';

describe('CommandRegistry', { timeout: 15000 }, () => {
  const mockListExtensionsCommandInstance: Command = {
    name: 'extensions list',
    description: 'Lists all installed extensions.',
    execute: vi.fn(),
  };
  const mockListExtensionsCommand = vi.fn(
    () => mockListExtensionsCommandInstance,
  );

  const mockExtensionsCommandInstance: Command = {
    name: 'extensions',
    description: 'Manage extensions.',
    execute: vi.fn(),
    subCommands: [mockListExtensionsCommandInstance],
  };
  const mockExtensionsCommand = vi.fn(() => mockExtensionsCommandInstance);

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock('./extensions.js', () => ({
      ExtensionsCommand: mockExtensionsCommand,
      ListExtensionsCommand: mockListExtensionsCommand,
    }));
    vi.doMock('./restore.js', () => ({
      RestoreCommand: class RestoreCommand {
        name = 'restore';
        description = 'Restore command (mock).';
        execute = vi.fn();
      },
    }));
    vi.doMock('./init.js', () => ({
      InitCommand: class InitCommand {
        name = 'init';
        description = 'Init command (mock).';
        execute = vi.fn();
      },
    }));
    vi.doMock('./memory.js', () => ({
      MemoryCommand: class MemoryCommand {
        name = 'memory';
        description = 'Memory command (mock).';
        execute = vi.fn();
      },
    }));
  });

  it('should register ExtensionsCommand on initialization', async () => {
    const { commandRegistry } = await import('./command-registry.js');
    expect(mockExtensionsCommand).toHaveBeenCalled();
    const command = commandRegistry.get('extensions');
    expect(command).toBe(mockExtensionsCommandInstance);
  });

  it('should register sub commands on initialization', async () => {
    const { commandRegistry } = await import('./command-registry.js');
    const command = commandRegistry.get('extensions list');
    expect(command).toBe(mockListExtensionsCommandInstance);
  });

  it('get() should return undefined for a non-existent command', async () => {
    const { commandRegistry } = await import('./command-registry.js');
    const command = commandRegistry.get('non-existent');
    expect(command).toBeUndefined();
  });

  it('register() should register a new command', async () => {
    const { commandRegistry } = await import('./command-registry.js');
    const mockCommand: Command = {
      name: 'test-command',
      description: '',
      execute: vi.fn(),
    };
    commandRegistry.register(mockCommand);
    const command = commandRegistry.get('test-command');
    expect(command).toBe(mockCommand);
  });

  it('register() should register a nested command', async () => {
    const { commandRegistry } = await import('./command-registry.js');
    const mockSubSubCommand: Command = {
      name: 'test-command-sub-sub',
      description: '',
      execute: vi.fn(),
    };
    const mockSubCommand: Command = {
      name: 'test-command-sub',
      description: '',
      execute: vi.fn(),
      subCommands: [mockSubSubCommand],
    };
    const mockCommand: Command = {
      name: 'test-command',
      description: '',
      execute: vi.fn(),
      subCommands: [mockSubCommand],
    };
    commandRegistry.register(mockCommand);

    const command = commandRegistry.get('test-command');
    const subCommand = commandRegistry.get('test-command-sub');
    const subSubCommand = commandRegistry.get('test-command-sub-sub');

    expect(command).toBe(mockCommand);
    expect(subCommand).toBe(mockSubCommand);
    expect(subSubCommand).toBe(mockSubSubCommand);
  });

  it('register() should not enter an infinite loop with a cyclic command', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
    const { commandRegistry } = await import('./command-registry.js');
    const mockCommand: Command = {
      name: 'cyclic-command',
      description: '',
      subCommands: [],
      execute: vi.fn(),
    };

    mockCommand.subCommands?.push(mockCommand); // Create cycle

    commandRegistry.register(mockCommand);

    expect(commandRegistry.get('cyclic-command')).toBe(mockCommand);
    expect(warnSpy).toHaveBeenCalledWith(
      'Command cyclic-command already registered. Skipping.',
    );
    // If the test finishes, it means we didn't get into an infinite loop.
    warnSpy.mockRestore();
  });

  it('initialize() should clear ad-hoc commands and restore defaults', async () => {
    const { commandRegistry } = await import('./command-registry.js');
    commandRegistry.register({
      name: 'temporary-command',
      description: 'Temporary command',
      execute: vi.fn(),
    });
    expect(commandRegistry.get('temporary-command')).toBeDefined();

    commandRegistry.initialize();

    expect(commandRegistry.get('temporary-command')).toBeUndefined();
    expect(commandRegistry.get('extensions')).toBeDefined();
    expect(commandRegistry.get('restore')).toBeDefined();
    expect(commandRegistry.get('init')).toBeDefined();
    expect(commandRegistry.get('memory')).toBeDefined();
  });
});
