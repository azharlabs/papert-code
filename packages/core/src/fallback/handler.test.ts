/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type Mock,
  type MockInstance,
  afterEach,
} from 'vitest';
import { handleFallback } from './handler.js';
import type { Config } from '../config/config.js';
import { AuthType } from '../core/contentGenerator.js';
import {
  DEFAULT_GEMINI_FLASH_MODEL,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_MODEL_AUTO,
} from '../config/models.js';
import { logFlashFallback } from '../telemetry/index.js';
import type { FallbackModelHandler } from './types.js';

// Mock the telemetry logger and event class
vi.mock('../telemetry/index.js', () => ({
  logFlashFallback: vi.fn(),
  FlashFallbackEvent: class { },
}));

const MOCK_PRO_MODEL = DEFAULT_GEMINI_MODEL;
const FALLBACK_MODEL = DEFAULT_GEMINI_FLASH_MODEL;
const AUTH_OAUTH = AuthType.LOGIN_WITH_GOOGLE;
const AUTH_API_KEY = AuthType.USE_GEMINI;

const createMockConfig = (overrides: Partial<Config> = {}): Config =>
  ({
    isInFallbackMode: vi.fn(() => false),
    setFallbackMode: vi.fn(),
    setActiveModel: vi.fn(),
    fallbackModelHandler: undefined,
    getFallbackModelHandler: vi.fn(() => overrides.fallbackModelHandler),
    getModel: vi.fn(() => DEFAULT_GEMINI_MODEL_AUTO),
    getEnableHooks: vi.fn().mockReturnValue(false),
    getMessageBus: vi.fn().mockReturnValue(undefined),
    getAvailabilityPolicyChain: vi.fn().mockReturnValue([
      { model: MOCK_PRO_MODEL, actions: { quota: 'ask' } },
      {
        model: FALLBACK_MODEL,
        actions: { quota: 'retry' },
        isLastResort: true,
      },
    ]),
    getModelAvailabilityService: vi.fn().mockReturnValue({
      isFeaturePolicyAllow: vi.fn().mockReturnValue(true),
      selectFirstAvailable: vi.fn().mockImplementation((models: string[]) => {
        if (models.includes(FALLBACK_MODEL)) {
          return { selectedModel: FALLBACK_MODEL };
        }
        if (models.includes(MOCK_PRO_MODEL)) {
          return { selectedModel: MOCK_PRO_MODEL };
        }
        return { selectedModel: null };
      }),
    }),
    ...overrides,
  }) as unknown as Config;

describe('handleFallback', () => {
  let mockConfig: Config;
  let mockHandler: Mock<FallbackModelHandler>;
  let consoleErrorSpy: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    mockHandler = vi.fn();
    // Default setup: OAuth user, Pro model failed, handler injected
    mockConfig = createMockConfig({
      fallbackModelHandler: mockHandler,
    });
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('should return null immediately if authType is not OAuth', async () => {
    const result = await handleFallback(
      mockConfig,
      MOCK_PRO_MODEL,
      AUTH_API_KEY,
    );
    expect(result).toBeNull();
    expect(mockHandler).not.toHaveBeenCalled();
    expect(mockConfig.setFallbackMode).not.toHaveBeenCalled();
  });

  it('should return null if the failed model is already the fallback model', async () => {
    const result = await handleFallback(
      mockConfig,
      FALLBACK_MODEL, // Failed model is Flash
      AUTH_OAUTH,
    );
    expect(result).toBeNull();
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('should return null if no fallbackHandler is injected in config', async () => {
    const configWithoutHandler = createMockConfig({
      fallbackModelHandler: undefined,
    });
    const result = await handleFallback(
      configWithoutHandler,
      MOCK_PRO_MODEL,
      AUTH_OAUTH,
    );
    expect(result).toBeNull();
  });

  describe('when handler returns "auth"', () => {
    it('should NOT activate fallback mode and return false', async () => {
      mockHandler.mockResolvedValue('auth');

      const result = await handleFallback(
        mockConfig,
        MOCK_PRO_MODEL,
        AUTH_OAUTH,
      );

      expect(result).toBe(false);
      expect(mockConfig.setFallbackMode).not.toHaveBeenCalled();
      expect(logFlashFallback).not.toHaveBeenCalled();
    });
  });

  describe('when handler returns an unexpected value', () => {
    it('should log an error and return null', async () => {
      mockHandler.mockResolvedValue(null);

      const result = await handleFallback(
        mockConfig,
        MOCK_PRO_MODEL,
        AUTH_OAUTH,
      );

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Fallback handler failed:',
        new Error(
          'Unexpected fallback intent received from fallbackModelHandler: "null"',
        ),
      );
      expect(mockConfig.setFallbackMode).not.toHaveBeenCalled();
    });
  });

  it('should pass the correct context (failedModel, fallbackModel, error) to the handler', async () => {
    const mockError = new Error('Quota Exceeded');
    mockHandler.mockResolvedValue('retry');

    await handleFallback(mockConfig, MOCK_PRO_MODEL, AUTH_OAUTH, mockError);

    expect(mockHandler).toHaveBeenCalledWith(
      MOCK_PRO_MODEL,
      FALLBACK_MODEL,
      mockError,
    );
  });

  it('should not call setFallbackMode or log telemetry if already in fallback mode', async () => {
    // Setup config where fallback mode is already active
    const activeFallbackConfig = createMockConfig({
      fallbackModelHandler: mockHandler,
      isInFallbackMode: vi.fn(() => true), // Already active
      setFallbackMode: vi.fn(),
    });

    mockHandler.mockResolvedValue('retry');

    const result = await handleFallback(
      activeFallbackConfig,
      MOCK_PRO_MODEL,
      AUTH_OAUTH,
    );

    // No additional fallback action is taken while already in fallback mode.
    expect(result).toBeNull();
    // But should not mutate state or log telemetry again
    expect(activeFallbackConfig.setFallbackMode).not.toHaveBeenCalled();
    expect(logFlashFallback).not.toHaveBeenCalled();
  });

  it('should catch errors from the handler, log an error, and return null', async () => {
    const handlerError = new Error('UI interaction failed');
    mockHandler.mockRejectedValue(handlerError);

    const result = await handleFallback(mockConfig, MOCK_PRO_MODEL, AUTH_OAUTH);

    expect(result).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Fallback handler failed:',
      handlerError,
    );
    expect(mockConfig.setFallbackMode).not.toHaveBeenCalled();
  });
});
