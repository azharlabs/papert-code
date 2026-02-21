/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import process from 'node:process';
import type { CommandModule } from 'yargs';
import type { Settings } from '../config/settings.js';
import { loadSettings } from '../config/settings.js';

type ExplainScope = 'system-defaults' | 'user' | 'workspace' | 'system';

export interface ConfigExplainEntry {
  key: string;
  effectiveValue: unknown;
  source: ExplainScope | 'unknown';
  contributors: ExplainScope[];
}

interface LoadedSettingsLike {
  merged: Settings;
  isTrusted: boolean;
  system: { settings: Settings };
  systemDefaults: { settings: Settings };
  user: { settings: Settings };
  workspace: { settings: Settings };
}

interface ConfigCommandArgs {
  action?: string;
  key?: string;
  json?: boolean;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function flattenSettings(
  value: unknown,
  prefix = '',
  output: Map<string, unknown> = new Map(),
): Map<string, unknown> {
  if (!isPlainObject(value)) {
    if (prefix) {
      output.set(prefix, value);
    }
    return output;
  }

  for (const key of Object.keys(value).sort()) {
    const next = (value as Record<string, unknown>)[key];
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(next)) {
      flattenSettings(next, path, output);
    } else {
      output.set(path, next);
    }
  }
  return output;
}

function getPathValue(
  root: Record<string, unknown> | undefined,
  dottedPath: string,
): { defined: boolean; value: unknown } {
  if (!root) {
    return { defined: false, value: undefined };
  }
  const parts = dottedPath.split('.');
  let current: unknown = root;
  for (const part of parts) {
    if (!isPlainObject(current) || !(part in current)) {
      return { defined: false, value: undefined };
    }
    current = current[part];
  }
  return { defined: true, value: current };
}

function shouldIncludeKey(path: string, keyFilter?: string): boolean {
  if (!keyFilter) {
    return true;
  }
  return path === keyFilter || path.startsWith(`${keyFilter}.`);
}

export function buildConfigExplainEntries(
  loadedSettings: LoadedSettingsLike,
  keyFilter?: string,
): ConfigExplainEntry[] {
  const flattenedMerged = flattenSettings(
    loadedSettings.merged as unknown as Record<string, unknown>,
  );

  const scopes: Array<{
    scope: ExplainScope;
    settings: Settings;
    enabled: boolean;
  }> = [
    {
      scope: 'system-defaults',
      settings: loadedSettings.systemDefaults.settings,
      enabled: true,
    },
    {
      scope: 'user',
      settings: loadedSettings.user.settings,
      enabled: true,
    },
    {
      scope: 'workspace',
      settings: loadedSettings.workspace.settings,
      enabled: loadedSettings.isTrusted,
    },
    {
      scope: 'system',
      settings: loadedSettings.system.settings,
      enabled: true,
    },
  ];

  const entries: ConfigExplainEntry[] = [];
  for (const [path, effectiveValue] of flattenedMerged.entries()) {
    if (!shouldIncludeKey(path, keyFilter)) {
      continue;
    }

    const contributors: ExplainScope[] = [];
    let source: ConfigExplainEntry['source'] = 'unknown';
    for (const scopeInfo of scopes) {
      if (!scopeInfo.enabled) {
        continue;
      }
      const scopedValue = getPathValue(
        scopeInfo.settings as unknown as Record<string, unknown>,
        path,
      );
      if (scopedValue.defined) {
        contributors.push(scopeInfo.scope);
        source = scopeInfo.scope;
      }
    }

    entries.push({
      key: path,
      effectiveValue,
      source,
      contributors,
    });
  }

  return entries.sort((left, right) => left.key.localeCompare(right.key));
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (value === undefined) {
    return 'undefined';
  }
  return JSON.stringify(value);
}

function printExplainReport(
  loadedSettings: LoadedSettingsLike,
  entries: ConfigExplainEntry[],
  keyFilter?: string,
) {
  console.log('Effective configuration report');
  console.log(
    'Precedence: system-defaults < user < workspace < system (last contributor wins)',
  );
  console.log(`Workspace trusted: ${loadedSettings.isTrusted ? 'yes' : 'no'}`);
  if (keyFilter) {
    console.log(`Filter: ${keyFilter}`);
  }
  console.log('');

  if (entries.length === 0) {
    console.log('No configuration keys matched the requested filter.');
    return;
  }

  for (const entry of entries) {
    console.log(`- ${entry.key}`);
    console.log(`  source: ${entry.source}`);
    console.log(`  effective: ${formatValue(entry.effectiveValue)}`);
    console.log(
      `  contributors: ${
        entry.contributors.length > 0 ? entry.contributors.join(', ') : 'none'
      }`,
    );
  }
}

export const configCommand: CommandModule = {
  command: 'config <action> [key]',
  describe: 'Inspect effective configuration and precedence sources',
  builder: (yargs) =>
    yargs
      .positional('action', {
        describe: 'Config operation to run',
        choices: ['explain'],
      })
      .positional('key', {
        describe:
          'Optional dotted key filter (e.g. general.releaseChannel or tools)',
        type: 'string',
      })
      .option('json', {
        describe: 'Emit machine-readable JSON report',
        type: 'boolean',
        default: false,
      }),
  handler: async (argv) => {
    const args = argv as unknown as ConfigCommandArgs;
    if (args.action !== 'explain') {
      console.log('Usage: papert config explain [key] [--json]');
      return;
    }

    const loadedSettings = loadSettings(process.cwd());
    const entries = buildConfigExplainEntries(
      loadedSettings as unknown as LoadedSettingsLike,
      args.key,
    );

    if (args.json) {
      console.log(
        JSON.stringify(
          {
            trustedWorkspace: loadedSettings.isTrusted,
            keyFilter: args.key ?? null,
            entries,
          },
          null,
          2,
        ),
      );
      return;
    }

    printExplainReport(
      loadedSettings as unknown as LoadedSettingsLike,
      entries,
      args.key,
    );
  },
};
