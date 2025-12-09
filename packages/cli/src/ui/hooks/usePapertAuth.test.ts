/**
 * @license
 * Copyright 2025 Papert
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { DeviceAuthorizationData } from '@papert-code/papert-code-core';
import { usePapertAuth } from './usePapertAuth.js';
import {
  AuthType,
  papertOAuth2Events,
  PapertOAuth2Event,
} from '@papert-code/papert-code-core';

// Mock the papertOAuth2Events
vi.mock('@papert-code/papert-code-core', async () => {
  const actual = await vi.importActual('@papert-code/papert-code-core');
  const mockEmitter = {
    on: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    emit: vi.fn().mockReturnThis(),
  };
  return {
    ...actual,
    papertOAuth2Events: mockEmitter,
    PapertOAuth2Event: {
      AuthUri: 'authUri',
      AuthProgress: 'authProgress',
    },
  };
});

const mockPapertOAuth2Events = vi.mocked(papertOAuth2Events);

describe('usePapertAuth', () => {
  const mockDeviceAuth: DeviceAuthorizationData = {
    verification_uri: 'https://oauth.papert.com/device',
    verification_uri_complete: 'https://oauth.papert.com/device?user_code=ABC123',
    user_code: 'ABC123',
    expires_in: 1800,
    device_code: 'device_code_123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default state when not Papert auth', () => {
    const { result } = renderHook(() =>
      usePapertAuth(AuthType.USE_GEMINI, false),
    );

    expect(result.current.papertAuthState).toEqual({
      deviceAuth: null,
      authStatus: 'idle',
      authMessage: null,
    });
    expect(result.current.cancelPapertAuth).toBeInstanceOf(Function);
  });

  it('should initialize with default state when Papert auth but not authenticating', () => {
    const { result } = renderHook(() =>
      usePapertAuth(AuthType.PAPERT_OAUTH, false),
    );

    expect(result.current.papertAuthState).toEqual({
      deviceAuth: null,
      authStatus: 'idle',
      authMessage: null,
    });
    expect(result.current.cancelPapertAuth).toBeInstanceOf(Function);
  });

  it('should set up event listeners when Papert auth and authenticating', () => {
    renderHook(() => usePapertAuth(AuthType.PAPERT_OAUTH, true));

    expect(mockPapertOAuth2Events.on).toHaveBeenCalledWith(
      PapertOAuth2Event.AuthUri,
      expect.any(Function),
    );
    expect(mockPapertOAuth2Events.on).toHaveBeenCalledWith(
      PapertOAuth2Event.AuthProgress,
      expect.any(Function),
    );
  });

  it('should handle device auth event', () => {
    let handleDeviceAuth: (deviceAuth: DeviceAuthorizationData) => void;

    mockPapertOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === PapertOAuth2Event.AuthUri) {
        handleDeviceAuth = handler;
      }
      return mockPapertOAuth2Events;
    });

    const { result } = renderHook(() => usePapertAuth(AuthType.PAPERT_OAUTH, true));

    act(() => {
      handleDeviceAuth!(mockDeviceAuth);
    });

    expect(result.current.papertAuthState.deviceAuth).toEqual(mockDeviceAuth);
    expect(result.current.papertAuthState.authStatus).toBe('polling');
  });

  it('should handle auth progress event - success', () => {
    let handleAuthProgress: (
      status: 'success' | 'error' | 'polling' | 'timeout' | 'rate_limit',
      message?: string,
    ) => void;

    mockPapertOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === PapertOAuth2Event.AuthProgress) {
        handleAuthProgress = handler;
      }
      return mockPapertOAuth2Events;
    });

    const { result } = renderHook(() => usePapertAuth(AuthType.PAPERT_OAUTH, true));

    act(() => {
      handleAuthProgress!('success', 'Authentication successful!');
    });

    expect(result.current.papertAuthState.authStatus).toBe('success');
    expect(result.current.papertAuthState.authMessage).toBe(
      'Authentication successful!',
    );
  });

  it('should handle auth progress event - error', () => {
    let handleAuthProgress: (
      status: 'success' | 'error' | 'polling' | 'timeout' | 'rate_limit',
      message?: string,
    ) => void;

    mockPapertOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === PapertOAuth2Event.AuthProgress) {
        handleAuthProgress = handler;
      }
      return mockPapertOAuth2Events;
    });

    const { result } = renderHook(() => usePapertAuth(AuthType.PAPERT_OAUTH, true));

    act(() => {
      handleAuthProgress!('error', 'Authentication failed');
    });

    expect(result.current.papertAuthState.authStatus).toBe('error');
    expect(result.current.papertAuthState.authMessage).toBe(
      'Authentication failed',
    );
  });

  it('should handle auth progress event - polling', () => {
    let handleAuthProgress: (
      status: 'success' | 'error' | 'polling' | 'timeout' | 'rate_limit',
      message?: string,
    ) => void;

    mockPapertOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === PapertOAuth2Event.AuthProgress) {
        handleAuthProgress = handler;
      }
      return mockPapertOAuth2Events;
    });

    const { result } = renderHook(() => usePapertAuth(AuthType.PAPERT_OAUTH, true));

    act(() => {
      handleAuthProgress!('polling', 'Waiting for user authorization...');
    });

    expect(result.current.papertAuthState.authStatus).toBe('polling');
    expect(result.current.papertAuthState.authMessage).toBe(
      'Waiting for user authorization...',
    );
  });

  it('should handle auth progress event - rate_limit', () => {
    let handleAuthProgress: (
      status: 'success' | 'error' | 'polling' | 'timeout' | 'rate_limit',
      message?: string,
    ) => void;

    mockPapertOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === PapertOAuth2Event.AuthProgress) {
        handleAuthProgress = handler;
      }
      return mockPapertOAuth2Events;
    });

    const { result } = renderHook(() => usePapertAuth(AuthType.PAPERT_OAUTH, true));

    act(() => {
      handleAuthProgress!(
        'rate_limit',
        'Too many requests. The server is rate limiting our requests. Please select a different authentication method or try again later.',
      );
    });

    expect(result.current.papertAuthState.authStatus).toBe('rate_limit');
    expect(result.current.papertAuthState.authMessage).toBe(
      'Too many requests. The server is rate limiting our requests. Please select a different authentication method or try again later.',
    );
  });

  it('should handle auth progress event without message', () => {
    let handleAuthProgress: (
      status: 'success' | 'error' | 'polling' | 'timeout' | 'rate_limit',
      message?: string,
    ) => void;

    mockPapertOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === PapertOAuth2Event.AuthProgress) {
        handleAuthProgress = handler;
      }
      return mockPapertOAuth2Events;
    });

    const { result } = renderHook(() => usePapertAuth(AuthType.PAPERT_OAUTH, true));

    act(() => {
      handleAuthProgress!('success');
    });

    expect(result.current.papertAuthState.authStatus).toBe('success');
    expect(result.current.papertAuthState.authMessage).toBe(null);
  });

  it('should clean up event listeners when auth type changes', () => {
    const { rerender } = renderHook(
      ({ pendingAuthType, isAuthenticating }) =>
        usePapertAuth(pendingAuthType, isAuthenticating),
      {
        initialProps: {
          pendingAuthType: AuthType.PAPERT_OAUTH,
          isAuthenticating: true,
        },
      },
    );

    // Change to non-Papert auth
    rerender({ pendingAuthType: AuthType.USE_GEMINI, isAuthenticating: true });

    expect(mockPapertOAuth2Events.off).toHaveBeenCalledWith(
      PapertOAuth2Event.AuthUri,
      expect.any(Function),
    );
    expect(mockPapertOAuth2Events.off).toHaveBeenCalledWith(
      PapertOAuth2Event.AuthProgress,
      expect.any(Function),
    );
  });

  it('should clean up event listeners when authentication stops', () => {
    const { rerender } = renderHook(
      ({ isAuthenticating }) =>
        usePapertAuth(AuthType.PAPERT_OAUTH, isAuthenticating),
      { initialProps: { isAuthenticating: true } },
    );

    // Stop authentication
    rerender({ isAuthenticating: false });

    expect(mockPapertOAuth2Events.off).toHaveBeenCalledWith(
      PapertOAuth2Event.AuthUri,
      expect.any(Function),
    );
    expect(mockPapertOAuth2Events.off).toHaveBeenCalledWith(
      PapertOAuth2Event.AuthProgress,
      expect.any(Function),
    );
  });

  it('should clean up event listeners on unmount', () => {
    const { unmount } = renderHook(() =>
      usePapertAuth(AuthType.PAPERT_OAUTH, true),
    );

    unmount();

    expect(mockPapertOAuth2Events.off).toHaveBeenCalledWith(
      PapertOAuth2Event.AuthUri,
      expect.any(Function),
    );
    expect(mockPapertOAuth2Events.off).toHaveBeenCalledWith(
      PapertOAuth2Event.AuthProgress,
      expect.any(Function),
    );
  });

  it('should reset state when switching from Papert auth to another auth type', () => {
    let handleDeviceAuth: (deviceAuth: DeviceAuthorizationData) => void;

    mockPapertOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === PapertOAuth2Event.AuthUri) {
        handleDeviceAuth = handler;
      }
      return mockPapertOAuth2Events;
    });

    const { result, rerender } = renderHook(
      ({ pendingAuthType, isAuthenticating }) =>
        usePapertAuth(pendingAuthType, isAuthenticating),
      {
        initialProps: {
          pendingAuthType: AuthType.PAPERT_OAUTH,
          isAuthenticating: true,
        },
      },
    );

    // Simulate device auth
    act(() => {
      handleDeviceAuth!(mockDeviceAuth);
    });

    expect(result.current.papertAuthState.deviceAuth).toEqual(mockDeviceAuth);
    expect(result.current.papertAuthState.authStatus).toBe('polling');

    // Switch to different auth type
    rerender({ pendingAuthType: AuthType.USE_GEMINI, isAuthenticating: true });

    expect(result.current.papertAuthState.deviceAuth).toBe(null);
    expect(result.current.papertAuthState.authStatus).toBe('idle');
    expect(result.current.papertAuthState.authMessage).toBe(null);
  });

  it('should reset state when authentication stops', () => {
    let handleDeviceAuth: (deviceAuth: DeviceAuthorizationData) => void;

    mockPapertOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === PapertOAuth2Event.AuthUri) {
        handleDeviceAuth = handler;
      }
      return mockPapertOAuth2Events;
    });

    const { result, rerender } = renderHook(
      ({ isAuthenticating }) =>
        usePapertAuth(AuthType.PAPERT_OAUTH, isAuthenticating),
      { initialProps: { isAuthenticating: true } },
    );

    // Simulate device auth
    act(() => {
      handleDeviceAuth!(mockDeviceAuth);
    });

    expect(result.current.papertAuthState.deviceAuth).toEqual(mockDeviceAuth);
    expect(result.current.papertAuthState.authStatus).toBe('polling');

    // Stop authentication
    rerender({ isAuthenticating: false });

    expect(result.current.papertAuthState.deviceAuth).toBe(null);
    expect(result.current.papertAuthState.authStatus).toBe('idle');
    expect(result.current.papertAuthState.authMessage).toBe(null);
  });

  it('should handle cancelPapertAuth function', () => {
    let handleDeviceAuth: (deviceAuth: DeviceAuthorizationData) => void;

    mockPapertOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === PapertOAuth2Event.AuthUri) {
        handleDeviceAuth = handler;
      }
      return mockPapertOAuth2Events;
    });

    const { result } = renderHook(() => usePapertAuth(AuthType.PAPERT_OAUTH, true));

    // Set up some state
    act(() => {
      handleDeviceAuth!(mockDeviceAuth);
    });

    expect(result.current.papertAuthState.deviceAuth).toEqual(mockDeviceAuth);

    // Cancel auth
    act(() => {
      result.current.cancelPapertAuth();
    });

    expect(result.current.papertAuthState.deviceAuth).toBe(null);
    expect(result.current.papertAuthState.authStatus).toBe('idle');
    expect(result.current.papertAuthState.authMessage).toBe(null);
  });

  it('should handle different auth types correctly', () => {
    // Test with Papert OAuth - should set up event listeners when authenticating
    const { result: papertResult } = renderHook(() =>
      usePapertAuth(AuthType.PAPERT_OAUTH, true),
    );
    expect(papertResult.current.papertAuthState.authStatus).toBe('idle');
    expect(mockPapertOAuth2Events.on).toHaveBeenCalled();

    // Test with other auth types - should not set up event listeners
    const { result: geminiResult } = renderHook(() =>
      usePapertAuth(AuthType.USE_GEMINI, true),
    );
    expect(geminiResult.current.papertAuthState.authStatus).toBe('idle');

    const { result: oauthResult } = renderHook(() =>
      usePapertAuth(AuthType.LOGIN_WITH_GOOGLE, true),
    );
    expect(oauthResult.current.papertAuthState.authStatus).toBe('idle');
  });

  it('should initialize with idle status when starting authentication with Papert auth', () => {
    const { result } = renderHook(() => usePapertAuth(AuthType.PAPERT_OAUTH, true));

    expect(result.current.papertAuthState.authStatus).toBe('idle');
    expect(mockPapertOAuth2Events.on).toHaveBeenCalled();
  });
});
