/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Deterministic JSON stringify with sorted keys. This mirrors the upstream
 * helper but keeps the implementation intentionally small.
 */
export function stableStringify(obj: unknown): string {
  const stringify = (value: unknown): string => {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
      return `[${value.map(stringify).join(',')}]`;
    }

    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([a], [b]) => a.localeCompare(b),
    );
    return `{${entries
      .map(([k, v]) => `${JSON.stringify(k)}:${stringify(v)}`)
      .join(',')}}`;
  };

  return stringify(obj);
}
