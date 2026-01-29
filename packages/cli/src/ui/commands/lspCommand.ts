/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type CommandContext,
  type SlashCommand,
  CommandKind,
} from './types.js';
import { MessageType, type HistoryItemLspStatus } from '../types.js';
import { t } from '../../i18n/index.js';

const statusCommand: SlashCommand = {
  name: 'status',
  get description() {
    return t('Show LSP server status.');
  },
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext): Promise<void> => {
    const { config } = context.services;
    if (!config) {
      context.ui.addItem(
        { type: MessageType.ERROR, text: t('Config not loaded.') },
        Date.now(),
      );
      return;
    }

    const lspManager = config.getLspManager();
    const servers = await lspManager.getStatus();

    const statusItem: HistoryItemLspStatus = {
      type: MessageType.LSP_STATUS,
      enabled: config.getLspSettings().enabled ?? false,
      autoDetect: lspManager.isAutoDetectEnabled(),
      autoInstall: lspManager.isAutoInstallEnabled(),
      servers,
    };

    context.ui.addItem(statusItem, Date.now());
  },
};

export const lspCommand: SlashCommand = {
  name: 'lsp',
  get description() {
    return t('LSP status and auto-detection. Usage: /lsp status');
  },
  kind: CommandKind.BUILT_IN,
  subCommands: [statusCommand],
  action: async (context: CommandContext, args?: string): Promise<void> => {
    await statusCommand.action?.(context, args ?? '');
  },
};
