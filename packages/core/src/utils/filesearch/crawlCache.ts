/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'node:crypto';

const crawlCache = new Map<string, string[]>();
const cacheTimers = new Map<string, NodeJS.Timeout>();
const MAX_CRAWL_CACHE_ENTRIES = 50;

function touchEntry(key: string, value: string[]): void {
  crawlCache.delete(key);
  crawlCache.set(key, value);
}

function evictOldestEntry(): void {
  const oldestKey = crawlCache.keys().next().value;
  if (oldestKey !== undefined) {
    crawlCache.delete(oldestKey);
    const timer = cacheTimers.get(oldestKey);
    if (timer) {
      clearTimeout(timer);
      cacheTimers.delete(oldestKey);
    }
  }
}

/**
 * Generates a unique cache key based on the project directory and the content
 * of ignore files. This ensures that the cache is invalidated if the project
 * or ignore rules change.
 */
export const getCacheKey = (
  directory: string,
  ignoreContent: string,
  maxDepth?: number,
): string => {
  const hash = crypto.createHash('sha256');
  hash.update(directory);
  hash.update(ignoreContent);
  if (maxDepth !== undefined) {
    hash.update(String(maxDepth));
  }
  return hash.digest('hex');
};

/**
 * Reads cached data from the in-memory cache.
 * Returns undefined if the key is not found.
 */
export const read = (key: string): string[] | undefined => {
  const value = crawlCache.get(key);
  if (value) {
    touchEntry(key, value);
  }
  return value;
};

/**
 * Writes data to the in-memory cache and sets a timer to evict it after the TTL.
 */
export const write = (key: string, results: string[], ttlMs: number): void => {
  // Clear any existing timer for this key to prevent premature deletion
  if (cacheTimers.has(key)) {
    clearTimeout(cacheTimers.get(key)!);
  }

  // Store the new data
  if (!crawlCache.has(key) && crawlCache.size >= MAX_CRAWL_CACHE_ENTRIES) {
    evictOldestEntry();
  }
  touchEntry(key, results);

  // Set a timer to automatically delete the cache entry after the TTL
  const timerId = setTimeout(() => {
    crawlCache.delete(key);
    cacheTimers.delete(key);
  }, ttlMs);

  // Store the timer handle so we can clear it if the entry is updated
  cacheTimers.set(key, timerId);
};

/**
 * Clears the entire cache and all active timers.
 * Primarily used for testing.
 */
export const clear = (): void => {
  for (const timerId of cacheTimers.values()) {
    clearTimeout(timerId);
  }
  crawlCache.clear();
  cacheTimers.clear();
};
