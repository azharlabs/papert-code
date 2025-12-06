/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MessageRecord } from './chatRecordingService.js';
import type { BaseLlmClient } from '../core/baseLlmClient.js';
import { partListUnionToString } from '../core/geminiRequest.js';
import type { Content, PartListUnion } from '@google/genai';
import { getResponseText } from '../utils/partUtils.js';

const debugLogger = {
  debug: (...args: unknown[]) => console.debug(...args),
  warn: (...args: unknown[]) => console.warn(...args),
};

const DEFAULT_MAX_MESSAGES = 20;
const DEFAULT_TIMEOUT_MS = 5000;
const MAX_MESSAGE_LENGTH = 500;

const SUMMARY_PROMPT = `Summarize the user's primary intent or goal in this conversation in ONE sentence (max 80 characters).
Focus on what the user was trying to accomplish.

Examples:
- "Add dark mode to the app"
- "Fix authentication bug in login flow"
- "Understand how the API routing works"
- "Refactor database connection logic"
- "Debug memory leak in production"

Conversation:
{conversation}

Summary (max 80 chars):`;

export interface GenerateSummaryOptions {
  messages: MessageRecord[];
  maxMessages?: number;
  timeout?: number;
}

export class SessionSummaryService {
  constructor(private readonly baseLlmClient: BaseLlmClient) {}

  async generateSummary(
    options: GenerateSummaryOptions,
  ): Promise<string | null> {
    const {
      messages,
      maxMessages = DEFAULT_MAX_MESSAGES,
      timeout = DEFAULT_TIMEOUT_MS,
    } = options;

    try {
      const filteredMessages = messages
        .map((msg) => {
          if (msg.type !== 'user' && msg.type !== 'assistant') {
            return null;
          }
          const raw = (msg as unknown as { message?: unknown }).message ?? msg;
          const parts =
            typeof raw === 'object' && raw && 'parts' in (raw as object)
              ? (raw as { parts: unknown }).parts
              : raw;
          const content = partListUnionToString(
            parts as unknown as PartListUnion,
          );
          return { msg, content };
        })
        .filter(
          (item): item is { msg: MessageRecord; content: string } =>
            !!item && item.content.trim().length > 0,
        );

      let relevantMessages: Array<{ msg: MessageRecord; content: string }>;
      if (filteredMessages.length <= maxMessages) {
        relevantMessages = filteredMessages;
      } else {
        const firstWindowSize = Math.ceil(maxMessages / 2);
        const lastWindowSize = Math.floor(maxMessages / 2);
        const firstMessages = filteredMessages.slice(0, firstWindowSize);
        const lastMessages = filteredMessages.slice(-lastWindowSize);
        relevantMessages = firstMessages.concat(lastMessages);
      }

      if (relevantMessages.length === 0) {
        debugLogger.debug('[SessionSummary] No messages to summarize');
        return null;
      }

      const conversationText = relevantMessages
        .map((msg) => {
          const role = msg.msg.type === 'user' ? 'User' : 'Assistant';
          const content = msg.content;
          const truncated =
            content.length > MAX_MESSAGE_LENGTH
              ? content.slice(0, MAX_MESSAGE_LENGTH) + '...'
              : content;
          return `${role}: ${truncated}`;
        })
        .join('\n\n');

      const prompt = SUMMARY_PROMPT.replace('{conversation}', conversationText);

      const abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, timeout);

      try {
        const contents: Content[] = [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ];

        const response = await this.baseLlmClient.generateContent({
          modelConfigKey: { model: 'summarizer-default' },
          contents,
          abortSignal: abortController.signal,
          promptId: 'session-summary-generation',
        });

        const summary = getResponseText(response);
        if (!summary || summary.trim().length === 0) {
          debugLogger.debug('[SessionSummary] Empty summary returned');
          return null;
        }

        let cleanedSummary = summary
          .replace(/\n+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        cleanedSummary = cleanedSummary.replace(/^["']|["']$/g, '');

        debugLogger.debug(`[SessionSummary] Generated: "${cleanedSummary}"`);
        return cleanedSummary;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        debugLogger.debug('[SessionSummary] Timeout generating summary');
      } else {
        debugLogger.debug(
          `[SessionSummary] Error generating summary: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      return null;
    }
  }
}
