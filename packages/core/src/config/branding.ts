/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';

export interface BrandConfig {
  cliName: string;
  appName: string;
  configDirName: string;
  ignoreFileName: string;
  contextFileName: string;
  extensionConfigFileName: string;
  extensionSettingsFileName: string;
  extensionInstallMetadataFileName: string;
  a2aServerCommand: string;
  projectSummaryRelativePath: string;
}

function sanitizeCliName(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return 'papert';
  }

  const sanitized = normalized.replace(/[^a-z0-9-]/g, '');
  return sanitized || 'papert';
}

function titleCaseCliName(cliName: string): string {
  return cliName
    .split(/[-_ ]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(' ');
}

export function getBrandConfig(
  env: NodeJS.ProcessEnv = process.env,
): BrandConfig {
  const cliName = sanitizeCliName(env['PAPERT_CLI_NAME']);
  const configDirName = env['PAPERT_CONFIG_DIR']?.trim() || `.${cliName}`;
  const ignoreFileName =
    env['PAPERT_IGNORE_FILE']?.trim() || `.${cliName}ignore`;
  const contextFileName =
    env['PAPERT_CONTEXT_FILE']?.trim() || `${cliName}.md`;
  const extensionConfigFileName =
    env['PAPERT_EXTENSION_CONFIG_FILE']?.trim() ||
    `${cliName}-extension.json`;
  const extensionSettingsFileName =
    env['PAPERT_EXTENSION_SETTINGS_FILE']?.trim() ||
    `.${cliName}-extension-settings.json`;
  const extensionInstallMetadataFileName =
    env['PAPERT_EXTENSION_INSTALL_METADATA_FILE']?.trim() ||
    `.${cliName}-extension-install.json`;
  const appName =
    env['PAPERT_APP_NAME']?.trim() || `${titleCaseCliName(cliName)} Code`;
  const a2aServerCommand =
    env['PAPERT_A2A_SERVER_COMMAND']?.trim() || `${cliName}-a2a-server`;

  return {
    cliName,
    appName,
    configDirName,
    ignoreFileName,
    contextFileName,
    extensionConfigFileName,
    extensionSettingsFileName,
    extensionInstallMetadataFileName,
    a2aServerCommand,
    projectSummaryRelativePath: path.join(configDirName, 'PROJECT_SUMMARY.md'),
  };
}
