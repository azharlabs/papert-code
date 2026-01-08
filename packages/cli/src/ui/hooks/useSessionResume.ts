/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef } from 'react';
import type { Config, ResumedSessionData } from '@papert-code/papert-code-core';
import {
  buildApiHistoryFromConversation,
  replayUiTelemetryFromConversation,
} from '@papert-code/papert-code-core';
import type { UseHistoryManagerReturn } from './useHistoryManager.js';
import { buildResumedHistoryItems } from '../utils/resumeHistoryUtils.js';
import { useSessionStats } from '../contexts/SessionContext.js';

interface UseSessionResumeParams {
  config: Config;
  historyManager: UseHistoryManagerReturn;
  refreshStatic: () => void;
  isGeminiClientInitialized: boolean;
  setQuittingMessages: (messages: null) => void;
  resumedSessionData?: ResumedSessionData;
  isAuthenticating: boolean;
}

/**
 * Hook to handle session resumption logic.
 * Provides a callback to load history for resume and automatically
 * handles command-line resume on mount.
 */
export function useSessionResume({
  config,
  historyManager,
  refreshStatic,
  isGeminiClientInitialized,
  setQuittingMessages,
  resumedSessionData,
  isAuthenticating,
}: UseSessionResumeParams) {
  const { startNewSession } = useSessionStats();

  // Use refs to avoid dependency chain that causes infinite loop
  const historyManagerRef = useRef(historyManager);
  const refreshStaticRef = useRef(refreshStatic);

  useEffect(() => {
    historyManagerRef.current = historyManager;
    refreshStaticRef.current = refreshStatic;
  });

  const loadHistoryForResume = useCallback(
    (resumedData: ResumedSessionData) => {
      if (!isGeminiClientInitialized) {
        return;
      }

      setQuittingMessages(null);
      historyManagerRef.current.clearItems();
      const historyItems = buildResumedHistoryItems(resumedData, config);
      historyManagerRef.current.loadHistory(historyItems);
      refreshStaticRef.current();

      replayUiTelemetryFromConversation(resumedData.conversation);
      if (startNewSession) {
        startNewSession(resumedData.conversation.sessionId);
      }

      const clientHistory = buildApiHistoryFromConversation(
        resumedData.conversation,
      );
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      config.getGeminiClient()?.resumeChat(clientHistory, resumedData);
    },
    [
      config,
      isGeminiClientInitialized,
      setQuittingMessages,
      startNewSession,
    ],
  );

  const hasLoadedResumedSession = useRef(false);
  useEffect(() => {
    if (
      resumedSessionData &&
      !isAuthenticating &&
      isGeminiClientInitialized &&
      !hasLoadedResumedSession.current
    ) {
      hasLoadedResumedSession.current = true;
      loadHistoryForResume(resumedSessionData);
    }
  }, [
    resumedSessionData,
    isAuthenticating,
    isGeminiClientInitialized,
    loadHistoryForResume,
  ]);

  return { loadHistoryForResume };
}
