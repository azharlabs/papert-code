/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Lightweight debug logger used by newer agent/policy utilities.
 * Intentionally minimal to avoid pulling a full logging stack.
 */
class DebugLogger {
  log(...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.log(...args);
  }

  warn(...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.warn(...args);
  }

  error(...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.error(...args);
  }

  debug(...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.debug(...args);
  }
}

export const debugLogger = new DebugLogger();
