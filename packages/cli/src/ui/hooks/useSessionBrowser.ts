/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from 'react';
import type { ResumedSessionData, Config } from '@papert-code/papert-code-core';
import { SessionService, getErrorMessage } from '@papert-code/papert-code-core';
import type { SessionInfo } from '../../utils/sessionUtils.js';

export const useSessionBrowser = (
  config: Config,
  onLoadHistory: (resumedSessionData: ResumedSessionData) => void,
) => {
  const [isSessionBrowserOpen, setIsSessionBrowserOpen] = useState(false);

  return {
    isSessionBrowserOpen,

    openSessionBrowser: useCallback(() => {
      setIsSessionBrowserOpen(true);
    }, []),

    closeSessionBrowser: useCallback(() => {
      setIsSessionBrowserOpen(false);
    }, []),

    /**
     * Loads a conversation by ID, and reinitializes the chat recording service with it.
     */
    handleResumeSession: useCallback(
      async (session: SessionInfo) => {
        try {
          const sessionService = new SessionService(config.getProjectRoot());
          const resumedSessionData = await sessionService.loadSession(session.id);

          if (!resumedSessionData) {
            throw new Error(`Session ${session.id} could not be loaded.`);
          }

          setIsSessionBrowserOpen(false);
          onLoadHistory(resumedSessionData);
        } catch (error) {
          console.error('Error resuming session:', getErrorMessage(error));
          setIsSessionBrowserOpen(false);
        }
      },
      [config, onLoadHistory],
    ),

    /**
     * Deletes a session by ID using the ChatRecordingService.
     */
    handleDeleteSession: useCallback(
      async (session: SessionInfo) => {
        try {
          const chatRecordingService = config.getChatRecordingService();
          chatRecordingService.deleteSession(session.id);
        } catch (error) {
          console.error('Error deleting session:', getErrorMessage(error));
          throw error;
        }
      },
      [config],
    ),
  };
};
