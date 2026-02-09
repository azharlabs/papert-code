/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { homedir } from 'node:os';
import * as dotenv from 'dotenv';

import type {
  ContentGeneratorConfig,
  TelemetryTarget,
} from '@papert-code/papert-code-core';
import {
  AuthType,
  Config,
  type ConfigParameters,
  FileDiscoveryService,
  ApprovalMode,
  GitService,
  loadServerHierarchicalMemory,
  PAPERT_DIR,
  DEFAULT_PAPERT_EMBEDDING_MODEL,
  DEFAULT_PAPERT_MODEL,
} from '@papert-code/papert-code-core';

import { logger } from '../utils/logger.js';
import type { Settings } from './settings.js';
import { type AgentSettings, CoderAgentEvent } from '../types.js';
import type { PapertCLIExtension } from './extension.js';

const OPENAI_API_KEY_ENV = 'OPENAI_API_KEY';
const OPENAI_BASE_URL_ENV = 'OPENAI_BASE_URL';
const PAPERT_OAUTH_ENV = 'PAPERT_OAUTH';
const GEMINI_API_KEY_ENV = 'GEMINI_API_KEY';

export async function loadConfig(
  settings: Settings,
  extensions: PapertCLIExtension[],
  taskId: string,
): Promise<Config> {
  const workspaceDir = process.cwd();
  const adcFilePath = process.env['GOOGLE_APPLICATION_CREDENTIALS'];
  const extensionContextFilePaths = extensions.flatMap(
    (extension) => extension.contextFiles ?? [],
  );

  const authSettings = settings.security?.auth;
  const resolvedAuthType =
    parseAuthType(authSettings?.enforcedType) ??
    parseAuthType(authSettings?.selectedType) ??
    getPreferredAuthType();
  if (!resolvedAuthType) {
    const errorMessage =
      '[Config] Unable to set GeneratorConfig. Please provide PAPERT_OAUTH, OPENAI_API_KEY, GEMINI_API_KEY, or set USE_CCPA.';
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  const openAiApiKey =
    authSettings?.apiKey ??
    process.env[OPENAI_API_KEY_ENV] ??
    undefined;
  const openAiBaseUrl =
    authSettings?.baseUrl ??
    process.env[OPENAI_BASE_URL_ENV] ??
    undefined;
  const resolvedModel =
    process.env['OPENAI_MODEL'] ??
    process.env['PAPERT_MODEL'] ??
    settings.model?.name ??
    DEFAULT_PAPERT_MODEL;

  if (resolvedAuthType === AuthType.USE_OPENAI && !openAiApiKey) {
    const errorMessage =
      '[Config] OPENAI_API_KEY environment variable or settings entry is required for OpenAI auth.';
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  const generationConfig: Partial<ContentGeneratorConfig> = {};
  if (openAiApiKey) {
    generationConfig.apiKey = openAiApiKey;
  }
  if (openAiBaseUrl) {
    generationConfig.baseUrl = openAiBaseUrl;
  }

  let checkpointing = process.env['CHECKPOINTING']
    ? process.env['CHECKPOINTING'] === 'true'
    : settings.checkpointing?.enabled;
  const gitServiceClass = GitService as unknown as {
    verifyGitAvailability?: () => Promise<boolean>;
  };
  const gitIsAvailable = gitServiceClass.verifyGitAvailability
    ? await gitServiceClass.verifyGitAvailability()
    : true;
  if (checkpointing && !gitIsAvailable) {
    logger.warn(
      '[Config] Checkpointing is enabled but git is not installed. Disabling checkpointing.',
    );
    checkpointing = false;
  }

  const configParams: ConfigParameters = {
    sessionId: taskId,
    model: resolvedModel,
    embeddingModel: DEFAULT_PAPERT_EMBEDDING_MODEL,
    sandbox: undefined, // Sandbox might not be relevant for a server-side agent
    targetDir: workspaceDir, // Or a specific directory the agent operates on
    debugMode: process.env['DEBUG'] === 'true' || false,
    question: '', // Not used in server mode directly like CLI

    coreTools: settings.coreTools || undefined,
    excludeTools: settings.excludeTools || undefined,
    showMemoryUsage: settings.showMemoryUsage || false,
    approvalMode:
      process.env['PAPERT_YOLO_MODE'] === 'true' ||
        process.env['GEMINI_YOLO_MODE'] === 'true'
        ? ApprovalMode.YOLO
        : ApprovalMode.DEFAULT,
    mcpServers: settings.mcpServers,
    cwd: workspaceDir,
    extensions,
    telemetry: {
      enabled: settings.telemetry?.enabled,
      target: settings.telemetry?.target as TelemetryTarget,
      otlpEndpoint:
        process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ??
        settings.telemetry?.otlpEndpoint,
      logPrompts: settings.telemetry?.logPrompts,
    },
    // Git-aware file filtering settings
    fileFiltering: {
      respectGitIgnore: settings.fileFiltering?.respectGitIgnore,
      enableRecursiveFileSearch:
        settings.fileFiltering?.enableRecursiveFileSearch,
    },
    ideMode: false,
    folderTrust: settings.folderTrust === true,
    extensionContextFilePaths,
    checkpointing,
    authType: resolvedAuthType,
    generationConfig,
    interactive: true,
  };

  const fileService = new FileDiscoveryService(workspaceDir);
  const { memoryContent, fileCount } = await loadServerHierarchicalMemory(
    workspaceDir,
    [workspaceDir],
    false,
    fileService,
    extensionContextFilePaths,
    settings.folderTrust === true,
  );
  configParams.userMemory = memoryContent;
  configParams.geminiMdFileCount = fileCount;
  const config = new Config({
    ...configParams,
  });
  // Needed to initialize ToolRegistry, and git checkpointing if enabled
  await config.initialize();

  logAuthSelection(resolvedAuthType);

  if (process.env['USE_CCPA']) {
    logger.info('[Config] Using CCPA Auth:');
    try {
      if (adcFilePath) {
        path.resolve(adcFilePath);
      }
    } catch (e) {
      logger.error(
        `[Config] USE_CCPA env var is true but unable to resolve GOOGLE_APPLICATION_CREDENTIALS file path ${adcFilePath}. Error ${e}`,
      );
    }
    await config.refreshAuth(AuthType.LOGIN_WITH_GOOGLE);
    logger.info(
      `[Config] GOOGLE_CLOUD_PROJECT: ${process.env['GOOGLE_CLOUD_PROJECT']}`,
    );
  } else {
    await config.refreshAuth(resolvedAuthType);
  }

  return config;
}

export function setTargetDir(agentSettings: AgentSettings | undefined): string {
  const originalCWD = process.cwd();
  const targetDir =
    process.env['CODER_AGENT_WORKSPACE_PATH'] ??
    (agentSettings?.kind === CoderAgentEvent.StateAgentSettingsEvent
      ? agentSettings.workspacePath
      : undefined);

  if (!targetDir) {
    return originalCWD;
  }

  logger.info(
    `[CoderAgentExecutor] Overriding workspace path to: ${targetDir}`,
  );

  try {
    const resolvedPath = path.resolve(targetDir);
    process.chdir(resolvedPath);
    return resolvedPath;
  } catch (e) {
    logger.error(
      `[CoderAgentExecutor] Error resolving workspace path: ${e}, returning original os.cwd()`,
    );
    return originalCWD;
  }
}

export function loadEnvironment(): void {
  // Tests should be hermetic; loading .env files can leak local developer
  // configuration (e.g. remote auth flags) into the test process.
  if (process.env['NODE_ENV'] === 'test') {
    return;
  }

  const envFilePath = findEnvFile(process.cwd());
  if (envFilePath) {
    const runtimeKeys = [
      'CODER_AGENT_PORT',
      'CODER_AGENT_HOST',
      'CODER_AGENT_WORKSPACE_PATH',
      'PAPERT_REMOTE_ENABLED',
      'PAPERT_REMOTE_SERVER_TOKEN',
      'PAPERT_REMOTE_SESSION_TTL_MS',
      'PAPERT_REMOTE_DOCS_ENABLED',
      'PAPERT_WEB_UI_ENABLED',
      'PAPERT_WEB_UI_ALLOW_EMPTY_TOKEN',
      'PAPERT_WEB_UI_DESKTOP_MODE',
      'PAPERT_SHARE_PUBLIC_URL_BASE',
      'OPENAI_API_KEY',
      'OPENAI_BASE_URL',
      'OPENAI_MODEL',
      'PAPERT_MODEL',
      'PAPERT_OAUTH',
      'PAPERT_ADMIN_URL',
      'PAPERT_ADMIN_EMAIL',
      'PAPERT_ADMIN_PASSWORD',
      'PAPERT_ADMIN_TOKEN',
    ] as const;
    const preserved = new Map<string, string>();
    for (const key of runtimeKeys) {
      const value = process.env[key];
      if (typeof value === 'string') {
        preserved.set(key, value);
      }
    }

    const hasRemoteToken =
      typeof process.env['PAPERT_REMOTE_SERVER_TOKEN'] === 'string' &&
      process.env['PAPERT_REMOTE_SERVER_TOKEN']!.trim().length > 0;
    dotenv.config({ path: envFilePath, override: !hasRemoteToken });

    for (const [key, value] of preserved.entries()) {
      process.env[key] = value;
    }
  }
}

function findEnvFile(startDir: string): string | null {
  let currentDir = path.resolve(startDir);
  while (true) {
    // prefer papert-specific .env under PAPERT_DIR
    const papertEnvPath = path.join(currentDir, PAPERT_DIR, '.env');
    if (fs.existsSync(papertEnvPath)) {
      return papertEnvPath;
    }
    const envPath = path.join(currentDir, '.env');
    if (fs.existsSync(envPath)) {
      return envPath;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir || !parentDir) {
      const homePapertEnvPath = path.join(process.cwd(), PAPERT_DIR, '.env');
      if (fs.existsSync(homePapertEnvPath)) {
        return homePapertEnvPath;
      }
      const homeEnvPath = path.join(homedir(), '.env');
      if (fs.existsSync(homeEnvPath)) {
        return homeEnvPath;
      }
      return null;
    }
    currentDir = parentDir;
  }
}

function parseAuthType(value?: string): AuthType | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim();
  const validTypes = Object.values(AuthType);
  if (validTypes.includes(normalized as AuthType)) {
    return normalized as AuthType;
  }
  return undefined;
}

function getPreferredAuthType(): AuthType | undefined {
  if (process.env[PAPERT_OAUTH_ENV]) {
    return AuthType.PAPERT_OAUTH;
  }
  if (process.env[OPENAI_API_KEY_ENV]) {
    return AuthType.USE_OPENAI;
  }
  if (process.env[GEMINI_API_KEY_ENV]) {
    return AuthType.USE_GEMINI;
  }
  return undefined;
}

function logAuthSelection(authType: AuthType): void {
  switch (authType) {
    case AuthType.PAPERT_OAUTH:
      logger.info('[Config] Using PAPERT_OAUTH');
      break;
    case AuthType.USE_OPENAI:
      logger.info('[Config] Using OPENAI_API_KEY');
      break;
    case AuthType.USE_GEMINI:
      logger.info('[Config] Using GEMINI_API_KEY');
      break;
    default:
      logger.info(`[Config] Using auth type: ${authType}`);
      break;
  }
}
