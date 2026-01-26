/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shareCommand, unshareCommand } from './shareCommand.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import type { CommandContext } from './types.js';
import { INITIAL_HISTORY_LENGTH } from '@papert-code/papert-code-core';
import { copyToClipboard } from '../utils/commandUtils.js';
import {
  createShareLink,
  deleteShareLink,
} from '../../services/shareService.js';
import {
  loadShareLinkRecord,
  saveShareLinkRecord,
  removeShareLinkRecord,
} from '../../services/shareLinkStore.js';

vi.mock('../utils/commandUtils.js', () => ({
  copyToClipboard: vi.fn(),
}));

vi.mock('../../services/shareService.js', () => ({
  createShareLink: vi.fn(),
  deleteShareLink: vi.fn(),
}));

vi.mock('../../services/shareLinkStore.js', () => ({
  loadShareLinkRecord: vi.fn(),
  saveShareLinkRecord: vi.fn(),
  removeShareLinkRecord: vi.fn(),
}));

describe('shareCommand', () => {
  let mockContext: CommandContext;
  let mockGetChat: Mock;
  let mockGetHistory: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    mockGetChat = vi.fn();
    mockGetHistory = vi.fn();

    mockContext = createMockCommandContext({
      services: {
        settings: {
          merged: {
            share: {
              mode: 'manual',
              baseUrl: 'https://share.example.test',
            },
          },
        } as unknown as CommandContext['services']['settings'],
        config: {
          getSessionId: () => 'session-123',
          getWorkingDir: () => '/repo',
          getActiveModel: () => 'papert-model',
          getGeminiClient: () => ({
            getChat: mockGetChat,
          }),
        },
      },
    });

    mockGetChat.mockReturnValue({
      getHistory: mockGetHistory,
    });
  });

  it('returns error when sharing is disabled', async () => {
    if (!shareCommand.action) throw new Error('Command has no action');

    mockContext.services.settings.merged.share = { mode: 'disabled' };

    const result = await shareCommand.action(mockContext, '');

    expect(result).toEqual({
      type: 'message',
      messageType: 'error',
      content: 'Sharing is disabled by settings.',
    });
  });

  it('returns info when session already shared', async () => {
    if (!shareCommand.action) throw new Error('Command has no action');

    vi.mocked(loadShareLinkRecord).mockResolvedValue({
      sessionId: 'session-123',
      shareId: 'share-1',
      shareUrl: 'https://share.example.test/s/share-1',
      secret: 'secret',
      createdAt: new Date().toISOString(),
    });

    const result = await shareCommand.action(mockContext, '');

    expect(result).toEqual({
      type: 'message',
      messageType: 'info',
      content: 'Session already shared: https://share.example.test/s/share-1',
    });
  });

  it('creates share link and copies to clipboard', async () => {
    if (!shareCommand.action) throw new Error('Command has no action');

    const history = Array.from({ length: INITIAL_HISTORY_LENGTH + 1 }).map(
      (_, index) => ({
        role: 'user',
        parts: [{ text: `prompt-${index}` }],
      }),
    );

    mockGetHistory.mockReturnValue(history);
    vi.mocked(loadShareLinkRecord).mockResolvedValue(null);
    vi.mocked(createShareLink).mockResolvedValue({
      id: 'share-123',
      url: 'https://share.example.test/s/share-123',
      secret: 'secret-123',
    });
    vi.mocked(copyToClipboard).mockResolvedValue(undefined);

    const result = await shareCommand.action(mockContext, '');

    expect(createShareLink).toHaveBeenCalled();
    expect(saveShareLinkRecord).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        sessionId: 'session-123',
        shareId: 'share-123',
        shareUrl: 'https://share.example.test/s/share-123',
      }),
    );
    expect(copyToClipboard).toHaveBeenCalledWith(
      'https://share.example.test/s/share-123',
    );
    expect(result).toEqual({
      type: 'message',
      messageType: 'info',
      content:
        'Session shared: https://share.example.test/s/share-123\nShare link copied to clipboard.',
    });
  });
});

describe('unshareCommand', () => {
  let mockContext: CommandContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = createMockCommandContext({
      services: {
        settings: {
          merged: {
            share: {
              mode: 'manual',
              baseUrl: 'https://share.example.test',
            },
          },
        } as unknown as CommandContext['services']['settings'],
        config: {
          getSessionId: () => 'session-123',
        },
      },
    });
  });

  it('returns info when no share link exists', async () => {
    if (!unshareCommand.action) throw new Error('Command has no action');

    vi.mocked(loadShareLinkRecord).mockResolvedValue(null);

    const result = await unshareCommand.action(mockContext, '');

    expect(result).toEqual({
      type: 'message',
      messageType: 'info',
      content: 'No share link found for this session.',
    });
  });

  it('removes share link when present', async () => {
    if (!unshareCommand.action) throw new Error('Command has no action');

    vi.mocked(loadShareLinkRecord).mockResolvedValue({
      sessionId: 'session-123',
      shareId: 'share-123',
      shareUrl: 'https://share.example.test/s/share-123',
      secret: 'secret-123',
      createdAt: new Date().toISOString(),
      baseUrl: 'https://share.example.test',
    });

    const result = await unshareCommand.action(mockContext, '');

    expect(deleteShareLink).toHaveBeenCalledWith(
      { baseUrl: 'https://share.example.test', token: undefined },
      'share-123',
      'secret-123',
    );
    expect(removeShareLinkRecord).toHaveBeenCalledWith(
      expect.anything(),
      'session-123',
    );
    expect(result).toEqual({
      type: 'message',
      messageType: 'info',
      content: 'Session unshared.',
    });
  });
});
