/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { glob } from 'glob';

export interface PluginDiscoveryOptions {
  projectRoot: string;
  globalPluginsDir: string;
}

const DEFAULT_PLUGIN_GLOBS = ['*.{js,ts,mjs,cjs}'];

export async function discoverLocalPluginSpecifiers(
  opts: PluginDiscoveryOptions,
): Promise<string[]> {
  const projectPluginsDir = path.join(opts.projectRoot, '.papert', 'plugins');
  const projectMatches = fs.existsSync(projectPluginsDir)
    ? await glob(DEFAULT_PLUGIN_GLOBS, {
        cwd: projectPluginsDir,
        absolute: true,
        nodir: true,
      })
    : [];

  const globalMatches = await glob(DEFAULT_PLUGIN_GLOBS, {
    cwd: opts.globalPluginsDir,
    absolute: true,
    nodir: true,
  });

  const all = [...projectMatches, ...globalMatches]
    .map((p) => pathToFileURL(path.resolve(p)).toString())
    .sort();

  // Dedupe
  return [...new Set(all)];
}
