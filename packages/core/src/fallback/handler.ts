/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Config } from '../config/config.js';
import { AuthType } from '../core/contentGenerator.js';
import { openBrowserSecurely } from '../utils/secure-browser-launcher.js';
import { debugLogger } from '../utils/debugLogger.js';
import { getErrorMessage } from '../utils/errors.js';
import type { FallbackIntent, FallbackRecommendation } from './types.js';
import { classifyFailureKind } from '../availability/errorClassification.js';
import {
  buildFallbackPolicyContext,
  resolvePolicyChain,
  resolvePolicyAction,
  applyAvailabilityTransition,
} from '../availability/policyHelpers.js';
import { logFlashFallback, FlashFallbackEvent } from '../telemetry/index.js';

const UPGRADE_URL_PAGE = 'https://goo.gle/set-up-gemini-code-assist';

export async function handleFallback(
  config: Config,
  failedModel: string,
  authType?: string,
  error?: unknown,
): Promise<string | boolean | null> {
  // Handle Papert OAuth errors separately.
  if (authType === AuthType.PAPERT_OAUTH) {
    return handlePapertOAuthError(error);
  }

  return handlePolicyDrivenFallback(config, failedModel, authType, error);
}

/**
 * Fallback logic using the ModelAvailabilityService + policy chain.
 */
async function handlePolicyDrivenFallback(
  config: Config,
  failedModel: string,
  authType?: string,
  error?: unknown,
): Promise<string | boolean | null> {
  if (authType !== AuthType.LOGIN_WITH_GOOGLE) {
    return null;
  }

  const chain = resolvePolicyChain(config);
  const { failedPolicy, candidates } = buildFallbackPolicyContext(
    chain,
    failedModel,
  );

  const failureKind = classifyFailureKind(error);
  const availability = config.getModelAvailabilityService();
  const getAvailabilityContext = () => {
    if (!failedPolicy) return undefined;
    return { service: availability, policy: failedPolicy };
  };

  let fallbackModel: string;
  if (!candidates.length) {
    fallbackModel = failedModel;
  } else {
    const selection = availability.selectFirstAvailable(
      candidates.map((policy) => policy.model),
    );

    const lastResortPolicy = candidates.find((policy) => policy.isLastResort);
    const selectedFallbackModel =
      selection.selectedModel ?? lastResortPolicy?.model;
    const selectedPolicy = candidates.find(
      (policy) => policy.model === selectedFallbackModel,
    );

    if (
      !selectedFallbackModel ||
      selectedFallbackModel === failedModel ||
      !selectedPolicy
    ) {
      return null;
    }

    fallbackModel = selectedFallbackModel;

    const action = resolvePolicyAction(failureKind, selectedPolicy);

    if (action === 'silent') {
      applyAvailabilityTransition(getAvailabilityContext, failureKind);
      return processIntent(config, 'retry_always', fallbackModel, authType);
    }

    // This will be used when FallbackRecommendation is passed through UI
    const recommendation: FallbackRecommendation = {
      ...selection,
      selectedModel: fallbackModel,
      action,
      failureKind,
      failedPolicy,
      selectedPolicy,
    };
    void recommendation;
  }

  const handler =
    typeof config.getFallbackModelHandler === 'function'
      ? config.getFallbackModelHandler()
      : config.fallbackModelHandler;
  if (typeof handler !== 'function') {
    return null;
  }

  try {
    const intent = await handler(failedModel, fallbackModel, error);

    if (
      intent === 'retry_always' ||
      intent === 'retry_once' ||
      intent === 'retry'
    ) {
      applyAvailabilityTransition(getAvailabilityContext, failureKind);
    }

    return await processIntent(config, intent, fallbackModel, authType);
  } catch (handlerError) {
    debugLogger.error('Fallback handler failed:', handlerError);
    return null;
  }
}

async function handleUpgrade() {
  try {
    await openBrowserSecurely(UPGRADE_URL_PAGE);
  } catch (error) {
    debugLogger.warn(
      'Failed to open browser automatically:',
      getErrorMessage(error),
    );
  }
}

async function processIntent(
  config: Config,
  intent: FallbackIntent | null,
  fallbackModel: string,
  authType?: string,
): Promise<boolean> {
  switch (intent) {
    case 'retry_always':
    case 'retry_once':
    case 'retry':
      config.setActiveModel(fallbackModel);
      if (!config.isInFallbackMode()) {
        config.setFallbackMode(true);
        if (authType) {
          logFlashFallback(config, new FlashFallbackEvent(authType));
        }
      }
      return true;

    case 'stop':
    case 'retry_later':
    case 'auth':
      return false;

    case 'upgrade':
      await handleUpgrade();
      return false;

    default:
      throw new Error(
        `Unexpected fallback intent received from fallbackModelHandler: "${intent}"`,
      );
  }
}

/**
 * Handles Papert OAuth authentication errors and rate limiting
 */
async function handlePapertOAuthError(error?: unknown): Promise<string | null> {
  if (!error) {
    return null;
  }

  const errorMessage =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();
  const errorCode =
    (error as { status?: number; code?: number })?.status ||
    (error as { status?: number; code?: number })?.code;

  const isAuthError =
    errorCode === 401 ||
    errorCode === 403 ||
    errorMessage.includes('unauthorized') ||
    errorMessage.includes('forbidden') ||
    errorMessage.includes('invalid api key') ||
    errorMessage.includes('authentication') ||
    errorMessage.includes('access denied') ||
    (errorMessage.includes('token') && errorMessage.includes('expired'));

  const isRateLimitError =
    errorCode === 429 ||
    errorMessage.includes('429') ||
    errorMessage.includes('rate limit') ||
    errorMessage.includes('too many requests');

  if (isAuthError) {
    console.warn('Papert OAuth authentication error detected:', errorMessage);
    console.log(
      'Note: If this persists, you may need to re-authenticate with Papert OAuth',
    );
    return null;
  }

  if (isRateLimitError) {
    console.warn('Papert API rate limit encountered:', errorMessage);
    return null;
  }

  return null;
}
