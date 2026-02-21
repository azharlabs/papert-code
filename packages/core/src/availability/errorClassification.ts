/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  TerminalQuotaError,
  RetryableQuotaError,
} from '../utils/googleQuotaErrors.js';
import { getErrorStatus, ModelNotFoundError } from '../utils/httpErrors.js';
import type { FailureKind } from './modelPolicy.js';

const TERMINAL_MESSAGE_PATTERNS = [
  /\binsufficient[_\s-]?quota\b/i,
  /\bquota exceeded\b/i,
  /\bbilling.*(limit|exceeded)\b/i,
  /\bunauthorized\b/i,
  /\bforbidden\b/i,
  /\binvalid api key\b/i,
  /\bauthentication\b/i,
];

const TRANSIENT_MESSAGE_PATTERNS = [
  /\brate limit\b/i,
  /\btoo many requests\b/i,
  /\btemporar(?:y|ily)\b/i,
  /\bplease retry\b/i,
  /\btimeout\b/i,
  /\bservice unavailable\b/i,
];

const MODEL_NOT_FOUND_PATTERNS = [
  /\bmodel\b.*\bnot found\b/i,
  /\bunknown model\b/i,
];

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error ?? '');
}

export function classifyFailureKind(error: unknown): FailureKind {
  if (error instanceof TerminalQuotaError) {
    return 'terminal';
  }
  if (error instanceof RetryableQuotaError) {
    return 'transient';
  }
  if (error instanceof ModelNotFoundError) {
    return 'not_found';
  }

  const status = getErrorStatus(error);
  if (status === 404) {
    return 'not_found';
  }
  if (status === 401 || status === 402 || status === 403) {
    return 'terminal';
  }
  if (typeof status === 'number') {
    if (
      status === 408 ||
      status === 409 ||
      status === 425 ||
      status === 429 ||
      (status >= 500 && status < 600)
    ) {
      return 'transient';
    }
  }

  const message = getErrorMessage(error);
  if (MODEL_NOT_FOUND_PATTERNS.some((pattern) => pattern.test(message))) {
    return 'not_found';
  }
  if (TERMINAL_MESSAGE_PATTERNS.some((pattern) => pattern.test(message))) {
    return 'terminal';
  }
  if (TRANSIENT_MESSAGE_PATTERNS.some((pattern) => pattern.test(message))) {
    return 'transient';
  }

  return 'unknown';
}
