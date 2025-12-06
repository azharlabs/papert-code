/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Config } from '../config/config.js';
import { SessionSummaryService } from './sessionSummaryService.js';
import { BaseLlmClient } from '../core/baseLlmClient.js';

const debugLogger = {
  debug: (...args: unknown[]) => console.debug(...args),
  warn: (...args: unknown[]) => console.warn(...args),
};

/**
 * Generates and saves a summary for the current session.
 * Non-blocking best-effort; errors are logged.
 */
export async function generateAndSaveSummary(config: Config): Promise<void> {
  try {
    const chatRecordingService = config.getChatRecordingService();
    if (!chatRecordingService) {
      debugLogger.debug('[SessionSummary] No chat recording service available');
      return;
    }

    const conversation = chatRecordingService.getConversation();
    if (!conversation) {
      debugLogger.debug('[SessionSummary] No conversation to summarize');
      return;
    }

    if (conversation.summary) {
      debugLogger.debug('[SessionSummary] Summary already exists, skipping');
      return;
    }

    if (conversation.messages.length === 0) {
      debugLogger.debug('[SessionSummary] No messages to summarize');
      return;
    }

    const contentGenerator = config.getContentGenerator();
    const baseLlmClient = new BaseLlmClient(contentGenerator, config);
    const summaryService = new SessionSummaryService(baseLlmClient);

    const summary = await summaryService.generateSummary({
      messages: conversation.messages,
    });

    if (summary) {
      chatRecordingService.saveSummary(summary);
      debugLogger.debug(`[SessionSummary] Saved summary: "${summary}"`);
    } else {
      debugLogger.warn('[SessionSummary] Failed to generate summary');
    }
  } catch (error) {
    debugLogger.warn(
      `[SessionSummary] Error in generateAndSaveSummary: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
