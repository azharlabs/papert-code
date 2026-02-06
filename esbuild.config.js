/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { writeFileSync, rmSync } from 'node:fs';

let esbuild;
try {
  esbuild = (await import('esbuild')).default;
} catch (_error) {
  console.warn('esbuild not available, skipping bundle step');
  process.exit(0);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const pkg = require(path.resolve(__dirname, 'package.json'));

// Clean dist directory (cross-platform)
rmSync(path.resolve(__dirname, 'dist'), { recursive: true, force: true });

const external = [
  '@lydell/node-pty',
  'node-pty',
  '@lydell/node-pty-darwin-arm64',
  '@lydell/node-pty-darwin-x64',
  '@lydell/node-pty-linux-x64',
  '@lydell/node-pty-win32-arm64',
  '@lydell/node-pty-win32-x64',
  'tiktoken',
];

esbuild
  .build({
    entryPoints: ['packages/cli/index.ts'],
    bundle: true,
    outdir: 'dist',
    entryNames: 'cli',
    chunkNames: 'chunks/[name]-[hash]',
    platform: 'node',
    format: 'esm',
    target: 'node20',
    splitting: true,
    external,
    packages: 'bundle',
    inject: [path.resolve(__dirname, 'scripts/esbuild-shims.js')],
    banner: {
      js: `// Force strict mode and setup for ESM
"use strict";
const __papertOriginalEmitWarning = process.emitWarning.bind(process);
process.emitWarning = function patchedEmitWarning(warning, ...args) {
  if (!process.env.PAPERT_SHOW_NODE_DEPRECATIONS) {
    const warningCode =
      (warning && typeof warning === 'object' && 'code' in warning && warning.code) ||
      (args.length > 1 && typeof args[1] === 'string' && args[1]) ||
      (args.length > 0 &&
        args[0] &&
        typeof args[0] === 'object' &&
        'code' in args[0] &&
        args[0].code);
    if (warningCode === 'DEP0040' || warningCode === 'DEP0169') {
      return;
    }
  }
  return __papertOriginalEmitWarning(warning, ...args);
};`,
    },
    alias: {
      'is-in-ci': path.resolve(
        __dirname,
        'packages/cli/src/patches/is-in-ci.ts',
      ),
      'node-fetch': path.resolve(
        __dirname,
        'packages/cli/src/patches/node-fetch.ts',
      ),
    },
    define: {
      'process.env.CLI_VERSION': JSON.stringify(pkg.version),
      // Make global available for compatibility
      global: 'globalThis',
    },
    loader: { '.node': 'file' },
    metafile: true,
    write: true,
    keepNames: true,
  })
  .then(({ metafile }) => {
    if (process.env.DEV === 'true') {
      writeFileSync('./dist/esbuild.json', JSON.stringify(metafile, null, 2));
    }
  })
  .catch((error) => {
    console.error('esbuild build failed:', error);
    process.exitCode = 1;
  });
