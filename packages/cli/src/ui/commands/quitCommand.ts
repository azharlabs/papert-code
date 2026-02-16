/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { formatDuration } from '../utils/formatters.js';
import { CommandKind, type SlashCommand } from './types.js';
import { t } from '../../i18n/index.js';

export const quitConfirmCommand: SlashCommand = {
  name: 'quit-confirm',
  get description() {
    return t('Show quit confirmation dialog');
  },
  kind: CommandKind.BUILT_IN,
  action: () => ({
    type: 'message',
    messageType: 'info',
    content: t('Type /quit to exit immediately, or /summary then /quit.'),
  }),
};

export const quitCommand: SlashCommand = {
  name: 'quit',
  altNames: ['exit'],
  get description() {
    return t('exit the cli');
  },
  kind: CommandKind.BUILT_IN,
  action: (context) => {
    const now = Date.now();
    const { sessionStartTime } = context.session.stats;
    const wallDuration = now - sessionStartTime.getTime();

    return {
      type: 'quit',
      messages: [
        {
          type: 'user',
          text: `/quit`, // Keep it consistent, even if /exit was used
          id: now - 1,
        },
        {
          type: 'quit',
          duration: formatDuration(wallDuration),
          id: now,
        },
      ],
    };
  },
};
