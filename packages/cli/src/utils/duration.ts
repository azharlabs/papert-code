/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

const UNIT_MS = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
} as const;
type UnitKey = keyof typeof UNIT_MS;

export function parseDurationMs(input: string): number | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;
  const normalized = raw.replace(/\s+/g, '');

  let total = 0;
  let matched = false;
  const pattern = /(\d+(?:\.\d+)?)(ms|s|m|h|d|w)/g;
  let lastIndex = 0;

  for (const match of normalized.matchAll(pattern)) {
    matched = true;
    if (match.index !== lastIndex) return null;
    const value = Number.parseFloat(match[1] ?? '');
    const unit = (match[2] ?? '') as UnitKey;
    if (!Number.isFinite(value) || value <= 0) return null;
    const unitMs = UNIT_MS[unit];
    if (!unitMs) return null;
    total += value * unitMs;
    lastIndex = (match.index ?? 0) + match[0].length;
  }

  if (!matched || lastIndex !== normalized.length) return null;
  return Math.floor(total);
}

export function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0s';
  const units: Array<[string, number]> = [
    ['w', UNIT_MS['w']],
    ['d', UNIT_MS['d']],
    ['h', UNIT_MS['h']],
    ['m', UNIT_MS['m']],
    ['s', UNIT_MS['s']],
  ];
  let remaining = Math.floor(ms);
  const parts: string[] = [];
  for (const [label, size] of units) {
    if (remaining < size) continue;
    const count = Math.floor(remaining / size);
    remaining -= count * size;
    parts.push(`${count}${label}`);
    if (parts.length >= 2) break;
  }
  if (parts.length === 0) return `${Math.max(1, Math.floor(ms))}ms`;
  return parts.join(' ');
}
