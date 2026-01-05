/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SlashCommand, CommandContext } from './types.js';
import { CommandKind } from './types.js';
import { MessageType, type HistoryItemHooksList } from '../types.js';
import type { HookRegistryEntry } from '@papert-code/papert-code-core';
import { getErrorMessage } from '@papert-code/papert-code-core';
import { SettingScope } from '../../config/settings.js';

async function panelAction(
  context: CommandContext,
): Promise<void | { type: 'message'; messageType: 'info' | 'error'; content: string }> {
  const { config } = context.services;
  if (!config) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Config not loaded.',
    };
  }

  const hookSystem = config.getHookSystem();
  if (!hookSystem) {
    return {
      type: 'message',
      messageType: 'info',
      content:
        'Hook system is not enabled. Enable it in settings with tools.enableHooks',
    };
  }

  const allHooks = hookSystem.getAllHooks();
  if (allHooks.length === 0) {
    return {
      type: 'message',
      messageType: 'info',
      content:
        'No hooks configured. Add hooks to your settings to get started.',
    };
  }

  const hooksListItem: HistoryItemHooksList = {
    type: MessageType.HOOKS_LIST,
    hooks: allHooks,
  };

  context.ui.addItem(hooksListItem, Date.now());
}

async function enableAction(
  context: CommandContext,
  args: string,
): Promise<void | { type: 'message'; messageType: 'info' | 'error'; content: string }> {
  const { config } = context.services;
  if (!config) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Config not loaded.',
    };
  }

  const hookSystem = config.getHookSystem();
  if (!hookSystem) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Hook system is not enabled.',
    };
  }

  const hookName = args.trim();
  if (!hookName) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Usage: /hooks enable <hook-name>',
    };
  }

  const settings = context.services.settings;
  const disabledHooks = settings.merged.hooks?.disabled || ([] as string[]);

  const newDisabledHooks = disabledHooks.filter(
    (name: string) => name !== hookName,
  );

  try {
    settings.setValue(SettingScope.User, 'hooks.disabled', newDisabledHooks);

    hookSystem.setHookEnabled(hookName, true);

    return {
      type: 'message',
      messageType: 'info',
      content: `Hook "${hookName}" enabled successfully.`,
    };
  } catch (error) {
    return {
      type: 'message',
      messageType: 'error',
      content: `Failed to enable hook: ${getErrorMessage(error)}`,
    };
  }
}

async function disableAction(
  context: CommandContext,
  args: string,
): Promise<void | { type: 'message'; messageType: 'info' | 'error'; content: string }> {
  const { config } = context.services;
  if (!config) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Config not loaded.',
    };
  }

  const hookSystem = config.getHookSystem();
  if (!hookSystem) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Hook system is not enabled.',
    };
  }

  const hookName = args.trim();
  if (!hookName) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Usage: /hooks disable <hook-name>',
    };
  }

  const settings = context.services.settings;
  const disabledHooks = settings.merged.hooks?.disabled || ([] as string[]);

  if (!disabledHooks.includes(hookName)) {
    const newDisabledHooks = [...disabledHooks, hookName];

    try {
      settings.setValue(SettingScope.User, 'hooks.disabled', newDisabledHooks);

      hookSystem.setHookEnabled(hookName, false);

      return {
        type: 'message',
        messageType: 'info',
        content: `Hook "${hookName}" disabled successfully.`,
      };
    } catch (error) {
      return {
        type: 'message',
        messageType: 'error',
        content: `Failed to disable hook: ${getErrorMessage(error)}`,
      };
    }
  }

  return {
    type: 'message',
    messageType: 'info',
    content: `Hook "${hookName}" is already disabled.`,
  };
}

async function completeHookNames(
  context: CommandContext,
  partialArg: string,
): Promise<string[]> {
  const { config } = context.services;
  if (!config) return [];

  const hookSystem = config.getHookSystem();
  if (!hookSystem) return [];

  const allHooks = hookSystem.getAllHooks();
  const hookNames = allHooks.map((hook) => getHookDisplayName(hook));
  return hookNames.filter((name) => name.startsWith(partialArg));
}

function getHookDisplayName(hook: HookRegistryEntry): string {
  return hook.config.name || hook.config.command || 'unknown-hook';
}

const panelCommand: SlashCommand = {
  name: 'panel',
  altNames: ['list', 'show'],
  description: 'Display all registered hooks with their status',
  kind: CommandKind.BUILT_IN,
  action: panelAction,
};

const enableCommand: SlashCommand = {
  name: 'enable',
  description: 'Enable a hook by name',
  kind: CommandKind.BUILT_IN,
  action: enableAction,
  completion: completeHookNames,
};

const disableCommand: SlashCommand = {
  name: 'disable',
  description: 'Disable a hook by name',
  kind: CommandKind.BUILT_IN,
  action: disableAction,
  completion: completeHookNames,
};

export const hooksCommand: SlashCommand = {
  name: 'hooks',
  description: 'Manage hooks',
  kind: CommandKind.BUILT_IN,
  subCommands: [panelCommand, enableCommand, disableCommand],
  action: async (context: CommandContext) => panelCommand.action!(context, ''),
};
