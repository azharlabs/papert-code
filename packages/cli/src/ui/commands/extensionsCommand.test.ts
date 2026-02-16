/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GeminiCLIExtension } from '@papert-code/papert-code-core';
import type { ExtensionInstallMetadata } from '@papert-code/papert-code-core';
import {
  disableExtension,
  enableExtension,
  installExtension,
  loadExtensionByName,
  toOutputString,
  uninstallExtension,
} from '../../config/extension.js';
import { parseInstallSource } from '../../config/extensions/marketplace.js';
import { exploreMarketplacePlugins } from '../../config/extensions/explore.js';
import {
  updateAllUpdatableExtensions,
  updateExtension,
} from '../../config/extensions/update.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import { MessageType } from '../types.js';
import { extensionsCommand } from './extensionsCommand.js';
import { type CommandContext } from './types.js';
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type MockedFunction,
} from 'vitest';
import { ExtensionUpdateState } from '../state/extensions.js';

vi.mock('../../config/extensions/update.js', () => ({
  updateExtension: vi.fn(),
  updateAllUpdatableExtensions: vi.fn(),
  checkForAllExtensionUpdates: vi.fn(),
}));

vi.mock('../../config/extension.js', () => ({
  requestConsentInteractive: vi.fn(),
  installExtension: vi.fn(),
  uninstallExtension: vi.fn(),
  disableExtension: vi.fn(),
  enableExtension: vi.fn(),
  loadExtensionByName: vi.fn(),
  toOutputString: vi.fn(),
}));

vi.mock('../../config/extensions/marketplace.js', () => ({
  parseInstallSource: vi.fn(),
}));
vi.mock('../../config/extensions/explore.js', () => ({
  exploreMarketplacePlugins: vi.fn(),
}));

const mockUpdateExtension = updateExtension as MockedFunction<
  typeof updateExtension
>;

const mockUpdateAllUpdatableExtensions =
  updateAllUpdatableExtensions as MockedFunction<
    typeof updateAllUpdatableExtensions
  >;
const mockInstallExtension = installExtension as MockedFunction<
  typeof installExtension
>;
const mockUninstallExtension = uninstallExtension as MockedFunction<
  typeof uninstallExtension
>;
const mockDisableExtension = disableExtension as MockedFunction<
  typeof disableExtension
>;
const mockEnableExtension = enableExtension as MockedFunction<
  typeof enableExtension
>;
const mockLoadExtensionByName = loadExtensionByName as MockedFunction<
  typeof loadExtensionByName
>;
const mockToOutputString = toOutputString as MockedFunction<
  typeof toOutputString
>;
const mockParseInstallSource = parseInstallSource as MockedFunction<
  typeof parseInstallSource
>;
const mockExploreMarketplacePlugins =
  exploreMarketplacePlugins as MockedFunction<typeof exploreMarketplacePlugins>;

const mockGetExtensions = vi.fn();

describe('extensionsCommand', () => {
  let mockContext: CommandContext;

  beforeEach(() => {
    vi.resetAllMocks();
    mockContext = createMockCommandContext({
      services: {
        config: {
          getExtensions: mockGetExtensions,
          getWorkingDir: () => '/test/dir',
        },
      },
      ui: {
        dispatchExtensionStateUpdate: vi.fn(),
      },
    });
  });

  describe('list', () => {
    it('should add an EXTENSIONS_LIST item to the UI', async () => {
      if (!extensionsCommand.action) throw new Error('Action not defined');
      await extensionsCommand.action(mockContext, '');

      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        {
          type: MessageType.EXTENSIONS_LIST,
        },
        expect.any(Number),
      );
    });
  });

  describe('update', () => {
    const updateAction = extensionsCommand.subCommands?.find(
      (cmd) => cmd.name === 'update',
    )?.action;

    if (!updateAction) {
      throw new Error('Update action not found');
    }

    it('should show usage if no args are provided', async () => {
      await updateAction(mockContext, '');
      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        {
          type: MessageType.ERROR,
          text: 'Usage: /extensions update <extension-names>|--all',
        },
        expect.any(Number),
      );
    });

    it('should inform user if there are no extensions to update with --all', async () => {
      mockUpdateAllUpdatableExtensions.mockResolvedValue([]);
      await updateAction(mockContext, '--all');
      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        {
          type: MessageType.INFO,
          text: 'No extensions to update.',
        },
        expect.any(Number),
      );
    });

    it('should call setPendingItem and addItem in a finally block on success', async () => {
      mockUpdateAllUpdatableExtensions.mockResolvedValue([
        {
          name: 'ext-one',
          originalVersion: '1.0.0',
          updatedVersion: '1.0.1',
        },
        {
          name: 'ext-two',
          originalVersion: '2.0.0',
          updatedVersion: '2.0.1',
        },
      ]);
      await updateAction(mockContext, '--all');
      expect(mockContext.ui.setPendingItem).toHaveBeenCalledWith({
        type: MessageType.EXTENSIONS_LIST,
      });
      expect(mockContext.ui.setPendingItem).toHaveBeenCalledWith(null);
      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        {
          type: MessageType.EXTENSIONS_LIST,
        },
        expect.any(Number),
      );
    });

    it('should call setPendingItem and addItem in a finally block on failure', async () => {
      mockUpdateAllUpdatableExtensions.mockRejectedValue(
        new Error('Something went wrong'),
      );
      await updateAction(mockContext, '--all');
      expect(mockContext.ui.setPendingItem).toHaveBeenCalledWith({
        type: MessageType.EXTENSIONS_LIST,
      });
      expect(mockContext.ui.setPendingItem).toHaveBeenCalledWith(null);
      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        {
          type: MessageType.EXTENSIONS_LIST,
        },
        expect.any(Number),
      );
      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        {
          type: MessageType.ERROR,
          text: 'Something went wrong',
        },
        expect.any(Number),
      );
    });

    it('should update a single extension by name', async () => {
      const extension: GeminiCLIExtension = {
        name: 'ext-one',
        version: '1.0.0',
        isActive: true,
        path: '/test/dir/ext-one',
        installMetadata: {
          type: 'git',
          autoUpdate: false,
          source: 'https://github.com/some/extension.git',
        },
      };
      mockUpdateExtension.mockResolvedValue({
        name: extension.name,
        originalVersion: extension.version,
        updatedVersion: '1.0.1',
      });
      mockGetExtensions.mockReturnValue([extension]);
      mockContext.ui.extensionsUpdateState.set(extension.name, {
        status: ExtensionUpdateState.UPDATE_AVAILABLE,
        processed: false,
      });
      await updateAction(mockContext, 'ext-one');
      expect(mockUpdateExtension).toHaveBeenCalledWith(
        extension,
        '/test/dir',
        expect.any(Function),
        ExtensionUpdateState.UPDATE_AVAILABLE,
        expect.any(Function),
      );
    });

    it('should handle errors when updating a single extension', async () => {
      mockUpdateExtension.mockRejectedValue(new Error('Extension not found'));
      mockGetExtensions.mockReturnValue([]);
      await updateAction(mockContext, 'ext-one');
      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        {
          type: MessageType.ERROR,
          text: 'Extension ext-one not found.',
        },
        expect.any(Number),
      );
    });

    it('should update multiple extensions by name', async () => {
      const extensionOne: GeminiCLIExtension = {
        name: 'ext-one',
        version: '1.0.0',
        isActive: true,
        path: '/test/dir/ext-one',
        installMetadata: {
          type: 'git',
          autoUpdate: false,
          source: 'https://github.com/some/extension.git',
        },
      };
      const extensionTwo: GeminiCLIExtension = {
        name: 'ext-two',
        version: '1.0.0',
        isActive: true,
        path: '/test/dir/ext-two',
        installMetadata: {
          type: 'git',
          autoUpdate: false,
          source: 'https://github.com/some/extension.git',
        },
      };
      mockGetExtensions.mockReturnValue([extensionOne, extensionTwo]);
      mockContext.ui.extensionsUpdateState.set(
        extensionOne.name,
        ExtensionUpdateState.UPDATE_AVAILABLE,
      );
      mockContext.ui.extensionsUpdateState.set(
        extensionTwo.name,
        ExtensionUpdateState.UPDATE_AVAILABLE,
      );
      mockUpdateExtension
        .mockResolvedValueOnce({
          name: 'ext-one',
          originalVersion: '1.0.0',
          updatedVersion: '1.0.1',
        })
        .mockResolvedValueOnce({
          name: 'ext-two',
          originalVersion: '2.0.0',
          updatedVersion: '2.0.1',
        });
      await updateAction(mockContext, 'ext-one ext-two');
      expect(mockUpdateExtension).toHaveBeenCalledTimes(2);
      expect(mockContext.ui.setPendingItem).toHaveBeenCalledWith({
        type: MessageType.EXTENSIONS_LIST,
      });
      expect(mockContext.ui.setPendingItem).toHaveBeenCalledWith(null);
      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        {
          type: MessageType.EXTENSIONS_LIST,
        },
        expect.any(Number),
      );
    });

    describe('completion', () => {
      const updateCompletion = extensionsCommand.subCommands?.find(
        (cmd) => cmd.name === 'update',
      )?.completion;

      if (!updateCompletion) {
        throw new Error('Update completion not found');
      }

      const extensionOne: GeminiCLIExtension = {
        name: 'ext-one',
        version: '1.0.0',
        isActive: true,
        path: '/test/dir/ext-one',
        installMetadata: {
          type: 'git',
          autoUpdate: false,
          source: 'https://github.com/some/extension.git',
        },
      };
      const extensionTwo: GeminiCLIExtension = {
        name: 'another-ext',
        version: '1.0.0',
        isActive: true,
        path: '/test/dir/another-ext',
        installMetadata: {
          type: 'git',
          autoUpdate: false,
          source: 'https://github.com/some/extension.git',
        },
      };
      const allExt: GeminiCLIExtension = {
        name: 'all-ext',
        version: '1.0.0',
        isActive: true,
        path: '/test/dir/all-ext',
        installMetadata: {
          type: 'git',
          autoUpdate: false,
          source: 'https://github.com/some/extension.git',
        },
      };

      it.each([
        {
          description: 'should return matching extension names',
          extensions: [extensionOne, extensionTwo],
          partialArg: 'ext',
          expected: ['ext-one'],
        },
        {
          description: 'should return --all when partialArg matches',
          extensions: [],
          partialArg: '--al',
          expected: ['--all'],
        },
        {
          description:
            'should return both extension names and --all when both match',
          extensions: [allExt],
          partialArg: 'all',
          expected: ['--all', 'all-ext'],
        },
        {
          description: 'should return an empty array if no matches',
          extensions: [extensionOne],
          partialArg: 'nomatch',
          expected: [],
        },
      ])('$description', async ({ extensions, partialArg, expected }) => {
        mockGetExtensions.mockReturnValue(extensions);
        const suggestions = await updateCompletion(mockContext, partialArg);
        expect(suggestions).toEqual(expected);
      });
    });
  });

  describe('install', () => {
    const installAction = extensionsCommand.subCommands?.find(
      (cmd) => cmd.name === 'install',
    )?.action;

    if (!installAction) {
      throw new Error('Install action not found');
    }

    it('should show usage if no source is provided', async () => {
      await installAction(mockContext, '');
      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        {
          type: MessageType.ERROR,
          text: 'Usage: /extensions install <source>',
        },
        expect.any(Number),
      );
    });

    it('should install a regular extension source', async () => {
      const metadata: ExtensionInstallMetadata = {
        type: 'git',
        source: 'https://github.com/example/ext',
      };
      mockParseInstallSource.mockResolvedValue(metadata);
      mockInstallExtension.mockResolvedValue('example-ext');

      await installAction(mockContext, 'example/ext');

      expect(mockParseInstallSource).toHaveBeenCalledWith('example/ext');
      expect(mockInstallExtension).toHaveBeenCalledWith(
        metadata,
        expect.any(Function),
        '/test/dir',
      );
      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        {
          type: MessageType.INFO,
          text: 'Extension "example-ext" installed successfully and enabled.',
        },
        expect.any(Number),
      );
      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        {
          type: MessageType.EXTENSIONS_LIST,
        },
        expect.any(Number),
      );
    });

    it('should auto-select the only marketplace plugin', async () => {
      const metadata: ExtensionInstallMetadata = {
        type: 'marketplace',
        source: 'https://github.com/example/market',
        marketplaceConfig: {
          name: 'example',
          owner: {},
          plugins: [{ name: 'only-plugin', source: 'owner/repo' }],
        },
      };
      mockParseInstallSource.mockResolvedValue(metadata);
      mockInstallExtension.mockResolvedValue('only-plugin');

      await installAction(mockContext, 'example/market');

      expect(metadata.pluginName).toBe('only-plugin');
      expect(mockInstallExtension).toHaveBeenCalledWith(
        metadata,
        expect.any(Function),
        '/test/dir',
      );
    });

    it('should fail when marketplace source has multiple plugins', async () => {
      const metadata: ExtensionInstallMetadata = {
        type: 'marketplace',
        source: 'https://github.com/example/market',
        marketplaceConfig: {
          name: 'example',
          owner: {},
          plugins: [
            { name: 'plugin-one', source: 'owner/repo-one' },
            { name: 'plugin-two', source: 'owner/repo-two' },
          ],
        },
      };
      mockParseInstallSource.mockResolvedValue(metadata);

      await installAction(mockContext, 'example/market');

      expect(mockInstallExtension).not.toHaveBeenCalled();
      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        {
          type: MessageType.ERROR,
          text: expect.stringContaining('Please specify one with'),
        },
        expect.any(Number),
      );
    });
  });

  describe('uninstall', () => {
    const uninstallAction = extensionsCommand.subCommands?.find(
      (cmd) => cmd.name === 'uninstall',
    )?.action;

    if (!uninstallAction) {
      throw new Error('Uninstall action not found');
    }

    it('should show usage if no name is provided', async () => {
      await uninstallAction(mockContext, '');
      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        {
          type: MessageType.ERROR,
          text: 'Usage: /extensions uninstall <name>',
        },
        expect.any(Number),
      );
    });

    it('should uninstall an extension', async () => {
      await uninstallAction(mockContext, 'ext-one');
      expect(mockUninstallExtension).toHaveBeenCalledWith('ext-one', '/test/dir');
      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        {
          type: MessageType.INFO,
          text: 'Extension "ext-one" uninstalled successfully.',
        },
        expect.any(Number),
      );
    });
  });

  describe('enable and disable', () => {
    const enableAction = extensionsCommand.subCommands?.find(
      (cmd) => cmd.name === 'enable',
    )?.action;
    const disableAction = extensionsCommand.subCommands?.find(
      (cmd) => cmd.name === 'disable',
    )?.action;

    if (!enableAction || !disableAction) {
      throw new Error('Enable/disable actions not found');
    }

    it('should enable extension with workspace scope', async () => {
      await enableAction(mockContext, 'ext-one --scope workspace');
      expect(mockEnableExtension).toHaveBeenCalledWith(
        'ext-one',
        'Workspace',
        '/test/dir',
      );
    });

    it('should disable extension with default user scope', async () => {
      await disableAction(mockContext, 'ext-one');
      expect(mockDisableExtension).toHaveBeenCalledWith(
        'ext-one',
        'User',
        '/test/dir',
      );
    });
  });

  describe('detail', () => {
    const detailAction = extensionsCommand.subCommands?.find(
      (cmd) => cmd.name === 'detail',
    )?.action;

    if (!detailAction) {
      throw new Error('Detail action not found');
    }

    it('should show details for an extension', async () => {
      const extension = {
        path: '/tmp/ext-one',
        config: { name: 'ext-one', version: '1.0.0' },
        contextFiles: [],
      };
      mockLoadExtensionByName.mockReturnValue(extension);
      mockToOutputString.mockReturnValue('detail-output');

      await detailAction(mockContext, 'ext-one');

      expect(mockLoadExtensionByName).toHaveBeenCalledWith('ext-one', '/test/dir');
      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        {
          type: MessageType.INFO,
          text: 'detail-output',
        },
        expect.any(Number),
      );
    });
  });

  describe('explore', () => {
    const exploreAction = extensionsCommand.subCommands?.find(
      (cmd) => cmd.name === 'explore',
    )?.action;

    if (!exploreAction) {
      throw new Error('Explore action not found');
    }

    it('uses default source when none is provided', async () => {
      mockExploreMarketplacePlugins.mockResolvedValue({
        source: 'wshobson/agents',
        marketplaceName: 'agents',
        plugins: ['reverse-engineering'],
      });

      await exploreAction(mockContext, '');

      expect(mockExploreMarketplacePlugins).toHaveBeenCalledWith(
        'wshobson/agents',
        '',
      );
      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        {
          type: MessageType.INFO,
          text: expect.stringContaining('reverse-engineering'),
        },
        expect.any(Number),
      );
    });
  });
});
