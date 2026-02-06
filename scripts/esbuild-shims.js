/**
 * @license
 * Copyright 2025 Papert
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Shims for esbuild ESM bundles to support require() calls
 * This file is injected into the bundle via esbuild's inject option
 */

import { createRequire } from 'node:module';

// Create require function for the current module and make it global
const _require = createRequire(import.meta.url);

// Make require available globally for dynamic requires
if (typeof globalThis.require === 'undefined') {
  globalThis.require = _require;
}

// Export for esbuild injection
export const require = _require;
