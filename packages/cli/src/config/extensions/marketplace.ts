/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ExtensionInstallMetadata } from '@papert-code/papert-code-core';
import * as fs from 'node:fs';
import { stat } from 'node:fs/promises';
import * as path from 'node:path';
import * as https from 'node:https';
import prompts from 'prompts';
import chalk from 'chalk';
import { cloneFromGit, downloadFromGitHubRelease } from './github.js';

const PAPERT_EXTENSION_CONFIG = 'papert-extension.json';
const GEMINI_EXTENSION_CONFIG = 'gemini-extension.json';

export interface ClaudeMarketplacePluginSource {
  source?: 'github' | 'url';
  repo?: string;
  url?: string;
}

export interface ClaudeMarketplacePluginConfig {
  name: string;
  version?: string;
  description?: string;
  author?: unknown;
  homepage?: string;
  repository?: string;
  license?: string;
  keywords?: string[];
  commands?: unknown;
  agents?: unknown;
  skills?: unknown;
  hooks?: unknown;
  mcpServers?: unknown;
  outputStyles?: unknown;
  lspServers?: unknown;
  source: string | ClaudeMarketplacePluginSource;
}

export interface ClaudeMarketplaceConfig {
  name: string;
  owner: { name?: string; email?: string };
  plugins: ClaudeMarketplacePluginConfig[];
}

const isGitUrl = (source: string): boolean =>
  source.startsWith('http://') ||
  source.startsWith('https://') ||
  source.startsWith('git@') ||
  source.startsWith('sso://');

function parseSourceAndPluginName(source: string): {
  repo: string;
  pluginName?: string;
} {
  const urlSchemes = ['http://', 'https://', 'git@', 'sso://'];

  let repoEndIndex = source.length;
  let hasPluginName = false;

  for (const scheme of urlSchemes) {
    if (source.startsWith(scheme)) {
      const afterScheme = source.substring(scheme.length);
      const lastColonIndex = afterScheme.lastIndexOf(':');
      if (lastColonIndex !== -1) {
        const potentialPluginName = afterScheme.substring(lastColonIndex + 1);
        if (
          potentialPluginName &&
          !potentialPluginName.includes('/') &&
          !/^\d+/.test(potentialPluginName)
        ) {
          repoEndIndex = scheme.length + lastColonIndex;
          hasPluginName = true;
        }
      }
      break;
    }
  }

  if (
    repoEndIndex === source.length &&
    !urlSchemes.some((scheme) => source.startsWith(scheme))
  ) {
    const lastColonIndex = source.lastIndexOf(':');
    if (lastColonIndex > 1) {
      repoEndIndex = lastColonIndex;
      hasPluginName = true;
    }
  }

  if (hasPluginName) {
    return {
      repo: source.substring(0, repoEndIndex),
      pluginName: source.substring(repoEndIndex + 1),
    };
  }

  return { repo: source };
}

function isOwnerRepoFormat(source: string): boolean {
  const ownerRepoRegex = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
  return ownerRepoRegex.test(source);
}

function convertOwnerRepoToGitHubUrl(ownerRepo: string): string {
  return `https://github.com/${ownerRepo}`;
}

function fetchUrl(
  url: string,
  headers: Record<string, string>,
): Promise<string | null> {
  return new Promise((resolve) => {
    https
      .get(url, { headers }, (res) => {
        if (res.statusCode !== 200) {
          resolve(null);
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks).toString()));
      })
      .on('error', () => resolve(null));
  });
}

async function fetchGitHubMarketplaceConfig(
  owner: string,
  repo: string,
): Promise<ClaudeMarketplaceConfig | null> {
  const token = process.env['GITHUB_TOKEN'];

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/.claude-plugin/marketplace.json`;
  const apiHeaders: Record<string, string> = {
    'User-Agent': 'papert-code',
    Accept: 'application/vnd.github.v3.raw',
  };
  if (token) {
    apiHeaders['Authorization'] = `token ${token}`;
  }

  let content = await fetchUrl(apiUrl, apiHeaders);
  if (!content) {
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/.claude-plugin/marketplace.json`;
    content = await fetchUrl(rawUrl, { 'User-Agent': 'papert-code' });
  }
  if (!content) {
    return null;
  }

  try {
    return JSON.parse(content) as ClaudeMarketplaceConfig;
  } catch {
    return null;
  }
}

async function readLocalMarketplaceConfig(
  localPath: string,
): Promise<ClaudeMarketplaceConfig | null> {
  const configPath = path.join(localPath, '.claude-plugin', 'marketplace.json');
  try {
    const content = await fs.promises.readFile(configPath, 'utf-8');
    return JSON.parse(content) as ClaudeMarketplaceConfig;
  } catch {
    return null;
  }
}

export async function parseInstallSource(
  source: string,
): Promise<ExtensionInstallMetadata> {
  const { repo, pluginName } = parseSourceAndPluginName(source);

  let repoSource = repo;
  let installMetadata: ExtensionInstallMetadata;
  let marketplaceConfig: ClaudeMarketplaceConfig | null = null;

  if (isGitUrl(repo)) {
    installMetadata = { source: repoSource, type: 'git', pluginName };
    const match = repoSource.match(/github\.com[/:]([^/]+)\/([^/.]+)(?:\.git)?/);
    if (match) {
      marketplaceConfig = await fetchGitHubMarketplaceConfig(match[1], match[2]);
    }
  } else if (isOwnerRepoFormat(repo)) {
    repoSource = convertOwnerRepoToGitHubUrl(repo);
    installMetadata = { source: repoSource, type: 'git', pluginName };
    const [owner, repoName] = repo.split('/');
    marketplaceConfig = await fetchGitHubMarketplaceConfig(owner, repoName);
  } else {
    await stat(repo).catch(() => {
      throw new Error('Install source not found.');
    });
    installMetadata = { source: repo, type: 'local', pluginName };
    marketplaceConfig = await readLocalMarketplaceConfig(repo);
  }

  if (marketplaceConfig) {
    installMetadata.type = 'marketplace';
    installMetadata.marketplaceConfig = marketplaceConfig;
    installMetadata.originSource = 'Claude';
  }

  return installMetadata;
}

export async function requestChoicePluginNonInteractive(
  marketplace: ClaudeMarketplaceConfig,
): Promise<string> {
  if (marketplace.plugins.length === 0) {
    throw new Error('No plugins available in this marketplace.');
  }

  const response = await prompts({
    type: 'select',
    name: 'plugin',
    message: `Select a plugin to install from marketplace "${marketplace.name}":`,
    choices: marketplace.plugins.map((plugin) => ({
      title: chalk.green(chalk.bold(`[${plugin.name}]`)),
      value: plugin.name,
    })),
    initial: 0,
  });

  if (response.plugin === undefined) {
    throw new Error('Plugin selection cancelled.');
  }

  return response.plugin as string;
}

function readPluginConfig(pluginDir: string): Record<string, unknown> | null {
  const candidatePaths = [
    path.join(pluginDir, '.claude-plugin', 'plugin.json'),
    path.join(pluginDir, 'plugin.json'),
  ];
  for (const candidate of candidatePaths) {
    try {
      const content = fs.readFileSync(candidate, 'utf-8');
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      // keep trying
    }
  }
  return null;
}

function mergeExtensionConfig(
  plugin: ClaudeMarketplacePluginConfig,
  pluginConfig: Record<string, unknown> | null,
): Record<string, unknown> {
  const base = (pluginConfig ?? {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = {
    ...base,
    name: plugin.name ?? base['name'],
    version: plugin.version ?? (base['version'] as string | undefined) ?? '1.0.0',
    description: plugin.description ?? base['description'],
    author: plugin.author ?? base['author'],
    homepage: plugin.homepage ?? base['homepage'],
    repository: plugin.repository ?? base['repository'],
    license: plugin.license ?? base['license'],
    keywords: plugin.keywords ?? base['keywords'],
    commands: plugin.commands ?? base['commands'],
    agents: plugin.agents ?? base['agents'],
    skills: plugin.skills ?? base['skills'],
    hooks: plugin.hooks ?? base['hooks'],
    mcpServers: plugin.mcpServers ?? base['mcpServers'],
    outputStyles: plugin.outputStyles ?? base['outputStyles'],
    lspServers: plugin.lspServers ?? base['lspServers'],
  };

  if (!merged['name']) {
    throw new Error('Unable to derive extension name from marketplace plugin.');
  }
  if (!merged['version']) {
    merged['version'] = '1.0.0';
  }

  return merged;
}

async function materializeRemoteSource(
  source: string,
  destination: string,
): Promise<void> {
  const metadata: ExtensionInstallMetadata = { source, type: 'git' };
  try {
    const result = await downloadFromGitHubRelease(metadata, destination);
    metadata.type = result.type;
    metadata.releaseTag = result.tagName;
  } catch {
    await cloneFromGit(metadata, destination);
  }
}

async function resolvePluginSourcePath(
  plugin: ClaudeMarketplacePluginConfig,
  marketplaceDir: string,
): Promise<string> {
  const source = plugin.source;
  if (typeof source === 'string') {
    if (!source || source === '.') {
      return marketplaceDir;
    }
    if (isGitUrl(source) || isOwnerRepoFormat(source)) {
      const remoteDir = await fs.promises.mkdtemp(
        path.join(marketplaceDir, '.plugin-source-'),
      );
      const normalized = isOwnerRepoFormat(source)
        ? convertOwnerRepoToGitHubUrl(source)
        : source;
      await materializeRemoteSource(normalized, remoteDir);
      return remoteDir;
    }
    return path.resolve(marketplaceDir, source);
  }

  if (source && typeof source === 'object') {
    let resolvedSource: string | undefined;
    if (source.source === 'github' && source.repo) {
      resolvedSource = convertOwnerRepoToGitHubUrl(source.repo);
    } else if (source.source === 'url' && source.url) {
      resolvedSource = source.url;
    }
    if (!resolvedSource) {
      throw new Error(
        `Unsupported marketplace plugin source for "${plugin.name}".`,
      );
    }
    const remoteDir = await fs.promises.mkdtemp(
      path.join(marketplaceDir, '.plugin-source-'),
    );
    await materializeRemoteSource(resolvedSource, remoteDir);
    return remoteDir;
  }

  throw new Error(`Unsupported plugin source for "${plugin.name}".`);
}

export async function prepareMarketplaceExtensionSource(
  marketplaceDir: string,
  installMetadata: ExtensionInstallMetadata,
): Promise<string> {
  const config = installMetadata.marketplaceConfig as
    | ClaudeMarketplaceConfig
    | undefined;
  if (!config) {
    throw new Error('Marketplace config missing for marketplace installation.');
  }
  if (!installMetadata.pluginName) {
    throw new Error(
      'Plugin name is required for marketplace installation.',
    );
  }

  const plugin = config.plugins.find((p) => p.name === installMetadata.pluginName);
  if (!plugin) {
    throw new Error(
      `Plugin "${installMetadata.pluginName}" not found in marketplace "${config.name}".`,
    );
  }

  const pluginSourcePath = await resolvePluginSourcePath(plugin, marketplaceDir);
  if (!fs.existsSync(pluginSourcePath)) {
    throw new Error(`Plugin source not found at ${pluginSourcePath}`);
  }

  const papertConfigPath = path.join(pluginSourcePath, PAPERT_EXTENSION_CONFIG);
  const geminiConfigPath = path.join(pluginSourcePath, GEMINI_EXTENSION_CONFIG);
  if (fs.existsSync(papertConfigPath) || fs.existsSync(geminiConfigPath)) {
    return pluginSourcePath;
  }

  const pluginConfig = readPluginConfig(pluginSourcePath);
  const mergedConfig = mergeExtensionConfig(plugin, pluginConfig);
  await fs.promises.writeFile(
    papertConfigPath,
    JSON.stringify(mergedConfig, null, 2),
    'utf-8',
  );
  return pluginSourcePath;
}
