/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
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

  private getEnableNpmPlugins(): boolean {
    return this.config.getEnableNpmPlugins();
  }

  private getPlugins(): string[] {
    return this.config.getPlugins();
  }

  private getAutoInstallNpmPlugins(): boolean {
    return this.config.getAutoInstallNpmPlugins();
  }

  private isTrustedFolder(): boolean {
    return this.config.isTrustedFolder();
  }

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
    const configuredFileSpecifiers: string[] = [];

    for (const raw of this.getPlugins()) {
      if (raw.startsWith('file:')) {
        configuredFileSpecifiers.push(raw);
        continue;
      }

      if (raw.startsWith('.') || raw.startsWith('/')) {
        const resolved = raw.startsWith('/')
          ? raw
          : path.resolve(projectRoot, raw);
        configuredFileSpecifiers.push(pathToFileURL(resolved).toString());
        continue;
      }
    }

    if (this.getEnableNpmPlugins()) {
      for (const raw of this.getPlugins()) {
        if (
          raw.startsWith('file:') ||
          raw.startsWith('.') ||
          raw.startsWith('/')
        ) {
          continue;
        }
        const spec = parseNpmPluginSpec(raw);
        try {
          const resolved = resolveNpmPluginSpecifier(spec.packageName, {
            projectRoot,
            globalPluginsDir,
          });
          npmSpecifiers.push(resolved.specifier);
        } catch {
          if (this.getAutoInstallNpmPlugins() && this.isTrustedFolder()) {
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

    const specifiers = [
      ...fileSpecifiers,
      ...configuredFileSpecifiers,
      ...npmSpecifiers,
    ];
    const uniqueSpecifiers = [...new Set(specifiers)];

    for (const specifier of uniqueSpecifiers) {
      const mod = (await import(specifier)) as PluginModule;
      const init = mod.default ?? mod.plugin;
      if (!init) continue;

      let def: PluginDefinition | null = null;
      if (typeof init === 'function') {
        def = (await init(ctx)) as PluginDefinition;
      } else if (typeof init === 'object') {
        def = init as PluginDefinition;
      }

      if (!def) continue;
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
