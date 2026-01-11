/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import os from 'node:os';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { PluginSystem } from './pluginSystem.js';

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

function createMockConfig(params: {
  projectRoot: string;
  plugins: string[];
  enableNpmPlugins: boolean;
  autoInstallNpmPlugins: boolean;
  trusted: boolean;
}) {
  return {
    getProjectRoot: () => params.projectRoot,
    getPlugins: () => params.plugins,
    getEnableNpmPlugins: () => params.enableNpmPlugins,
    getAutoInstallNpmPlugins: () => params.autoInstallNpmPlugins,
    isTrustedFolder: () => params.trusted,
  } as any;
}

describe('PluginSystem (npm plugins)', () => {
  it('loads npm plugin from project node_modules when enabled', async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'papert-npm-plugin-'));
    const projectRoot = path.join(tmp, 'project');
    await mkdir(projectRoot, { recursive: true });

    // Ensure global plugins dir doesn't interfere
    const fakeHome = path.join(tmp, 'home');
    process.env['HOME'] = fakeHome;
    process.env['USERPROFILE'] = fakeHome;

    await writeFakePluginPackage(projectRoot, 'papert-plugin-foo');

    const config = createMockConfig({
      projectRoot,
      plugins: ['papert-plugin-foo'],
      enableNpmPlugins: true,
      autoInstallNpmPlugins: false,
      trusted: true,
    });

    const system = new PluginSystem(config);
    await system.initialize();

    expect(system.getLoadedPlugins().map((p) => p.name)).toEqual([
      'papert-plugin-foo',
    ]);
  });

  it('does not auto-install when folder is untrusted', async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'papert-npm-plugin-'));
    const projectRoot = path.join(tmp, 'project');
    await mkdir(projectRoot, { recursive: true });

    const fakeHome = path.join(tmp, 'home');
    process.env['HOME'] = fakeHome;
    process.env['USERPROFILE'] = fakeHome;

    const config = createMockConfig({
      projectRoot,
      plugins: ['papert-plugin-missing@1.0.0'],
      enableNpmPlugins: true,
      autoInstallNpmPlugins: true,
      trusted: false,
    });

    const system = new PluginSystem(config);
    await system.initialize();

    expect(system.getLoadedPlugins()).toEqual([]);
  });

  it('attempts auto-install when enabled and folder is trusted', async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'papert-npm-plugin-'));
    const projectRoot = path.join(tmp, 'project');
    await mkdir(projectRoot, { recursive: true });

    const fakeHome = path.join(tmp, 'home');
    process.env['HOME'] = fakeHome;
    process.env['USERPROFILE'] = fakeHome;

    const installer = await import('./npmPluginInstaller.js');
    const installSpy = vi
      .spyOn(installer, 'installNpmPlugin')
      .mockResolvedValue(undefined);

    const config = createMockConfig({
      projectRoot,
      plugins: ['papert-plugin-missing@1.0.0'],
      enableNpmPlugins: true,
      autoInstallNpmPlugins: true,
      trusted: true,
    });

    const system = new PluginSystem(config);
    await system.initialize();

    expect(installSpy).toHaveBeenCalledWith(
      expect.objectContaining({ installTarget: 'papert-plugin-missing@1.0.0' }),
    );

    // The plugin won't actually load because we mocked install and didn't create the package.
  });
});
