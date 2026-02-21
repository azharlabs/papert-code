/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { homedir } from 'node:os';

import type { MCPServerConfig } from '@papert-code/papert-code-core';

import {
  debugLogger,
  PAPERT_DIR,
  getErrorMessage,
  type TelemetrySettings,
} from '@papert-code/papert-code-core';
import stripJsonComments from 'strip-json-comments';

export const USER_SETTINGS_DIR = path.join(homedir(), PAPERT_DIR);
export const USER_SETTINGS_PATH = path.join(USER_SETTINGS_DIR, 'settings.json');

type JsonRecord = Record<string, unknown>;

export interface FileFilteringSettings {
  respectGitIgnore?: boolean;
  respectPapertIgnore?: boolean;
  enableRecursiveFileSearch?: boolean;
  customIgnoreFilePaths?: string[];
}

export interface GeneralSettings extends JsonRecord {
  checkpointing?: CheckpointingSettings;
}

export interface ToolsSettings extends JsonRecord {
  core?: string[];
  exclude?: string[];
}

export interface UISettings extends JsonRecord {
  showMemoryUsage?: boolean;
}

export interface ContextSettings extends JsonRecord {
  fileFiltering?: FileFilteringSettings;
}

export interface MCPSettings extends JsonRecord {
  servers?: Record<string, MCPServerConfig>;
}

export interface Settings {
  model?: JsonRecord & {
    name?: string;
  };
  mcpServers?: Record<string, MCPServerConfig>;
  mcp?: MCPSettings;
  tools?: ToolsSettings;
  coreTools?: string[];
  excludeTools?: string[];
  telemetry?: TelemetrySettings;
  ui?: UISettings;
  showMemoryUsage?: boolean;
  general?: GeneralSettings;
  checkpointing?: CheckpointingSettings;
  context?: ContextSettings;
  fileFiltering?: FileFilteringSettings;
  folderTrust?: boolean;
  security?: SecuritySettings;
  [key: string]: unknown;
}

export interface SecuritySettings extends JsonRecord {
  folderTrust?: {
    enabled?: boolean;
  };
  auth?: {
    selectedType?: string;
    enforcedType?: string;
    useExternal?: boolean;
    apiKey?: string;
    baseUrl?: string;
  };
}

export interface SettingsError {
  message: string;
  path: string;
}

export interface CheckpointingSettings {
  enabled?: boolean;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const stringValues = value.filter(
    (entry): entry is string => typeof entry === 'string',
  );
  return stringValues.length > 0 ? stringValues : [];
}

function normalizeCheckpointing(
  value: unknown,
): CheckpointingSettings | undefined {
  if (typeof value === 'boolean') {
    return { enabled: value };
  }
  if (!isRecord(value)) {
    return undefined;
  }
  if (typeof value['enabled'] === 'boolean') {
    return { enabled: value['enabled'] };
  }
  return undefined;
}

function normalizeFileFiltering(
  value: unknown,
): FileFilteringSettings | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const normalized: FileFilteringSettings = {};
  if (typeof value['respectGitIgnore'] === 'boolean') {
    normalized.respectGitIgnore = value['respectGitIgnore'];
  }
  if (typeof value['respectPapertIgnore'] === 'boolean') {
    normalized.respectPapertIgnore = value['respectPapertIgnore'];
  }
  if (typeof value['enableRecursiveFileSearch'] === 'boolean') {
    normalized.enableRecursiveFileSearch = value['enableRecursiveFileSearch'];
  }

  const customIgnoreFilePaths = asStringArray(value['customIgnoreFilePaths']);
  if (customIgnoreFilePaths) {
    normalized.customIgnoreFilePaths = customIgnoreFilePaths;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeMcpServers(
  value: unknown,
): Record<string, MCPServerConfig> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  return value as Record<string, MCPServerConfig>;
}

function normalizeSettings(rawSettings: unknown): Settings {
  if (!isRecord(rawSettings)) {
    return {};
  }

  const normalized = structuredClone(rawSettings) as Settings;

  const modelRecord = isRecord(rawSettings['model']) ? rawSettings['model'] : {};
  const modelName = asString(rawSettings['model']) ?? asString(modelRecord['name']);
  if (modelName) {
    normalized.model = {
      ...(isRecord(normalized.model) ? normalized.model : {}),
      name: modelName,
    };
  }

  const tools = isRecord(rawSettings['tools']) ? rawSettings['tools'] : undefined;
  const coreTools = asStringArray(rawSettings['coreTools']) ?? asStringArray(tools?.['core']);
  if (coreTools) {
    normalized.coreTools = coreTools;
  }
  const excludeTools =
    asStringArray(rawSettings['excludeTools']) ??
    asStringArray(tools?.['exclude']);
  if (excludeTools) {
    normalized.excludeTools = excludeTools;
  }

  const ui = isRecord(rawSettings['ui']) ? rawSettings['ui'] : undefined;
  const showMemoryUsage =
    typeof rawSettings['showMemoryUsage'] === 'boolean'
      ? rawSettings['showMemoryUsage']
      : typeof ui?.['showMemoryUsage'] === 'boolean'
        ? ui['showMemoryUsage']
        : undefined;
  if (showMemoryUsage !== undefined) {
    normalized.showMemoryUsage = showMemoryUsage;
  }

  const general = isRecord(rawSettings['general'])
    ? rawSettings['general']
    : undefined;
  const checkpointing =
    normalizeCheckpointing(rawSettings['checkpointing']) ??
    normalizeCheckpointing(general?.['checkpointing']);
  if (checkpointing) {
    normalized.checkpointing = checkpointing;
  }

  const context = isRecord(rawSettings['context'])
    ? rawSettings['context']
    : undefined;
  const fileFiltering =
    normalizeFileFiltering(rawSettings['fileFiltering']) ??
    normalizeFileFiltering(context?.['fileFiltering']);
  if (fileFiltering) {
    normalized.fileFiltering = fileFiltering;
  }

  const security = isRecord(rawSettings['security'])
    ? rawSettings['security']
    : undefined;
  const securityFolderTrust = isRecord(security?.['folderTrust'])
    ? security['folderTrust']
    : undefined;
  const folderTrust =
    (typeof rawSettings['folderTrust'] === 'boolean'
      ? rawSettings['folderTrust']
      : undefined) ??
    (typeof securityFolderTrust?.['enabled'] === 'boolean'
      ? securityFolderTrust['enabled']
      : undefined);
  if (folderTrust !== undefined) {
    normalized.folderTrust = folderTrust;
    normalized.security = {
      ...(isRecord(normalized.security) ? normalized.security : {}),
      folderTrust: {
        ...(isRecord((normalized.security as SecuritySettings | undefined)?.folderTrust)
          ? (normalized.security as SecuritySettings).folderTrust
          : {}),
        enabled: folderTrust,
      },
    };
  }

  const legacySelectedAuthType = asString(rawSettings['selectedAuthType']);
  const legacyEnforcedAuthType = asString(rawSettings['enforcedAuthType']);
  const legacyUseExternalAuth =
    typeof rawSettings['useExternalAuth'] === 'boolean'
      ? rawSettings['useExternalAuth']
      : undefined;
  if (
    legacySelectedAuthType ||
    legacyEnforcedAuthType ||
    legacyUseExternalAuth !== undefined
  ) {
    normalized.security = {
      ...(isRecord(normalized.security) ? normalized.security : {}),
      auth: {
        ...(isRecord((normalized.security as SecuritySettings | undefined)?.auth)
          ? (normalized.security as SecuritySettings).auth
          : {}),
        ...(legacySelectedAuthType
          ? { selectedType: legacySelectedAuthType }
          : {}),
        ...(legacyEnforcedAuthType
          ? { enforcedType: legacyEnforcedAuthType }
          : {}),
        ...(legacyUseExternalAuth !== undefined
          ? { useExternal: legacyUseExternalAuth }
          : {}),
      },
    };
  }

  const mcp = isRecord(rawSettings['mcp']) ? rawSettings['mcp'] : undefined;
  const mcpServers =
    normalizeMcpServers(rawSettings['mcpServers']) ??
    normalizeMcpServers(mcp?.['servers']);
  if (mcpServers) {
    normalized.mcpServers = mcpServers;
  }

  return normalized;
}

function deepMerge(base: unknown, override: unknown): unknown {
  if (override === undefined) {
    return base;
  }
  if (Array.isArray(override)) {
    return [...override];
  }
  if (isRecord(base) && isRecord(override)) {
    const merged: JsonRecord = { ...base };
    for (const [key, overrideValue] of Object.entries(override)) {
      if (overrideValue === undefined) {
        continue;
      }
      merged[key] = deepMerge(base[key], overrideValue);
    }
    return merged;
  }
  return override;
}

/**
 * Loads settings from user and workspace directories.
 * Project settings override user settings.
 *
 * How is it different to papert-code/cli: Returns already merged settings rather
 * than `LoadedSettings` (unnecessary since we are not modifying users
 * settings.json).
 */
export function loadSettings(workspaceDir: string): Settings {
  let userSettings: Settings = {};
  let workspaceSettings: Settings = {};
  const settingsErrors: SettingsError[] = [];

  const loadAndNormalizeSettingsFile = (settingsPath: string): Settings => {
    const content = fs.readFileSync(settingsPath, 'utf-8');
    const parsedSettings = JSON.parse(stripJsonComments(content)) as unknown;
    if (!isRecord(parsedSettings)) {
      throw new Error('Settings file must contain a top-level JSON object.');
    }
    const envResolvedSettings = resolveEnvVarsInObject(parsedSettings);
    return normalizeSettings(envResolvedSettings);
  };

  // Load user settings
  try {
    if (fs.existsSync(USER_SETTINGS_PATH)) {
      userSettings = loadAndNormalizeSettingsFile(USER_SETTINGS_PATH);
    }
  } catch (error: unknown) {
    settingsErrors.push({
      message: getErrorMessage(error),
      path: USER_SETTINGS_PATH,
    });
  }

  const workspaceSettingsPath = path.join(
    workspaceDir,
    PAPERT_DIR,
    'settings.json',
  );

  // Load workspace settings
  try {
    if (fs.existsSync(workspaceSettingsPath)) {
      workspaceSettings = loadAndNormalizeSettingsFile(workspaceSettingsPath);
    }
  } catch (error: unknown) {
    settingsErrors.push({
      message: getErrorMessage(error),
      path: workspaceSettingsPath,
    });
  }

  if (settingsErrors.length > 0) {
    debugLogger.error('Errors loading settings:');
    for (const error of settingsErrors) {
      debugLogger.error(`  Path: ${error.path}`);
      debugLogger.error(`  Message: ${error.message}`);
    }
  }

  // Merge nested settings deeply to preserve V2 container fields while still
  // letting workspace values override user values.
  return deepMerge(userSettings, workspaceSettings) as Settings;
}

function resolveEnvVarsInString(value: string): string {
  const envVarRegex = /\$(?:(\w+)|{([^}]+)})/g; // Find $VAR_NAME or ${VAR_NAME}
  return value.replace(envVarRegex, (match, varName1, varName2) => {
    const varName = varName1 || varName2;
    if (process && process.env && typeof process.env[varName] === 'string') {
      return process.env[varName];
    }
    return match;
  });
}

function resolveEnvVarsInObject<T>(obj: T): T {
  if (
    obj === null ||
    obj === undefined ||
    typeof obj === 'boolean' ||
    typeof obj === 'number'
  ) {
    return obj;
  }

  if (typeof obj === 'string') {
    return resolveEnvVarsInString(obj) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => resolveEnvVarsInObject(item)) as unknown as T;
  }

  if (typeof obj === 'object') {
    const newObj = { ...obj } as T;
    for (const key in newObj) {
      if (Object.prototype.hasOwnProperty.call(newObj, key)) {
        newObj[key] = resolveEnvVarsInObject(newObj[key]);
      }
    }
    return newObj;
  }

  return obj;
}
