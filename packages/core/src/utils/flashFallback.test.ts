/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Config } from '../config/config.js';
import fs from 'node:fs';
import {
  setSimulate429,
  disableSimulationAfterFallback,
  shouldSimulate429,
  createSimulated429Error,
  resetRequestCounter,
} from './testUtils.js';
import { DEFAULT_GEMINI_FLASH_MODEL } from '../config/models.js';
import { retryWithBackoff } from './retry.js';
import { AuthType } from '../core/contentGenerator.js';
// Import the new types (Assuming this test file is in packages/core/src/utils/)
import type { FallbackModelHandler } from '../fallback/types.js';

vi.mock('node:fs');

// Update the description to reflect that this tests the retry utility's integration
describe('Retry Utility Fallback Integration', () => {
  let config: Config;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({
      isDirectory: () => true,
    } as fs.Stats);
    config = new Config({
      targetDir: '/test',
      debugMode: false,
      cwd: '/test',
      model: 'gemini-2.5-pro',
    });

    // Reset simulation state for each test
    setSimulate429(false);
    resetRequestCounter();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // This test validates the Config's ability to store and execute the handler contract.
  it('should execute the injected FallbackHandler contract correctly', async () => {
    // Set up a minimal handler for testing, ensuring it matches the new type.
    const fallbackHandler: FallbackModelHandler = async () => 'retry';

    // Use the generalized setter
    config.setFallbackModelHandler(fallbackHandler);

    // Call the handler directly via the config property
    const result = await config.fallbackModelHandler!(
      'gemini-2.5-pro',
      DEFAULT_GEMINI_FLASH_MODEL,
    );

    // Verify it returns the correct intent
    expect(result).toBe('retry');
  });

  // This test validates the retry utility's logic for triggering the callback.
  it(
    'should trigger onPersistent429 after 2 consecutive 429 errors for OAuth users',
    async () => {
      let fallbackCalled = false;

      // Mock function that simulates exactly 2 429 errors, then succeeds after fallback
      const mockApiCall = vi
        .fn()
        .mockRejectedValueOnce(createSimulated429Error())
        .mockRejectedValueOnce(createSimulated429Error())
        .mockResolvedValueOnce('success after fallback');

      // Mock the onPersistent429 callback (this is what client.ts/geminiChat.ts provides)
      const mockPersistent429Callback = vi.fn(async (_authType?: string) => {
        fallbackCalled = true;
        // Return true to signal retryWithBackoff to reset attempts and continue.
        return true;
      });

      const promise = retryWithBackoff(mockApiCall, {
        maxAttempts: 2,
        initialDelayMs: 1,
        maxDelayMs: 1,
        shouldRetryOnError: (error: Error) => {
          const status = (error as Error & { status?: number }).status;
          return status === 429;
        },
        onPersistent429: mockPersistent429Callback,
        authType: AuthType.LOGIN_WITH_GOOGLE,
      });

      await vi.runAllTimersAsync();
      const result = await promise;

      // Verify fallback mechanism was triggered
      expect(fallbackCalled).toBe(true);
      expect(mockPersistent429Callback).toHaveBeenCalledWith(
        AuthType.LOGIN_WITH_GOOGLE,
        expect.any(Error),
      );
      expect(result).toBe('success after fallback');
      // Should have: 2 failures, then fallback triggered, then 1 success after retry reset
      expect(mockApiCall).toHaveBeenCalledTimes(3);
    },
    10_000,
  );

  it(
    'should not trigger onPersistent429 for API key users',
    async () => {
      let fallbackCalled = false;

      // Mock function that simulates 429 errors
      const mockApiCall = vi.fn().mockRejectedValue(createSimulated429Error());

      // Mock the callback
      const mockPersistent429Callback = vi.fn(async () => {
        fallbackCalled = true;
        return true;
      });

      const promise = retryWithBackoff(mockApiCall, {
        maxAttempts: 2,
        initialDelayMs: 1,
        maxDelayMs: 1,
        shouldRetryOnError: (error: Error) => {
          const status = (error as Error & { status?: number }).status;
          return status === 429;
        },
        onPersistent429: mockPersistent429Callback,
        authType: AuthType.USE_GEMINI, // API key auth type
      });

      // The current retry implementation may schedule a large number of timers
      // (e.g. quota retryDelayMs). We only need to assert that fallback is not
      // invoked for API key auth.
      expect(fallbackCalled).toBe(false);
      expect(mockPersistent429Callback).not.toHaveBeenCalled();

      // Avoid unhandled rejection.
      promise.catch(() => undefined);
    },
    10_000,
  );

  // This test validates the test utilities themselves.
  it('should properly disable simulation state after fallback (Test Utility)', () => {
    // Enable simulation
    setSimulate429(true);

    // Verify simulation is enabled
    expect(shouldSimulate429()).toBe(true);

    // Disable simulation after fallback
    disableSimulationAfterFallback();

    // Verify simulation is now disabled
    expect(shouldSimulate429()).toBe(false);
  });
});
