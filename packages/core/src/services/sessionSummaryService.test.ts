/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionSummaryService } from './sessionSummaryService.js';
import type { BaseLlmClient } from '../core/baseLlmClient.js';
import type { MessageRecord } from './chatRecordingService.js';

const mockGenerateContent = vi.fn();

const mockBaseLlmClient = {
  generateContent: mockGenerateContent,
} as unknown as BaseLlmClient;

describe('SessionSummaryService', () => {
  let service: SessionSummaryService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new SessionSummaryService(mockBaseLlmClient);
  });

  it('returns null when no messages', async () => {
    const result = await service.generateSummary({ messages: [] });
    expect(result).toBeNull();
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('summarizes recent messages', async () => {
    mockGenerateContent.mockResolvedValue({
      candidates: [
        {
          content: { parts: [{ text: '"Build a dashboard"' }] },
        },
      ],
    });

    const messages: MessageRecord[] = [
      {
        uuid: '1',
        parentUuid: null,
        sessionId: 's',
        timestamp: new Date().toISOString(),
        type: 'user',
        cwd: '/app',
        version: '1',
        message: { role: 'user', parts: [{ text: 'Build a dashboard' }] },
      },
      {
        uuid: '2',
        parentUuid: '1',
        sessionId: 's',
        timestamp: new Date().toISOString(),
        type: 'assistant',
        cwd: '/app',
        version: '1',
        message: { role: 'model', parts: [{ text: 'Sure' }] },
      },
    ];

    const result = await service.generateSummary({ messages });
    expect(result).toBe('Build a dashboard');
    expect(mockGenerateContent).toHaveBeenCalled();
  });

  it('times out gracefully', async () => {
    mockGenerateContent.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({}), 20)),
    );

    const messages: MessageRecord[] = [
      {
        uuid: '1',
        parentUuid: null,
        sessionId: 's',
        timestamp: new Date().toISOString(),
        type: 'user',
        cwd: '/app',
        version: '1',
        message: { role: 'user', parts: [{ text: 'Hi' }] },
      },
    ];

    const result = await service.generateSummary({
      messages,
      timeout: 5,
    });
    expect(result).toBeNull();
  });
});
