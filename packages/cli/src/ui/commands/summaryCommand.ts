/**
 * @license
 * Copyright 2025 Papert
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type SlashCommand,
  CommandKind,
  type SlashCommandActionReturn,
} from './types.js';
import { getProjectSummaryPrompt } from '@papert-code/papert-code-core';
import { t } from '../../i18n/index.js';

export const summaryCommand: SlashCommand = {
  name: 'summary',
  get description() {
    return t(
      'Generate a project summary and save it to .papert/PROJECT_SUMMARY.md',
    );
  },
  kind: CommandKind.BUILT_IN,
  action: async (context): Promise<SlashCommandActionReturn> => {
    if (!context.services.config) {
      return {
        type: 'message',
        messageType: 'error',
        content: t('Config not loaded.'),
      };
    }
    const summaryPrompt = [
      'SYSTEM CONTRACT: summary-command/v1',
      'Generate a complete markdown project summary from this session context.',
      getProjectSummaryPrompt(),
      'Write the final markdown to `.papert/PROJECT_SUMMARY.md`.',
      'Always overwrite the file if it already exists.',
      'After writing the file, respond with a short confirmation line containing exactly this relative path: `.papert/PROJECT_SUMMARY.md`.',
      'Do not ask follow-up questions before writing the file.',
    ].join('\n\n');

    return {
      type: 'submit_prompt',
      content: [{ text: summaryPrompt }],
    };
  },
};
