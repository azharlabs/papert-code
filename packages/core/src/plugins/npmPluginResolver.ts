/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

export interface NpmPluginResolveOptions {
  projectRoot: string;
  globalPluginsDir: string;
}

export interface NpmPluginResolveResult {
  /** Importable specifier (file:// URL) */
  specifier: string;
  /** Where it was resolved from */
  source: 'project' | 'global';
}

function resolveFromBase(spec: string, baseDir: string): string {
  const require = createRequire(path.join(baseDir, 'package.json'));
  return require.resolve(spec);
}

export function resolveNpmPluginSpecifier(
  packageName: string,
  opts: NpmPluginResolveOptions,
): NpmPluginResolveResult {
  try {
    const resolved = resolveFromBase(packageName, opts.projectRoot);
    return {
      specifier: pathToFileURL(resolved).toString(),
      source: 'project',
    };
  } catch {
    // fallthrough
  }

  const resolved = resolveFromBase(packageName, opts.globalPluginsDir);
  return {
    specifier: pathToFileURL(resolved).toString(),
    source: 'global',
  };
}
