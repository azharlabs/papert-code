/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  resolvePolicyChain,
  buildFallbackPolicyContext,
  applyModelSelection,
  applyAvailabilityTransition,
} from './policyHelpers.js';
import { createDefaultPolicy } from './policyCatalog.js';
import type { Config } from '../config/config.js';
import { DEFAULT_GEMINI_MODEL_AUTO } from '../config/models.js';
import type { ResolvedModelConfig } from '../services/modelConfigService.js';

const createResolvedModelConfig = (
  model: string,
  generateContentConfig: ResolvedModelConfig['generateContentConfig'] = {},
): ResolvedModelConfig =>
  ({
    model,
    generateContentConfig,
  }) as ResolvedModelConfig;

const createMockConfig = (overrides: Partial<Config> = {}): Config =>
  ({
    getPreviewFeatures: () => false,
    getUserTier: () => undefined,
    getModel: () => 'gemini-2.5-pro',
    getResolvedModelConfig: vi.fn((modelReq: { model: string }) => ({
      model: modelReq.model,
      generateContentConfig: {},
    })) as unknown as Config['getResolvedModelConfig'],
    getEnableHooks: vi.fn().mockReturnValue(false),
    getMessageBus: vi.fn().mockReturnValue(undefined),
    ...overrides,
  }) as unknown as Config;

describe('policyHelpers', () => {
  describe('resolvePolicyChain', () => {
    const countLastResort = (
      chain: ReturnType<typeof resolvePolicyChain>,
    ): number => chain.filter((policy) => policy.isLastResort).length;

    it('returns a single-model chain for a custom model', () => {
      const config = createMockConfig({
        getModel: () => 'custom-model',
      });
      const chain = resolvePolicyChain(config);
      expect(chain).toHaveLength(1);
      expect(chain[0]?.model).toBe('custom-model');
      expect(countLastResort(chain)).toBe(1);
    });

    it('leaves catalog order untouched when active model already present', () => {
      const config = createMockConfig({
        getModel: () => 'gemini-2.5-pro',
      });
      const chain = resolvePolicyChain(config);
      expect(chain[0]?.model).toBe('gemini-2.5-pro');
    });

    it('returns the default chain when active model is "auto"', () => {
      const config = createMockConfig({
        getModel: () => DEFAULT_GEMINI_MODEL_AUTO,
      });
      const chain = resolvePolicyChain(config);

      // Expect default chain [Pro, Flash]
      expect(chain).toHaveLength(2);
      expect(chain[0]?.model).toBe('gemini-2.5-pro');
      expect(chain[1]?.model).toBe('gemini-2.5-flash');
      expect(countLastResort(chain)).toBe(1);
    });

    it('starts chain from preferredModel when model is "auto"', () => {
      const config = createMockConfig({
        getModel: () => DEFAULT_GEMINI_MODEL_AUTO,
      });
      const chain = resolvePolicyChain(config, 'gemini-2.5-flash');
      expect(chain).toHaveLength(1);
      expect(chain[0]?.model).toBe('gemini-2.5-flash');
      expect(countLastResort(chain)).toBe(1);
    });

    it('wraps around the chain when wrapsAround is true', () => {
      const config = createMockConfig({
        getModel: () => DEFAULT_GEMINI_MODEL_AUTO,
      });
      const chain = resolvePolicyChain(config, 'gemini-2.5-flash', true);
      expect(chain).toHaveLength(2);
      expect(chain[0]?.model).toBe('gemini-2.5-flash');
      expect(chain[1]?.model).toBe('gemini-2.5-pro');
      expect(countLastResort(chain)).toBe(1);
    });
  });

  describe('buildFallbackPolicyContext', () => {
    it('returns remaining candidates after the failed model', () => {
      const chain = [
        createDefaultPolicy('a'),
        createDefaultPolicy('b'),
        createDefaultPolicy('c'),
      ];
      const context = buildFallbackPolicyContext(chain, 'b');
      expect(context.failedPolicy?.model).toBe('b');
      expect(context.candidates.map((p) => p.model)).toEqual(['c']);
    });

    it('wraps around when building fallback context if wrapsAround is true', () => {
      const chain = [
        createDefaultPolicy('a'),
        createDefaultPolicy('b'),
        createDefaultPolicy('c'),
      ];
      const context = buildFallbackPolicyContext(chain, 'b', true);
      expect(context.failedPolicy?.model).toBe('b');
      expect(context.candidates.map((p) => p.model)).toEqual(['c', 'a']);
    });

    it('returns full chain when model is not in policy list', () => {
      const chain = [createDefaultPolicy('a'), createDefaultPolicy('b')];
      const context = buildFallbackPolicyContext(chain, 'x');
      expect(context.failedPolicy).toBeUndefined();
      expect(context.candidates).toEqual(chain);
    });
  });

  describe('applyModelSelection', () => {
    const mockAvailabilityService = {
      selectFirstAvailable: vi.fn(),
      consumeStickyAttempt: vi.fn(),
    };

    const createExtendedMockConfig = (
      overrides: Partial<Config> = {},
    ): Config => {
      const defaults = {
        getModelAvailabilityService: () => mockAvailabilityService,
        setActiveModel: vi.fn(),
      };
      return createMockConfig({ ...defaults, ...overrides } as Partial<Config>);
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('returns requested model if it is available', () => {
      const config = createExtendedMockConfig({
        getResolvedModelConfig: vi
          .fn()
          .mockReturnValue(createResolvedModelConfig('gemini-pro')),
      });
      const getResolvedModelConfig = vi.mocked(config.getResolvedModelConfig);
      getResolvedModelConfig.mockReturnValue(
        createResolvedModelConfig('gemini-pro'),
      );
      mockAvailabilityService.selectFirstAvailable.mockReturnValue({
        selectedModel: 'gemini-pro',
      });

      const result = applyModelSelection(config, { model: 'gemini-pro' });
      expect(result.model).toBe('gemini-pro');
      expect(result.maxAttempts).toBeUndefined();
      expect(config.setActiveModel).toHaveBeenCalledWith('gemini-pro');
    });

    it('switches to backup model and updates config if requested is unavailable', () => {
      const config = createExtendedMockConfig({
        getResolvedModelConfig: vi.fn(),
      });
      const getResolvedModelConfig = vi.mocked(config.getResolvedModelConfig);
      getResolvedModelConfig
        .mockReturnValueOnce(
          createResolvedModelConfig('gemini-pro', {
            temperature: 0.9,
            topP: 1,
          }),
        )
        .mockReturnValueOnce(
          createResolvedModelConfig('gemini-flash', {
            temperature: 0.1,
            topP: 1,
          }),
        );
      mockAvailabilityService.selectFirstAvailable.mockReturnValue({
        selectedModel: 'gemini-flash',
      });

      const result = applyModelSelection(config, { model: 'gemini-pro' });

      expect(result.model).toBe('gemini-flash');
      expect(result.config).toEqual({
        temperature: 0.1,
        topP: 1,
      });

      expect(getResolvedModelConfig).toHaveBeenCalledWith({
        model: 'gemini-pro',
      });
      expect(getResolvedModelConfig).toHaveBeenCalledWith({
        model: 'gemini-flash',
      });
      expect(config.setActiveModel).toHaveBeenCalledWith('gemini-flash');
    });

    it('consumes sticky attempt if indicated', () => {
      const config = createExtendedMockConfig({
        getResolvedModelConfig: vi
          .fn()
          .mockReturnValue(createResolvedModelConfig('gemini-pro')),
      });
      const getResolvedModelConfig = vi.mocked(config.getResolvedModelConfig);
      getResolvedModelConfig.mockReturnValue(
        createResolvedModelConfig('gemini-pro'),
      );
      mockAvailabilityService.selectFirstAvailable.mockReturnValue({
        selectedModel: 'gemini-pro',
        attempts: 1,
      });

      const result = applyModelSelection(config, { model: 'gemini-pro' });
      expect(mockAvailabilityService.consumeStickyAttempt).toHaveBeenCalledWith(
        'gemini-pro',
      );
      expect(result.maxAttempts).toBe(1);
    });
  });

  describe('applyAvailabilityTransition', () => {
    it('marks model transient when policy transition is transient', () => {
      const markTransient = vi.fn();
      const context = {
        service: {
          markTransient,
          markTerminal: vi.fn(),
          markRetryOncePerTurn: vi.fn(),
        },
        policy: {
          model: 'test-model',
          actions: {},
          stateTransitions: {
            unknown: 'transient' as const,
          },
        },
      };

      applyAvailabilityTransition(() => context as any, 'unknown');

      expect(markTransient).toHaveBeenCalledWith('test-model');
    });
  });
});
