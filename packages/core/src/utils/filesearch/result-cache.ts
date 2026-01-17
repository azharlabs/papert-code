import { LruCache } from '../LruCache.js';

/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

interface ResultCacheOptions {
  maxEntries?: number;
  ttlMs?: number;
}

/**
 * Implements an in-memory cache for file search results.
 * This cache optimizes subsequent searches by leveraging previously computed results.
 */
export class ResultCache {
  private readonly cache: LruCache<string, string[]>;
  private hits = 0;
  private misses = 0;

  constructor(
    private readonly allFiles: string[],
    options: ResultCacheOptions = {},
  ) {
    const maxEntries = options.maxEntries ?? 200;
    const ttlMs = options.ttlMs ?? 60_000;
    this.cache = new LruCache<string, string[]>(maxEntries, { ttlMs });
  }

  /**
   * Retrieves cached search results for a given query, or provides a base set
   * of files to search from.
   * @param query The search query pattern.
   * @returns An object containing the files to search and a boolean indicating
   *          if the result is an exact cache hit.
   */
  async get(
    query: string,
  ): Promise<{ files: string[]; isExactMatch: boolean }> {
    const cached = this.cache.get(query);
    const isCacheHit = cached !== undefined;

    if (isCacheHit) {
      this.hits++;
      return { files: cached!, isExactMatch: true };
    }

    this.misses++;

    let bestBaseQuery = '';
    for (const key of this.cache.keys()) {
      if (query.startsWith(key) && key.length > bestBaseQuery.length) {
        bestBaseQuery = key;
      }
    }

    const baseFiles = bestBaseQuery ? this.cache.get(bestBaseQuery) : undefined;
    const filesToSearch = baseFiles ?? this.allFiles;
    return { files: filesToSearch, isExactMatch: false };
  }

  /**
   * Stores search results in the cache.
   * @param query The search query pattern.
   * @param results The matching file paths to cache.
   */
  set(query: string, results: string[]): void {
    this.cache.set(query, results);
  }
}
