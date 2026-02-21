/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { TerminalQuotaError, RetryableQuotaError } from '../utils/googleQuotaErrors.js';
import { ModelNotFoundError } from '../utils/httpErrors.js';
import { classifyFailureKind } from './errorClassification.js';

describe('classifyFailureKind', () => {
  it('classifies known structured quota errors', () => {
    const cause = { code: 429, message: 'quota hit', details: [] };
    expect(classifyFailureKind(new TerminalQuotaError('quota hit', cause))).toBe(
      'terminal',
    );
    expect(
      classifyFailureKind(new RetryableQuotaError('retry', cause, 5)),
    ).toBe('transient');
  });

  it('classifies model-not-found errors', () => {
    expect(classifyFailureKind(new ModelNotFoundError('missing model'))).toBe(
      'not_found',
    );
    expect(
      classifyFailureKind(new Error('The model was not found on this provider')),
    ).toBe('not_found');
  });

  it('classifies HTTP status errors in a provider-agnostic way', () => {
    const unauthorized = Object.assign(new Error('unauthorized'), {
      status: 401,
    });
    const rateLimit = Object.assign(new Error('ratelimit'), {
      status: 429,
    });
    const server = Object.assign(new Error('server'), { status: 503 });

    expect(classifyFailureKind(unauthorized)).toBe('terminal');
    expect(classifyFailureKind(rateLimit)).toBe('transient');
    expect(classifyFailureKind(server)).toBe('transient');
  });

  it('classifies common transient and terminal message patterns', () => {
    expect(classifyFailureKind(new Error('Too many requests, please retry'))).toBe(
      'transient',
    );
    expect(
      classifyFailureKind(new Error('insufficient_quota for this account')),
    ).toBe('terminal');
  });
});
