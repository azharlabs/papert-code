/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

interface CacheEntry<V> {
  value: V;
  expiresAt?: number;
}

interface LruCacheOptions {
  ttlMs?: number;
}

export class LruCache<K, V> {
  private cache: Map<K, CacheEntry<V>>;
  private maxSize: number;
  private ttlMs?: number;

  constructor(maxSize: number, options: LruCacheOptions = {}) {
    this.cache = new Map<K, CacheEntry<V>>();
    this.maxSize = maxSize;
    this.ttlMs = options.ttlMs;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return undefined;
    }

    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V, ttlMs?: number): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    const entryTtl = ttlMs ?? this.ttlMs;
    this.cache.set(key, {
      value,
      expiresAt: entryTtl ? Date.now() + entryTtl : undefined,
    });
  }

  keys(): IterableIterator<K> {
    return this.cache.keys();
  }

  clear(): void {
    this.cache.clear();
  }
}
