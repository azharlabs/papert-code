/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

interface SettingsAuth {
  apiKey?: string;
  baseUrl?: string;
}

interface SettingsModel {
  name?: string;
}

interface TerminalBenchSettings {
  security?: {
    auth?: SettingsAuth;
  };
  model?: SettingsModel;
}

interface ConfigSource {
  apiKey: 'env' | 'workspace' | 'user' | 'none';
  baseUrl: 'env' | 'workspace' | 'user' | 'none';
  model: 'env' | 'workspace' | 'user' | 'none';
}

export interface TerminalBenchOpenAiConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  source: ConfigSource;
}

interface ResolveOptions {
  cwd?: string;
  homeDir?: string;
  env?: NodeJS.ProcessEnv;
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function expandEnvReference(
  value: string | undefined,
  env: NodeJS.ProcessEnv,
): string | undefined {
  if (!value) {
    return undefined;
  }
  if (value.startsWith('$') && value.length > 1) {
    const varName = value.slice(1);
    return normalizeString(env[varName]);
  }
  return value;
}

function loadSettingsFile(settingsPath: string): TerminalBenchSettings {
  if (!existsSync(settingsPath)) {
    return {};
  }

  try {
    const raw = readFileSync(settingsPath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') {
      return parsed as TerminalBenchSettings;
    }
    return {};
  } catch {
    return {};
  }
}

export function resolveTerminalBenchOpenAiConfig(
  options: ResolveOptions = {},
): TerminalBenchOpenAiConfig {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const home = options.homeDir ?? homedir();

  const workspaceSettingsPath = join(cwd, '.papert', 'settings.json');
  const userSettingsPath = join(home, '.papert', 'settings.json');
  const workspaceSettings = loadSettingsFile(workspaceSettingsPath);
  const userSettings = loadSettingsFile(userSettingsPath);

  const envApiKey = normalizeString(env['OPENAI_API_KEY']);
  const envBaseUrl = normalizeString(env['OPENAI_BASE_URL']);
  const envModel = normalizeString(env['OPENAI_MODEL']);

  const workspaceApiKey = expandEnvReference(
    normalizeString(workspaceSettings.security?.auth?.apiKey),
    env,
  );
  const workspaceBaseUrl = expandEnvReference(
    normalizeString(workspaceSettings.security?.auth?.baseUrl),
    env,
  );
  const workspaceModel = expandEnvReference(
    normalizeString(workspaceSettings.model?.name),
    env,
  );

  const userApiKey = expandEnvReference(
    normalizeString(userSettings.security?.auth?.apiKey),
    env,
  );
  const userBaseUrl = expandEnvReference(
    normalizeString(userSettings.security?.auth?.baseUrl),
    env,
  );
  const userModel = expandEnvReference(
    normalizeString(userSettings.model?.name),
    env,
  );

  const apiKey = envApiKey ?? workspaceApiKey ?? userApiKey;
  const baseUrl = envBaseUrl ?? workspaceBaseUrl ?? userBaseUrl;
  const model = envModel ?? workspaceModel ?? userModel;

  return {
    apiKey,
    baseUrl,
    model,
    source: {
      apiKey: envApiKey
        ? 'env'
        : workspaceApiKey
          ? 'workspace'
          : userApiKey
            ? 'user'
            : 'none',
      baseUrl: envBaseUrl
        ? 'env'
        : workspaceBaseUrl
          ? 'workspace'
          : userBaseUrl
            ? 'user'
            : 'none',
      model: envModel
        ? 'env'
        : workspaceModel
          ? 'workspace'
          : userModel
            ? 'user'
            : 'none',
    },
  };
}

