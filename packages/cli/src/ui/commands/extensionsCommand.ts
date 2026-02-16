/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  disableExtension,
  enableExtension,
  installExtension,
  loadExtensionByName,
  requestConsentInteractive,
  toOutputString,
  uninstallExtension,
} from '../../config/extension.js';
import {
  updateAllUpdatableExtensions,
  type ExtensionUpdateInfo,
  updateExtension,
  checkForAllExtensionUpdates,
} from '../../config/extensions/update.js';
import {
  parseInstallSource,
  type ClaudeMarketplaceConfig,
} from '../../config/extensions/marketplace.js';
import { getErrorMessage } from '../../utils/errors.js';
import { SettingScope } from '../../config/settings.js';
import { ExtensionUpdateState } from '../state/extensions.js';
import { MessageType } from '../types.js';
import {
  type CommandContext,
  type SlashCommand,
  CommandKind,
} from './types.js';
import { t } from '../../i18n/index.js';

async function listAction(context: CommandContext) {
  context.ui.addItem(
    {
      type: MessageType.EXTENSIONS_LIST,
    },
    Date.now(),
  );
}

async function updateAction(context: CommandContext, args: string) {
  const updateArgs = args.split(' ').filter((value) => value.length > 0);
  const all = updateArgs.length === 1 && updateArgs[0] === '--all';
  const names = all ? undefined : updateArgs;
  let updateInfos: ExtensionUpdateInfo[] = [];

  if (!all && names?.length === 0) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: 'Usage: /extensions update <extension-names>|--all',
      },
      Date.now(),
    );
    return;
  }

  try {
    await checkForAllExtensionUpdates(
      context.services.config!.getExtensions(),
      context.ui.dispatchExtensionStateUpdate,
    );
    context.ui.setPendingItem({
      type: MessageType.EXTENSIONS_LIST,
    });
    if (all) {
      updateInfos = await updateAllUpdatableExtensions(
        context.services.config!.getWorkingDir(),
        // We don't have the ability to prompt for consent yet in this flow.
        (description) =>
          requestConsentInteractive(
            description,
            context.ui.addConfirmUpdateExtensionRequest,
          ),
        context.services.config!.getExtensions(),
        context.ui.extensionsUpdateState,
        context.ui.dispatchExtensionStateUpdate,
      );
    } else if (names?.length) {
      const workingDir = context.services.config!.getWorkingDir();
      const extensions = context.services.config!.getExtensions();
      for (const name of names) {
        const extension = extensions.find(
          (extension) => extension.name === name,
        );
        if (!extension) {
          context.ui.addItem(
            {
              type: MessageType.ERROR,
              text: `Extension ${name} not found.`,
            },
            Date.now(),
          );
          continue;
        }
        const updateInfo = await updateExtension(
          extension,
          workingDir,
          (description) =>
            requestConsentInteractive(
              description,
              context.ui.addConfirmUpdateExtensionRequest,
            ),
          context.ui.extensionsUpdateState.get(extension.name)?.status ??
          ExtensionUpdateState.UNKNOWN,
          context.ui.dispatchExtensionStateUpdate,
        );
        if (updateInfo) updateInfos.push(updateInfo);
      }
    }

    if (updateInfos.length === 0) {
      context.ui.addItem(
        {
          type: MessageType.INFO,
          text: 'No extensions to update.',
        },
        Date.now(),
      );
      return;
    }
  } catch (error) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: getErrorMessage(error),
      },
      Date.now(),
    );
  } finally {
    context.ui.addItem(
      {
        type: MessageType.EXTENSIONS_LIST,
      },
      Date.now(),
    );
    context.ui.setPendingItem(null);
  }
}

async function installAction(context: CommandContext, args: string) {
  const source = args.trim();
  if (!source) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: 'Usage: /extensions install <source>',
      },
      Date.now(),
    );
    return;
  }

  try {
    const installMetadata = await parseInstallSource(source);
    if (installMetadata.type === 'marketplace' && !installMetadata.pluginName) {
      const marketplace = installMetadata.marketplaceConfig as
        | ClaudeMarketplaceConfig
        | undefined;
      if (!marketplace || marketplace.plugins.length === 0) {
        throw new Error('No plugins available in this marketplace.');
      }
      if (marketplace.plugins.length === 1) {
        installMetadata.pluginName = marketplace.plugins[0].name;
      } else {
        throw new Error(
          `Marketplace source contains multiple plugins. Please specify one with /extensions install <source>:<plugin-name>. Available plugins: ${marketplace.plugins.map((plugin) => plugin.name).join(', ')}`,
        );
      }
    }

    const name = await installExtension(
      installMetadata,
      (description) =>
        requestConsentInteractive(
          description,
          context.ui.addConfirmUpdateExtensionRequest,
        ),
      context.services.config!.getWorkingDir(),
    );
    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: `Extension "${name}" installed successfully and enabled.`,
      },
      Date.now(),
    );
    context.ui.addItem(
      {
        type: MessageType.EXTENSIONS_LIST,
      },
      Date.now(),
    );
  } catch (error) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: getErrorMessage(error),
      },
      Date.now(),
    );
  }
}

function parseScopeArg(rawArgs: string): SettingScope {
  const args = rawArgs.split(/\s+/).filter(Boolean);
  const scopeIndex = args.findIndex((arg) => arg === '--scope');
  if (scopeIndex !== -1 && args[scopeIndex + 1]) {
    return args[scopeIndex + 1].toLowerCase() === 'workspace'
      ? SettingScope.Workspace
      : SettingScope.User;
  }
  const scopeEqArg = args.find((arg) => arg.startsWith('--scope='));
  if (scopeEqArg) {
    const value = scopeEqArg.split('=')[1]?.toLowerCase();
    return value === 'workspace' ? SettingScope.Workspace : SettingScope.User;
  }
  return SettingScope.User;
}

function extractPrimaryArg(rawArgs: string): string {
  const args = rawArgs.split(/\s+/).filter(Boolean);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--scope') {
      i += 1;
      continue;
    }
    if (arg.startsWith('--scope=')) {
      continue;
    }
    if (!arg.startsWith('--')) {
      return arg;
    }
  }
  return '';
}

async function uninstallAction(context: CommandContext, args: string) {
  const name = args.trim();
  if (!name) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: 'Usage: /extensions uninstall <name>',
      },
      Date.now(),
    );
    return;
  }

  try {
    await uninstallExtension(name, context.services.config!.getWorkingDir());
    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: `Extension "${name}" uninstalled successfully.`,
      },
      Date.now(),
    );
    context.ui.addItem(
      {
        type: MessageType.EXTENSIONS_LIST,
      },
      Date.now(),
    );
  } catch (error) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: getErrorMessage(error),
      },
      Date.now(),
    );
  }
}

async function enableAction(context: CommandContext, args: string) {
  const name = extractPrimaryArg(args);
  if (!name) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: 'Usage: /extensions enable <name> [--scope user|workspace]',
      },
      Date.now(),
    );
    return;
  }

  try {
    const scope = parseScopeArg(args);
    enableExtension(name, scope, context.services.config!.getWorkingDir());
    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: `Extension "${name}" enabled for scope "${scope}".`,
      },
      Date.now(),
    );
    context.ui.addItem(
      {
        type: MessageType.EXTENSIONS_LIST,
      },
      Date.now(),
    );
  } catch (error) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: getErrorMessage(error),
      },
      Date.now(),
    );
  }
}

async function disableAction(context: CommandContext, args: string) {
  const name = extractPrimaryArg(args);
  if (!name) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: 'Usage: /extensions disable <name> [--scope user|workspace]',
      },
      Date.now(),
    );
    return;
  }

  try {
    const scope = parseScopeArg(args);
    disableExtension(name, scope, context.services.config!.getWorkingDir());
    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: `Extension "${name}" disabled for scope "${scope}".`,
      },
      Date.now(),
    );
    context.ui.addItem(
      {
        type: MessageType.EXTENSIONS_LIST,
      },
      Date.now(),
    );
  } catch (error) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: getErrorMessage(error),
      },
      Date.now(),
    );
  }
}

async function detailAction(context: CommandContext, args: string) {
  const name = args.trim();
  if (!name) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: 'Usage: /extensions detail <name>',
      },
      Date.now(),
    );
    return;
  }

  try {
    const extension = loadExtensionByName(
      name,
      context.services.config!.getWorkingDir(),
    );
    if (!extension) {
      throw new Error(`Extension "${name}" not found.`);
    }
    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: toOutputString(
          extension,
          context.services.config!.getWorkingDir(),
        ),
      },
      Date.now(),
    );
  } catch (error) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: getErrorMessage(error),
      },
      Date.now(),
    );
  }
}

async function exploreAction(context: CommandContext, args: string) {
  const tokens = args.trim().split(/\s+/).filter(Boolean);
  const defaultSource = 'wshobson/agents';
  const firstToken = tokens.at(0);
  const hasExplicitSource =
    !!firstToken &&
    (firstToken.includes('/') || firstToken.startsWith('http'));
  const source = hasExplicitSource ? firstToken! : defaultSource;
  const keyword = (hasExplicitSource ? tokens.slice(1) : tokens)
    .join(' ')
    .toLowerCase();

  try {
    const installMetadata = await parseInstallSource(source);
    if (installMetadata.type !== 'marketplace') {
      throw new Error(
        `Source "${source}" does not expose a marketplace config. Try another source.`,
      );
    }
    const marketplace = installMetadata.marketplaceConfig as
      | ClaudeMarketplaceConfig
      | undefined;
    if (!marketplace) {
      throw new Error('Marketplace config missing.');
    }

    const plugins = marketplace.plugins
      .map((plugin) => plugin.name)
      .filter((name) =>
        keyword.length > 0 ? name.toLowerCase().includes(keyword) : true,
      );

    if (plugins.length === 0) {
      context.ui.addItem(
        {
          type: MessageType.INFO,
          text: `No plugins found for keyword "${keyword}" in "${source}".`,
        },
        Date.now(),
      );
      return;
    }

    context.ui.addItem(
      {
        type: MessageType.INFO,
        text:
          `Marketplace "${marketplace.name}" plugins:\n` +
          plugins.map((name) => `  - ${name}`).join('\n') +
          `\n\nInstall with: /extensions install ${source}:<plugin-name>`,
      },
      Date.now(),
    );
  } catch (error) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: getErrorMessage(error),
      },
      Date.now(),
    );
  }
}

const listExtensionsCommand: SlashCommand = {
  name: 'list',
  get description() {
    return t('List active extensions');
  },
  kind: CommandKind.BUILT_IN,
  action: listAction,
};

const updateExtensionsCommand: SlashCommand = {
  name: 'update',
  get description() {
    return t('Update extensions. Usage: update <extension-names>|--all');
  },
  kind: CommandKind.BUILT_IN,
  action: updateAction,
  completion: async (context, partialArg) => {
    const extensions = context.services.config?.getExtensions() ?? [];
    const extensionNames = extensions.map((ext) => ext.name);
    const suggestions = extensionNames.filter((name) =>
      name.startsWith(partialArg),
    );

    if ('--all'.startsWith(partialArg) || 'all'.startsWith(partialArg)) {
      suggestions.unshift('--all');
    }

    return suggestions;
  },
};

const installExtensionsCommand: SlashCommand = {
  name: 'install',
  get description() {
    return t('Install an extension. Usage: install <source>');
  },
  kind: CommandKind.BUILT_IN,
  action: installAction,
};

const uninstallExtensionsCommand: SlashCommand = {
  name: 'uninstall',
  get description() {
    return t('Uninstall an extension. Usage: uninstall <name>');
  },
  kind: CommandKind.BUILT_IN,
  action: uninstallAction,
  completion: async (context, partialArg) => {
    const extensions = context.services.config?.getExtensions() ?? [];
    return extensions
      .map((extension) => extension.name)
      .filter((name) => name.startsWith(partialArg));
  },
};

const enableExtensionsCommand: SlashCommand = {
  name: 'enable',
  get description() {
    return t('Enable an extension. Usage: enable <name> [--scope user|workspace]');
  },
  kind: CommandKind.BUILT_IN,
  action: enableAction,
  completion: async (context, partialArg) => {
    const extensions = context.services.config?.getExtensions() ?? [];
    return extensions
      .map((extension) => extension.name)
      .filter((name) => name.startsWith(partialArg));
  },
};

const disableExtensionsCommand: SlashCommand = {
  name: 'disable',
  get description() {
    return t(
      'Disable an extension. Usage: disable <name> [--scope user|workspace]',
    );
  },
  kind: CommandKind.BUILT_IN,
  action: disableAction,
  completion: async (context, partialArg) => {
    const extensions = context.services.config?.getExtensions() ?? [];
    return extensions
      .map((extension) => extension.name)
      .filter((name) => name.startsWith(partialArg));
  },
};

const detailExtensionsCommand: SlashCommand = {
  name: 'detail',
  get description() {
    return t('Show extension details. Usage: detail <name>');
  },
  kind: CommandKind.BUILT_IN,
  action: detailAction,
  completion: async (context, partialArg) => {
    const extensions = context.services.config?.getExtensions() ?? [];
    return extensions
      .map((extension) => extension.name)
      .filter((name) => name.startsWith(partialArg));
  },
};

const exploreExtensionsCommand: SlashCommand = {
  name: 'explore',
  get description() {
    return t('Explore marketplace plugins. Usage: explore [source] [keyword]');
  },
  kind: CommandKind.BUILT_IN,
  action: exploreAction,
};

export const extensionsCommand: SlashCommand = {
  name: 'extensions',
  get description() {
    return t('Manage extensions');
  },
  kind: CommandKind.BUILT_IN,
  subCommands: [
    listExtensionsCommand,
    installExtensionsCommand,
    uninstallExtensionsCommand,
    enableExtensionsCommand,
    disableExtensionsCommand,
    detailExtensionsCommand,
    exploreExtensionsCommand,
    updateExtensionsCommand,
  ],
  action: (context, args) =>
    // Default to list if no subcommand is provided
    listExtensionsCommand.action!(context, args),
};
