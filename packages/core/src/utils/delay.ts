/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export function createAbortError(): Error {
  const abortError = new Error('Aborted');
  abortError.name = 'AbortError';
  return abortError;
}

export function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (!signal) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  if (signal.aborted) {
    return Promise.reject(createAbortError());
  }

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timeoutId);
      signal.removeEventListener('abort', onAbort);
      reject(createAbortError());
    };

    signal.addEventListener('abort', onAbort, { once: true });
  });
}
