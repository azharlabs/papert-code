/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MessageActionReturn, SlashCommand } from './types.js';
import { CommandKind } from './types.js';
import { t } from '../../i18n/index.js';
import { exportConversationToFile } from './chatCommand.js';

export const exportCommand: SlashCommand = {
  name: 'export',
  get description() {
    return t(
      'Export conversation artifacts for replay/evals. Usage: /export [file.(jsonl|html|md|json)]',
    );
  },
  kind: CommandKind.BUILT_IN,
  action: async (context, args): Promise<MessageActionReturn> =>
    exportConversationToFile(context, args),
};
