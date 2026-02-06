/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

type FetchFn = typeof globalThis.fetch;

const fetchImpl = globalThis.fetch as FetchFn | undefined;

if (!fetchImpl) {
  throw new Error('Global fetch is unavailable in this Node runtime.');
}

export default fetchImpl;
