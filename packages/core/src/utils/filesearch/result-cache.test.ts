/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { test, expect, vi } from 'vitest';
import { ResultCache } from './result-cache.js';

test('ResultCache basic usage', async () => {
  const files = [
    'foo.txt',
    'bar.js',
    'baz.md',
    'subdir/file.txt',
    'subdir/other.js',
    'subdir/nested/file.md',
  ];
  const cache = new ResultCache(files);
  const { files: resultFiles, isExactMatch } = await cache.get('*.js');
  expect(resultFiles).toEqual(files);
  expect(isExactMatch).toBe(false);
});

test('ResultCache cache hit/miss', async () => {
  const files = ['foo.txt', 'bar.js', 'baz.md'];
  const cache = new ResultCache(files);
  // First call: miss
  const { files: result1Files, isExactMatch: isExactMatch1 } =
    await cache.get('*.js');
  expect(result1Files).toEqual(files);
  expect(isExactMatch1).toBe(false);

  // Simulate FileSearch applying the filter and setting the result
  cache.set('*.js', ['bar.js']);

  // Second call: hit
  const { files: result2Files, isExactMatch: isExactMatch2 } =
    await cache.get('*.js');
  expect(result2Files).toEqual(['bar.js']);
  expect(isExactMatch2).toBe(true);
});

test('ResultCache best base query', async () => {
  const files = ['foo.txt', 'foobar.js', 'baz.md'];
  const cache = new ResultCache(files);

  // Cache a broader query
  cache.set('foo', ['foo.txt', 'foobar.js']);

  // Search for a more specific query that starts with the broader one
  const { files: resultFiles, isExactMatch } = await cache.get('foobar');
  expect(resultFiles).toEqual(['foo.txt', 'foobar.js']);
  expect(isExactMatch).toBe(false);
});

test('ResultCache evicts oldest entries when limit exceeded', async () => {
  const files = ['a.txt', 'b.txt', 'c.txt'];
  const cache = new ResultCache(files, { maxEntries: 2, ttlMs: 60_000 });

  cache.set('a', ['a.txt']);
  cache.set('b', ['b.txt']);
  cache.set('c', ['c.txt']);

  const { files: resultFiles, isExactMatch } = await cache.get('a');
  expect(resultFiles).toEqual(files);
  expect(isExactMatch).toBe(false);
});

test('ResultCache expires entries after TTL', async () => {
  vi.useFakeTimers();
  const files = ['foo.txt', 'bar.js'];
  const cache = new ResultCache(files, { maxEntries: 10, ttlMs: 50 });
  cache.set('foo', ['foo.txt']);

  vi.advanceTimersByTime(60);

  const { files: resultFiles, isExactMatch } = await cache.get('foo');
  expect(resultFiles).toEqual(files);
  expect(isExactMatch).toBe(false);

  vi.useRealTimers();
});
