/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { t } from '../../i18n/index.js';
import { MessageType } from '../types.js';
import { CommandKind, type CommandContext, type SlashCommand } from './types.js';

const listAction = async (context: CommandContext) => {
  const config = context.services.config;
  if (!config) {
    context.ui.addItem(
      { type: MessageType.ERROR, text: t('Config not loaded.') },
      Date.now(),
    );
    return;
  }

  const pluginSystem = config.getPluginSystem();
  if (!pluginSystem) {
    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: t('Plugins are disabled. Set enablePlugins=true in settings.'),
      },
      Date.now(),
    );
    return;
  }

  const plugins = pluginSystem.getLoadedPlugins();
  if (plugins.length === 0) {
    context.ui.addItem(
      { type: MessageType.INFO, text: t('No plugins loaded.') },
      Date.now(),
    );
    return;
  }

  const lines = plugins.map((p) => `- ${p.name} (${p.specifier})`).join('\n');
  context.ui.addItem(
    { type: MessageType.INFO, text: `${t('Loaded plugins:')}\n${lines}` },
    Date.now(),
  );
};

export const pluginsCommand: SlashCommand = {
  name: 'plugins',
  get description() {
    return t('List loaded plugins');
  },
  kind: CommandKind.BUILT_IN,
  action: listAction,
};
