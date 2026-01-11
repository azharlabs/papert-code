/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import os from 'node:os';
import path from 'node:path';
import { PluginEventBus } from './pluginEventBus.js';
import type { Config } from '../config/config.js';
import type { PluginContext, PluginDefinition, PluginModule } from './types.js';
import { discoverLocalPluginSpecifiers } from './pluginLoader.js';
import { getNpmInstallTarget, parseNpmPluginSpec } from './npmPluginSpec.js';
import { resolveNpmPluginSpecifier } from './npmPluginResolver.js';
import { installNpmPlugin } from './npmPluginInstaller.js';

export interface LoadedPlugin {
  name: string;
  specifier: string;
}

export class PluginSystem {
  private initialized = false;
  private readonly bus = new PluginEventBus();
  private readonly loaded: LoadedPlugin[] = [];

  constructor(readonly config: Config) {}

  getEventBus(): PluginEventBus {
    return this.bus;
  }

  getLoadedPlugins(): readonly LoadedPlugin[] {
    return this.loaded;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    const ctx: PluginContext = { config: this.config };

    const projectRoot = this.config.getProjectRoot();
    const globalPluginsDir = path.join(os.homedir(), '.papert', 'plugins');

    const fileSpecifiers = await discoverLocalPluginSpecifiers({
      projectRoot,
      globalPluginsDir,
    });

    const npmSpecifiers: string[] = [];
    const enableNpmPlugins =
      'getEnableNpmPlugins' in this.config &&
      typeof this.config.getEnableNpmPlugins === 'function'
        ? this.config.getEnableNpmPlugins()
        : false;

    const configuredPlugins =
      'getPlugins' in this.config && typeof this.config.getPlugins === 'function'
        ? this.config.getPlugins()
        : [];

    if (enableNpmPlugins) {
      for (const raw of configuredPlugins) {
        const spec = parseNpmPluginSpec(raw);
        try {
          const resolved = resolveNpmPluginSpecifier(spec.packageName, {
            projectRoot,
            globalPluginsDir,
          });
          npmSpecifiers.push(resolved.specifier);
        } catch {
          const autoInstallNpmPlugins =
            'getAutoInstallNpmPlugins' in this.config &&
            typeof this.config.getAutoInstallNpmPlugins === 'function'
              ? this.config.getAutoInstallNpmPlugins()
              : false;

          const isTrustedFolder =
            'isTrustedFolder' in this.config &&
            typeof this.config.isTrustedFolder === 'function'
              ? this.config.isTrustedFolder()
              : false;

          if (autoInstallNpmPlugins && isTrustedFolder) {
            await installNpmPlugin({
              globalPluginsDir,
              installTarget: getNpmInstallTarget(spec),
            });

            try {
              const resolved = resolveNpmPluginSpecifier(spec.packageName, {
                projectRoot,
                globalPluginsDir,
              });
              npmSpecifiers.push(resolved.specifier);
            } catch {
              // If install succeeded but resolution still fails, skip.
            }
          }
        }
      }
    }

    const specifiers = [...fileSpecifiers, ...npmSpecifiers];

    for (const specifier of specifiers) {
      const mod = (await import(specifier)) as PluginModule;
      const init = mod.default ?? mod.plugin;
      if (!init) continue;

      const def = (await init(ctx)) as PluginDefinition;
      this.registerPlugin(def, specifier);
    }
  }

  private registerPlugin(def: PluginDefinition, specifier: string): void {
    this.loaded.push({ name: def.name, specifier });

    const hooks = def.hooks ?? {};
    for (const [event, handlerOrHandlers] of Object.entries(hooks)) {
      const handlers = Array.isArray(handlerOrHandlers)
        ? handlerOrHandlers
        : [handlerOrHandlers];

      for (const handler of handlers) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.bus.on(event as any, handler as any);
      }
    }
  }
}
