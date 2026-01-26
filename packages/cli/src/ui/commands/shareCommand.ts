/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandContext, MessageActionReturn, SlashCommand } from './types.js';
import { CommandKind } from './types.js';
import { INITIAL_HISTORY_LENGTH } from '@papert-code/papert-code-core';
import { copyToClipboard } from '../utils/commandUtils.js';
import { t } from '../../i18n/index.js';
import {
  createShareLink,
  deleteShareLink,
  type ShareServiceConfig,
} from '../../services/shareService.js';
import {
  loadShareLinkRecord,
  removeShareLinkRecord,
  saveShareLinkRecord,
} from '../../services/shareLinkStore.js';

function resolveShareConfig(context: CommandContext): {
  mode: 'manual' | 'disabled';
  baseUrl?: string;
  token?: string;
} {
  const settings = context.services.settings.merged.share;
  return {
    mode: settings?.mode ?? 'manual',
    baseUrl:
      settings?.baseUrl ??
      process.env['PAPERT_SHARE_URL'] ??
      process.env['PAPERT_REMOTE_URL'],
    token: settings?.token ?? process.env['PAPERT_SHARE_TOKEN'],
  };
}

function buildShareServiceConfig(baseUrl?: string, token?: string): ShareServiceConfig | null {
  if (!baseUrl) return null;
  return { baseUrl, token };
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const shareCommand: SlashCommand = {
  name: 'share',
  get description() {
    return t('Share the current session via a public link.');
  },
  kind: CommandKind.BUILT_IN,
  action: async (context): Promise<MessageActionReturn> => {
    const config = context.services.config;
    if (!config) {
      return {
        type: 'message',
        messageType: 'error',
        content: t('Config not loaded.'),
      };
    }

    const shareConfig = resolveShareConfig(context);
    if (shareConfig.mode === 'disabled') {
      return {
        type: 'message',
        messageType: 'error',
        content: t('Sharing is disabled by settings.'),
      };
    }

    const serviceConfig = buildShareServiceConfig(
      shareConfig.baseUrl,
      shareConfig.token,
    );
    if (!serviceConfig) {
      return {
        type: 'message',
        messageType: 'error',
        content: t('Share base URL is not configured. Set share.baseUrl or PAPERT_SHARE_URL.'),
      };
    }

    const sessionId = config.getSessionId();
    const existing = await loadShareLinkRecord(config, sessionId);
    if (existing?.shareUrl) {
      return {
        type: 'message',
        messageType: 'info',
        content: t('Session already shared: {{url}}', { url: existing.shareUrl }),
      };
    }

    const chat = config.getGeminiClient()?.getChat();
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

    const payload = {
      info: {
        sessionId,
        createdAt: new Date().toISOString(),
        cwd: config.getWorkingDir(),
        model: config.getActiveModel(),
      },
      history,
    };

    try {
      const share = await createShareLink(serviceConfig, {
        sessionId,
        payload,
      });

      await saveShareLinkRecord(config, {
        sessionId,
        shareId: share.id,
        shareUrl: share.url,
        secret: share.secret,
        createdAt: new Date().toISOString(),
        baseUrl: serviceConfig.baseUrl,
      });

      let clipboardNote = '';
      try {
        await copyToClipboard(share.url);
        clipboardNote = t('Share link copied to clipboard.');
      } catch (error) {
        clipboardNote = t('Failed to copy share link: {{error}}', {
          error: formatError(error),
        });
      }

      return {
        type: 'message',
        messageType: 'info',
        content: `${t('Session shared: {{url}}', { url: share.url })}${
          clipboardNote ? `\n${clipboardNote}` : ''
        }`,
      };
    } catch (error) {
      return {
        type: 'message',
        messageType: 'error',
        content: t('Failed to share session: {{error}}', {
          error: formatError(error),
        }),
      };
    }
  },
};

export const unshareCommand: SlashCommand = {
  name: 'unshare',
  get description() {
    return t('Remove the public share link for the current session.');
  },
  kind: CommandKind.BUILT_IN,
  action: async (context): Promise<MessageActionReturn> => {
    const config = context.services.config;
    if (!config) {
      return {
        type: 'message',
        messageType: 'error',
        content: t('Config not loaded.'),
      };
    }

    const sessionId = config.getSessionId();
    const record = await loadShareLinkRecord(config, sessionId);
    if (!record) {
      return {
        type: 'message',
        messageType: 'info',
        content: t('No share link found for this session.'),
      };
    }

    const shareConfig = resolveShareConfig(context);
    const serviceConfig = buildShareServiceConfig(
      record.baseUrl ?? shareConfig.baseUrl,
      shareConfig.token,
    );
    if (!serviceConfig) {
      return {
        type: 'message',
        messageType: 'error',
        content: t('Share base URL is not configured. Set share.baseUrl or PAPERT_SHARE_URL.'),
      };
    }

    try {
      await deleteShareLink(serviceConfig, record.shareId, record.secret);
      await removeShareLinkRecord(config, sessionId);
      return {
        type: 'message',
        messageType: 'info',
        content: t('Session unshared.'),
      };
    } catch (error) {
      return {
        type: 'message',
        messageType: 'error',
        content: t('Failed to unshare session: {{error}}', {
          error: formatError(error),
        }),
      };
    }
  },
};
