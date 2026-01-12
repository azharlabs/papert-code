/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from 'vitest';
import { ExtensionsCommand, ListExtensionsCommand } from './extensions.js';
import type { CommandContext } from './types.js';

describe('ExtensionsCommand', () => {
  it('should have the correct name', () => {
    const command = new ExtensionsCommand();
    expect(command.name).toEqual('extensions');
  });

  it('should have the correct description', () => {
    const command = new ExtensionsCommand();
    expect(command.description).toEqual('Manage extensions.');
  });

  it('should have "extensions list" as a subcommand', () => {
    const command = new ExtensionsCommand();
    expect(command.subCommands.map((c) => c.name)).toContain('extensions list');
  });

  it('should be a top-level command', () => {
    const command = new ExtensionsCommand();
    expect(command.topLevel).toBe(true);
  });

  it('should default to listing extensions', async () => {
    const command = new ExtensionsCommand();
    const mockGetExtensions = vi.fn();
    const mockConfig = {
      config: { getExtensions: mockGetExtensions },
    } as CommandContext;
    const mockExtensions = [{ name: 'ext1' }];
    mockGetExtensions.mockReturnValue(mockExtensions);

    const result = await command.execute(mockConfig, []);

    expect(result).toEqual({ name: 'extensions list', data: mockExtensions });
    expect(mockGetExtensions).toHaveBeenCalledWith();
  });
});

describe('ListExtensionsCommand', () => {
  it('should have the correct name', () => {
    const command = new ListExtensionsCommand();
    expect(command.name).toEqual('extensions list');
  });

  it('should call getExtensions on the provided config', async () => {
    const command = new ListExtensionsCommand();
    const mockGetExtensions = vi.fn();
    const mockConfig = {
      config: { getExtensions: mockGetExtensions },
    } as CommandContext;
    const mockExtensions = [{ name: 'ext1' }];
    mockGetExtensions.mockReturnValue(mockExtensions);

    const result = await command.execute(mockConfig, []);

    expect(result).toEqual({ name: 'extensions list', data: mockExtensions });
    expect(mockGetExtensions).toHaveBeenCalledWith();
  });

  it('should return a message when no extensions are installed', async () => {
    const command = new ListExtensionsCommand();
    const mockGetExtensions = vi.fn();
    const mockConfig = {
      config: { getExtensions: mockGetExtensions },
    } as CommandContext;
    mockGetExtensions.mockReturnValue([]);

    const result = await command.execute(mockConfig, []);

    expect(result).toEqual({
      name: 'extensions list',
      data: 'No extensions installed.',
    });
    expect(mockGetExtensions).toHaveBeenCalledWith();
  });
});
