/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import os from 'node:os';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { resolveNpmPluginSpecifier } from './npmPluginResolver.js';

async function writeFakePluginPackage(baseDir: string, name: string) {
  const pkgDir = path.join(baseDir, 'node_modules', name);
  await mkdir(pkgDir, { recursive: true });
  await writeFile(
    path.join(pkgDir, 'package.json'),
    JSON.stringify({ name, version: '0.0.0', main: 'index.js' }, null, 2),
    'utf8',
  );
  await writeFile(
    path.join(pkgDir, 'index.js'),
    `module.exports = () => ({ name: '${name}' })\n`,
    'utf8',
  );
}

describe('npmPluginResolver', () => {
  it('resolves from project node_modules first', async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'papert-npm-plugin-'));
    const projectRoot = path.join(tmp, 'project');
    const globalPluginsDir = path.join(tmp, 'global');
    await mkdir(projectRoot, { recursive: true });
    await mkdir(globalPluginsDir, { recursive: true });

    await writeFakePluginPackage(projectRoot, 'papert-plugin-foo');
    await writeFakePluginPackage(globalPluginsDir, 'papert-plugin-foo');

    const resolved = resolveNpmPluginSpecifier('papert-plugin-foo', {
      projectRoot,
      globalPluginsDir,
    });

    expect(resolved.source).toBe('project');
    expect(resolved.specifier.startsWith('file://')).toBe(true);
  });

  it('falls back to global node_modules', async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'papert-npm-plugin-'));
    const projectRoot = path.join(tmp, 'project');
    const globalPluginsDir = path.join(tmp, 'global');
    await mkdir(projectRoot, { recursive: true });
    await mkdir(globalPluginsDir, { recursive: true });

    await writeFakePluginPackage(globalPluginsDir, 'papert-plugin-bar');

    const resolved = resolveNpmPluginSpecifier('papert-plugin-bar', {
      projectRoot,
      globalPluginsDir,
    });

    expect(resolved.source).toBe('global');
    expect(resolved.specifier.startsWith('file://')).toBe(true);
  });
});
