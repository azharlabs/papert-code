/**
 * @license
 * Copyright 2025 Papert
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useEffect } from 'react';
import {
  AuthType,
  papertOAuth2Events,
  PapertOAuth2Event,
  type DeviceAuthorizationData,
} from '@papert-code/papert-code-core';

export interface PapertAuthState {
  deviceAuth: DeviceAuthorizationData | null;
  authStatus:
  | 'idle'
  | 'polling'
  | 'success'
  | 'error'
  | 'timeout'
  | 'rate_limit';
  authMessage: string | null;
}

export const usePapertAuth = (
  pendingAuthType: AuthType | undefined,
  isAuthenticating: boolean,
) => {
  const [papertAuthState, setPapertAuthState] = useState<PapertAuthState>({
    deviceAuth: null,
    authStatus: 'idle',
    authMessage: null,
  });

  const isPapertAuth = pendingAuthType === AuthType.PAPERT_OAUTH;

  // Set up event listeners when authentication starts
  useEffect(() => {
    if (!isPapertAuth || !isAuthenticating) {
      // Reset state when not authenticating or not Papert auth
      setPapertAuthState({
        deviceAuth: null,
        authStatus: 'idle',
        authMessage: null,
      });
      return;
    }

    setPapertAuthState((prev) => ({
      ...prev,
      authStatus: 'idle',
    }));

    // Set up event listeners
    const handleDeviceAuth = (deviceAuth: DeviceAuthorizationData) => {
      setPapertAuthState((prev) => ({
        ...prev,
        deviceAuth: {
          verification_uri: deviceAuth.verification_uri,
          verification_uri_complete: deviceAuth.verification_uri_complete,
          user_code: deviceAuth.user_code,
          expires_in: deviceAuth.expires_in,
          device_code: deviceAuth.device_code,
        },
        authStatus: 'polling',
      }));
    };

    const handleAuthProgress = (
      status: 'success' | 'error' | 'polling' | 'timeout' | 'rate_limit',
      message?: string,
    ) => {
      setPapertAuthState((prev) => ({
        ...prev,
        authStatus: status,
        authMessage: message || null,
      }));
    };

    // Add event listeners
    papertOAuth2Events.on(PapertOAuth2Event.AuthUri, handleDeviceAuth);
    papertOAuth2Events.on(PapertOAuth2Event.AuthProgress, handleAuthProgress);

    // Cleanup event listeners when component unmounts or auth finishes
    return () => {
      papertOAuth2Events.off(PapertOAuth2Event.AuthUri, handleDeviceAuth);
      papertOAuth2Events.off(PapertOAuth2Event.AuthProgress, handleAuthProgress);
    };
  }, [isPapertAuth, isAuthenticating]);

  const cancelPapertAuth = useCallback(() => {
    // Emit cancel event to stop polling
    papertOAuth2Events.emit(PapertOAuth2Event.AuthCancel);

    setPapertAuthState({
      deviceAuth: null,
      authStatus: 'idle',
      authMessage: null,
    });
  }, []);

  return {
    papertAuthState,
    cancelPapertAuth,
  };
};
