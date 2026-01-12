/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

// Copied from packages/cli/src/config/extension.ts, trimmed for server usage.

import {
  type MCPServerConfig,
  type ExtensionInstallMetadata,
  type GeminiCLIExtension,
  getCurrentGeminiMdFilename,
  PAPERT_DIR,
} from '@papert-code/papert-code-core';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { logger } from '../utils/logger.js';

export const EXTENSIONS_DIRECTORY_NAME = path.join(PAPERT_DIR, 'extensions');
export const EXTENSION_CONFIG_FILENAMES = [
  'papert-extension.json',
  'gemini-extension.json',
];
export const PRIMARY_EXTENSION_CONFIG_FILENAME = EXTENSION_CONFIG_FILENAMES[0];
export const INSTALL_METADATA_FILENAME = '.papert-extension-install.json';

/**
 * Extension definition as written to disk in extension config files.
 * This should *not* be referenced outside of the logic for reading files.
 * If information is required for manipulating extensions (load, unload, update)
 * outside of the loading process that data needs to be stored on the
 * GeminiCLIExtension class defined in Core.
 */
interface ExtensionConfig {
  name: string;
  version: string;
  mcpServers?: Record<string, MCPServerConfig>;
  contextFileName?: string | string[];
  excludeTools?: string[];
}

export interface PapertCLIExtension extends GeminiCLIExtension {
  contextFiles?: string[];
}

export function loadExtensions(workspaceDir: string): PapertCLIExtension[] {
  const allExtensions = [
    ...loadExtensionsFromDir(workspaceDir),
    ...loadExtensionsFromDir(os.homedir()),
  ];

  const uniqueExtensions: PapertCLIExtension[] = [];
  const seenNames = new Set<string>();
  for (const extension of allExtensions) {
    if (!seenNames.has(extension.name)) {
      logger.info(
        `Loading extension: ${extension.name} (version: ${extension.version})`,
      );
      uniqueExtensions.push(extension);
      seenNames.add(extension.name);
    }
  }

  return uniqueExtensions;
}

function loadExtensionsFromDir(dir: string): GeminiCLIExtension[] {
  const extensionsDir = path.join(dir, EXTENSIONS_DIRECTORY_NAME);
  if (!fs.existsSync(extensionsDir)) {
    return [];
  }

  const extensions: GeminiCLIExtension[] = [];
  for (const subdir of fs.readdirSync(extensionsDir)) {
    const extensionDir = path.join(extensionsDir, subdir);

    const extension = loadExtension(extensionDir);
    if (extension != null) {
      extensions.push(extension);
    }
  }
  return extensions;
}

function loadExtension(extensionDir: string): PapertCLIExtension | null {
  if (!fs.statSync(extensionDir).isDirectory()) {
    logger.error(
      `Warning: unexpected file ${extensionDir} in extensions directory.`,
    );
    return null;
  }

  const configFilePath = EXTENSION_CONFIG_FILENAMES.map((name) =>
    path.join(extensionDir, name),
  ).find((candidate) => fs.existsSync(candidate));
  if (!configFilePath) {
    logger.error(
      `Warning: extension directory ${extensionDir} does not contain a config file.`,
    );
    return null;
  }

  try {
    const configContent = fs.readFileSync(configFilePath, 'utf-8');
    const config = JSON.parse(configContent) as ExtensionConfig;
    if (!config.name || !config.version) {
      logger.error(
        `Invalid extension config in ${configFilePath}: missing name or version.`,
      );
      return null;
    }

    const installMetadata = loadInstallMetadata(extensionDir);

    const contextFiles = getContextFileNames(config)
      .map((contextFileName) => path.join(extensionDir, contextFileName))
      .filter((contextFilePath) => fs.existsSync(contextFilePath));

    return {
      name: config.name,
      version: config.version,
      path: extensionDir,
      contextFiles,
      installMetadata,
      mcpServers: config.mcpServers,
      excludeTools: config.excludeTools,
      isActive: true, // Barring any other signals extensions should be considered Active.
    } as PapertCLIExtension;
  } catch (e) {
    logger.error(
      `Warning: error parsing extension config in ${configFilePath}: ${e}`,
    );
    return null;
  }
}

function getContextFileNames(config: ExtensionConfig): string[] {
  if (!config.contextFileName) {
    return [getCurrentGeminiMdFilename()];
  } else if (!Array.isArray(config.contextFileName)) {
    return [config.contextFileName];
  }
  return config.contextFileName;
}

export function loadInstallMetadata(
  extensionDir: string,
): ExtensionInstallMetadata | undefined {
  const metadataFilePath = path.join(extensionDir, INSTALL_METADATA_FILENAME);
  try {
    const configContent = fs.readFileSync(metadataFilePath, 'utf-8');
    const metadata = JSON.parse(configContent) as ExtensionInstallMetadata;
    return metadata;
  } catch (e) {
    logger.warn(
      `Failed to load or parse extension install metadata at ${metadataFilePath}: ${e}`,
    );
    return undefined;
  }
}
