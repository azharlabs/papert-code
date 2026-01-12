/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import os from 'node:os';
import path from 'node:path';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { PluginSystem } from './pluginSystem.js';

function createMockConfig(projectRoot: string) {
  return {
    getProjectRoot: () => projectRoot,
    getEnableNpmPlugins: () => false,
    getPlugins: () => [],
    getAutoInstallNpmPlugins: () => false,
    isTrustedFolder: () => false,
  } as any;
}

describe('PluginSystem', () => {
  const originalHome = process.env['HOME'];

  afterEach(() => {
    if (originalHome === undefined) {
      delete process.env['HOME'];
    } else {
      process.env['HOME'] = originalHome;
    }
  });

  it('loads project plugin and emits tool events', async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'papert-plugins-'));
    const projectRoot = path.join(tmp, 'project');
    await mkdir(path.join(projectRoot, 'plugin'), { recursive: true });

    const pluginFile = path.join(projectRoot, 'plugin', 'test-plugin.mjs');
    await writeFile(
      pluginFile,
      `export default () => ({\n` +
        `  name: 'test-plugin',\n` +
        `  hooks: {\n` +
        `    'tool.execute.before': (payload) => { globalThis.__seen = payload.toolName },\n` +
        `  }\n` +
        `})\n`,
      'utf8',
    );

    // Ensure global plugins dir doesn't interfere
    const fakeHome = path.join(tmp, 'home');
    process.env['HOME'] = fakeHome;
    process.env['USERPROFILE'] = fakeHome;

    const config = createMockConfig(projectRoot);
    const system = new PluginSystem(config);
    await system.initialize();

    expect(system.getLoadedPlugins().map((p) => p.name)).toEqual(['test-plugin']);

    await system.getEventBus().emit(
      'tool.execute.before',
      { toolName: 'read_file', args: {} },
      { config },
    );

    expect((globalThis as any).__seen).toBe('read_file');
  });

  it('loads global plugins from ~/.papert/plugins', async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'papert-plugins-'));
    const projectRoot = path.join(tmp, 'project');
    await mkdir(projectRoot, { recursive: true });

    const fakeHome = path.join(tmp, 'home');
    process.env['HOME'] = fakeHome;
    process.env['USERPROFILE'] = fakeHome;

    const globalPluginDir = path.join(fakeHome, '.papert', 'plugins');
    await mkdir(globalPluginDir, { recursive: true });

    const pluginFile = path.join(globalPluginDir, 'global-plugin.mjs');
    await writeFile(
      pluginFile,
      `export default () => ({ name: 'global-plugin' })\n`,
      'utf8',
    );

    const config = createMockConfig(projectRoot);
    const system = new PluginSystem(config);
    await system.initialize();

    expect(system.getLoadedPlugins().map((p) => p.name)).toEqual(['global-plugin']);
  });
});
