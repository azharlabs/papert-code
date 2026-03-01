/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fsPromises from 'node:fs/promises';
import path from 'node:path';
import React from 'react';
import { Text } from 'ink';
import type {
  CommandContext,
  SlashCommand,
  SlashCommandActionReturn,
  MessageActionReturn,
  OpenDialogActionReturn,
} from './types.js';
import { CommandKind } from './types.js';
import {
  decodeTagName,
  INITIAL_HISTORY_LENGTH,
  type Checkpoint,
} from '@papert-code/papert-code-core';
import type {
  HistoryItemWithoutId,
  ChatDetail,
} from '../types.js';
import { MessageType } from '../types.js';
import type { Content } from '@google/genai';
import { t } from '../../i18n/index.js';

type ConversationExportFormat = 'json' | 'jsonl' | 'md' | 'html';

const getSavedChatTags = async (
  context: CommandContext,
  mtSortDesc: boolean,
): Promise<ChatDetail[]> => {
  const cfg = context.services.config;
  const papertDir = cfg?.storage?.getProjectTempDir();
  if (!papertDir) {
    return [];
  }
  try {
    const fileHead = 'checkpoint-';
    const fileTail = '.json';
    const files = await fsPromises.readdir(papertDir);
    const chatDetails: ChatDetail[] = [];

    for (const file of files) {
      if (file.startsWith(fileHead) && file.endsWith(fileTail)) {
        const filePath = path.join(papertDir, file);
        const stats = await fsPromises.stat(filePath);
        const tagName = file.slice(fileHead.length, -fileTail.length);
        chatDetails.push({
          name: decodeTagName(tagName),
          mtime: stats.mtime.toISOString(),
        });
      }
    }

    chatDetails.sort((a, b) =>
      mtSortDesc
        ? b.mtime.localeCompare(a.mtime)
        : a.mtime.localeCompare(b.mtime),
    );

    return chatDetails;
  } catch (_err) {
    return [];
  }
};

const listCommand: SlashCommand = {
  name: 'list',
  get description() {
    return t('Open the session browser');
  },
  kind: CommandKind.BUILT_IN,
  action: async (): Promise<OpenDialogActionReturn> => ({
    type: 'dialog',
    dialog: 'sessionBrowser',
  }),
};

const saveCommand: SlashCommand = {
  name: 'save',
  get description() {
    return t('Save the current conversation as a checkpoint. Usage: /chat save <tag>');
  },
  kind: CommandKind.BUILT_IN,
  action: async (context, args): Promise<SlashCommandActionReturn | void> => {
    const tag = args.trim();
    if (!tag) {
      return {
        type: 'message',
        messageType: 'error',
        content: t('Missing tag. Usage: /chat save <tag>'),
      };
    }

    const { logger, config } = context.services;
    if (!logger) {
      return {
        type: 'message',
        messageType: 'error',
        content: t('Logger not available.'),
      };
    }
    await logger.initialize();

    if (!context.overwriteConfirmed) {
      const exists = await logger.checkpointExists(tag);
      if (exists) {
        return {
          type: 'confirm_action',
          prompt: React.createElement(
            Text,
            null,
            t('A checkpoint with the tag {{tag}} already exists. Do you want to overwrite it?', { tag }),
          ),
          originalInvocation: {
            raw: context.invocation?.raw || `/chat save ${tag}`,
          },
        };
      }
    }

    const chat = config?.getGeminiClient()?.getChat();
    if (!chat) {
      return {
        type: 'message',
        messageType: 'error',
        content: t('No chat client available to save conversation.'),
      };
    }

    const history = chat.getHistory();
    if (history.length > INITIAL_HISTORY_LENGTH) {
      const authType = config?.getContentGeneratorConfig()?.authType;
      const checkpoint: Checkpoint = { history, authType };
      await logger.saveCheckpoint(checkpoint, tag);
      return {
        type: 'message',
        messageType: 'info',
        content: t('Conversation checkpoint saved with tag: {{tag}}.', {
          tag: decodeTagName(tag),
        }),
      };
    }
    return {
      type: 'message',
      messageType: 'info',
      content: t('No conversation found to save.'),
    };
  },
};

const resumeCommand: SlashCommand = {
  name: 'resume',
  altNames: ['load'],
  get description() {
    return t('Resume a conversation from a checkpoint. Usage: /chat resume [tag]');
  },
  kind: CommandKind.BUILT_IN,
  action: async (
    context,
    args,
  ): Promise<SlashCommandActionReturn | void | OpenDialogActionReturn> => {
    const tag = args.trim();
    if (!tag) {
      return {
        type: 'dialog',
        dialog: 'sessionBrowser',
      };
    }

    const { logger, config } = context.services;
    if (!logger) {
      return {
        type: 'message',
        messageType: 'error',
        content: t('Logger not available.'),
      };
    }
    await logger.initialize();
    const checkpoint = await logger.loadCheckpoint(tag);
    const conversation = checkpoint.history;

    if (conversation.length === 0) {
      return {
        type: 'message',
        messageType: 'info',
        content: t('No saved checkpoint found with tag: {{tag}}.', {
          tag: decodeTagName(tag),
        }),
      };
    }

    const currentAuthType = config?.getContentGeneratorConfig()?.authType;
    if (
      checkpoint.authType &&
      currentAuthType &&
      checkpoint.authType !== currentAuthType
    ) {
      return {
        type: 'message',
        messageType: 'error',
        content: t(
          'Cannot resume chat. It was saved with a different authentication method ({{checkpointAuth}}) than the current one ({{currentAuth}}).',
          {
            checkpointAuth: checkpoint.authType,
            currentAuth: currentAuthType,
          },
        ),
      };
    }

    const rolemap: { [key: string]: MessageType } = {
      user: MessageType.USER,
      model: MessageType.GEMINI,
    };

    const uiHistory: HistoryItemWithoutId[] = [];

    for (const item of conversation.slice(INITIAL_HISTORY_LENGTH)) {
      const text =
        item.parts
          ?.filter((m) => !!m.text)
          .map((m) => m.text)
          .join('') || '';
      if (!text) {
        continue;
      }

      uiHistory.push({
        type: (item.role && rolemap[item.role]) || MessageType.GEMINI,
        text,
      } as HistoryItemWithoutId);
    }
    return {
      type: 'load_history',
      history: uiHistory,
      clientHistory: conversation,
    };
  },
  completion: async (context, partialArg) => {
    const chatDetails = await getSavedChatTags(context, true);
    return chatDetails
      .map((chat) => chat.name)
      .filter((name) => name.startsWith(partialArg));
  },
};

const deleteCommand: SlashCommand = {
  name: 'delete',
  get description() {
    return t('Delete a conversation checkpoint. Usage: /chat delete <tag>');
  },
  kind: CommandKind.BUILT_IN,
  action: async (context, args): Promise<MessageActionReturn> => {
    const tag = args.trim();
    if (!tag) {
      return {
        type: 'message',
        messageType: 'error',
        content: t('Missing tag. Usage: /chat delete <tag>'),
      };
    }

    const { logger } = context.services;
    if (!logger) {
      return {
        type: 'message',
        messageType: 'error',
        content: t('Logger not available.'),
      };
    }
    await logger.initialize();
    const deleted = await logger.deleteCheckpoint(tag);

    if (deleted) {
      return {
        type: 'message',
        messageType: 'info',
        content: t("Conversation checkpoint '{{tag}}' has been deleted.", {
          tag: decodeTagName(tag),
        }),
      };
    }
    return {
      type: 'message',
      messageType: 'error',
      content: t("Error: No checkpoint found with tag '{{tag}}'.", {
        tag: decodeTagName(tag),
      }),
    };
  },
  completion: async (context, partialArg) => {
    const chatDetails = await getSavedChatTags(context, true);
    return chatDetails
      .map((chat) => chat.name)
      .filter((name) => name.startsWith(partialArg));
  },
};

export function serializeHistoryToMarkdown(history: Content[]): string {
  return history
    .map((item) => {
      const text =
        item.parts
          ?.map((part) => {
            if (part.text) {
              return part.text;
            }
            if (part.functionCall) {
              return `**Tool Command**:\n\`\`\`json\n${JSON.stringify(
                part.functionCall,
                null,
                2,
              )}\n\`\`\``;
            }
            if (part.functionResponse) {
              return `**Tool Response**:\n\`\`\`json\n${JSON.stringify(
                part.functionResponse,
                null,
                2,
              )}\n\`\`\``;
            }
            return '';
          })
          .join('') || '';
      const roleIcon = item.role === 'user' ? '🧑‍💻' : '✨';
      return `## ${(item.role || 'model').toUpperCase()} ${roleIcon}\n\n${text}`;
    })
    .join('\n\n---\n\n');
}

function normalizeTextForExport(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

function getTextParts(item: Content): string[] {
  return (
    item.parts
      ?.filter((part) => !!part.text)
      .map((part) => normalizeTextForExport(part.text ?? '')) ?? []
  );
}

function getJoinedTextForExport(item: Content): string {
  return getTextParts(item).join('\n').trim();
}

function getExportFormatFromPath(
  filePath: string,
): ConversationExportFormat | null {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.json') {
    return 'json';
  }
  if (extension === '.jsonl') {
    return 'jsonl';
  }
  if (extension === '.md') {
    return 'md';
  }
  if (extension === '.html') {
    return 'html';
  }
  return null;
}

function serializeHistoryToJsonl(history: Content[]): string {
  return history
    .map((item, index) => {
      const text = getJoinedTextForExport(item);
      const toolCalls =
        item.parts
          ?.filter((part) => !!part.functionCall)
          .map((part) => part.functionCall) ?? [];
      const toolResponses =
        item.parts
          ?.filter((part) => !!part.functionResponse)
          .map((part) => part.functionResponse) ?? [];

      return JSON.stringify({
        type: 'chat_turn',
        turnIndex: index,
        role: item.role ?? 'model',
        text,
        textParts: getTextParts(item),
        toolCalls,
        toolResponses,
      });
    })
    .join('\n');
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function serializeHistoryToHtml(history: Content[]): string {
  const turns = history
    .map((item, index) => {
      const text = getJoinedTextForExport(item);
      const toolCalls =
        item.parts
          ?.filter((part) => !!part.functionCall)
          .map(
            (part) =>
              `<details><summary>tool call</summary><pre>${escapeHtml(
                JSON.stringify(part.functionCall, null, 2),
              )}</pre></details>`,
          )
          .join('\n') ?? '';
      const toolResponses =
        item.parts
          ?.filter((part) => !!part.functionResponse)
          .map(
            (part) =>
              `<details><summary>tool response</summary><pre>${escapeHtml(
                JSON.stringify(part.functionResponse, null, 2),
              )}</pre></details>`,
          )
          .join('\n') ?? '';
      return `<section class="turn">
<h2>Turn ${index + 1} - ${escapeHtml((item.role ?? 'model').toUpperCase())}</h2>
<pre>${escapeHtml(text)}</pre>
${toolCalls}
${toolResponses}
</section>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Papert Conversation Export</title>
  <style>
    :root { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; }
    body { margin: 2rem auto; max-width: 960px; padding: 0 1rem; color: #111827; background: #f9fafb; }
    h1 { margin-bottom: 1.5rem; }
    .turn { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; margin-bottom: 1rem; padding: 1rem; }
    pre { white-space: pre-wrap; word-break: break-word; background: #f3f4f6; border-radius: 8px; padding: 0.75rem; }
    details { margin-top: 0.5rem; }
  </style>
</head>
<body>
  <h1>Papert Conversation Export</h1>
  ${turns}
</body>
</html>`;
}

function serializeHistoryToPromptMarkdown(history: Content[]): string {
  const header = [
    '# Papert Conversation Export',
    '',
    'Structured prompt-replay artifact generated via `/export`.',
    '',
  ];
  const turns = history.map((item, index) => {
    const role = (item.role ?? 'model').toUpperCase();
    const text = getJoinedTextForExport(item);
    const toolCalls =
      item.parts
        ?.filter((part) => !!part.functionCall)
        .map(
          (part) =>
            `Tool Call:\n\`\`\`json\n${JSON.stringify(
              part.functionCall,
              null,
              2,
            )}\n\`\`\``,
        )
        .join('\n\n') ?? '';
    const toolResponses =
      item.parts
        ?.filter((part) => !!part.functionResponse)
        .map(
          (part) =>
            `Tool Response:\n\`\`\`json\n${JSON.stringify(
              part.functionResponse,
              null,
              2,
            )}\n\`\`\``,
        )
        .join('\n\n') ?? '';
    const toolSection = [toolCalls, toolResponses].filter(Boolean).join('\n\n');
    return [
      `## Turn ${index + 1} - ${role}`,
      '',
      text ? text : '_No plain text content_',
      ...(toolSection ? ['', toolSection] : []),
    ].join('\n');
  });
  return [...header, turns.join('\n\n---\n\n')].join('\n');
}

function serializeExport(history: Content[], format: ConversationExportFormat): string {
  if (format === 'json') {
    return JSON.stringify(history, null, 2);
  }
  if (format === 'jsonl') {
    return serializeHistoryToJsonl(history);
  }
  if (format === 'html') {
    return serializeHistoryToHtml(history);
  }
  return serializeHistoryToPromptMarkdown(history);
}

export async function exportConversationToFile(
  context: CommandContext,
  args: string,
): Promise<MessageActionReturn> {
  let filePathArg = args.trim();
  if (!filePathArg) {
    filePathArg = `papert-export-${Date.now()}.jsonl`;
  }

  const filePath = path.resolve(filePathArg);
  const format = getExportFormatFromPath(filePath);
  if (!format) {
    return {
      type: 'message',
      messageType: 'error',
      content: t(
        'Invalid export format. Use one of: .jsonl, .html, .md, .json',
      ),
    };
  }

  const chat = context.services.config?.getGeminiClient()?.getChat();
  if (!chat) {
    return {
      type: 'message',
      messageType: 'error',
      content: t('No chat client available to export conversation.'),
    };
  }

  const history = chat.getHistory();
  if (history.length <= INITIAL_HISTORY_LENGTH) {
    return {
      type: 'message',
      messageType: 'info',
      content: t('No conversation found to export.'),
    };
  }

  const content = serializeExport(history, format);
  try {
    await fsPromises.writeFile(filePath, content);
    return {
      type: 'message',
      messageType: 'info',
      content: t('Conversation exported to {{filePath}} ({{format}})', {
        filePath,
        format,
      }),
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      type: 'message',
      messageType: 'error',
      content: t('Error exporting conversation: {{error}}', {
        error: errorMessage,
      }),
    };
  }
}

const exportCommand: SlashCommand = {
  name: 'export',
  get description() {
    return t(
      'Export conversation artifacts for replay/evals. Usage: /chat export [file.(jsonl|html|md|json)]',
    );
  },
  kind: CommandKind.BUILT_IN,
  action: async (context, args): Promise<MessageActionReturn> =>
    exportConversationToFile(context, args),
};

const shareCommand: SlashCommand = {
  name: 'share',
  get description() {
    return t(
      'Share the current conversation to a markdown or json file. Usage: /chat share <file>',
    );
  },
  kind: CommandKind.BUILT_IN,
  action: async (context, args): Promise<MessageActionReturn> => {
    let filePathArg = args.trim();
    if (!filePathArg) {
      filePathArg = `papert-conversation-${Date.now()}.json`;
    }

    const filePath = path.resolve(filePathArg);
    const extension = path.extname(filePath);
    if (extension !== '.md' && extension !== '.json') {
      return {
        type: 'message',
        messageType: 'error',
        content: t('Invalid file format. Only .md and .json are supported.'),
      };
    }

    const chat = context.services.config?.getGeminiClient()?.getChat();
    if (!chat) {
      return {
        type: 'message',
        messageType: 'error',
        content: t('No chat client available to share conversation.'),
      };
    }

    const history = chat.getHistory();

    if (history.length <= INITIAL_HISTORY_LENGTH) {
      return {
        type: 'message',
        messageType: 'info',
        content: t('No conversation found to share.'),
      };
    }

    let content = '';
    if (extension === '.json') {
      content = JSON.stringify(history, null, 2);
    } else {
      content = serializeHistoryToMarkdown(history);
    }

    try {
      await fsPromises.writeFile(filePath, content);
      return {
        type: 'message',
        messageType: 'info',
        content: t('Conversation shared to {{filePath}}', { filePath }),
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        type: 'message',
        messageType: 'error',
        content: t('Error sharing conversation: {{error}}', {
          error: errorMessage,
        }),
      };
    }
  },
};

export const chatCommand: SlashCommand = {
  name: 'chat',
  get description() {
    return t('Manage conversation history.');
  },
  kind: CommandKind.BUILT_IN,
  subCommands: [
    listCommand,
    saveCommand,
    resumeCommand,
    deleteCommand,
    shareCommand,
    exportCommand,
  ],
};
