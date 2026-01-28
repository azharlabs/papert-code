/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

// Export config
export * from './config/config.js';
export * from './config/defaultModelConfigs.js';
export * from './config/models.js';
export * from './output/types.js';
export * from './output/json-formatter.js';
export * from './confirmation-bus/types.js';
export * from './confirmation-bus/message-bus.js';
export * from './hooks/index.js';
export * from './hooks/types.js';
export * from './format/index.js';

// Export plugins
export * from './plugins/types.js';
export * from './plugins/pluginEventBus.js';
export * from './plugins/pluginLoader.js';
export * from './plugins/pluginSystem.js';

// Export Core Logic
export * from './core/client.js';
export * from './core/contentGenerator.js';
export * from './core/loggingContentGenerator.js';
export * from './core/geminiChat.js';
export * from './core/logger.js';
export * from './core/prompts.js';
export * from './core/tokenLimits.js';
export * from './core/turn.js';
export * from './core/geminiRequest.js';
export * from './core/coreToolScheduler.js';
export * from './core/nonInteractiveToolExecutor.js';

export * from './fallback/types.js';

export * from './code_assist/codeAssist.js';
export * from './code_assist/oauth2.js';
export * from './papert/papertOAuth2.js';
export * from './code_assist/server.js';
export * from './code_assist/types.js';

// Export utilities
export * from './utils/paths.js';
export * from './utils/schemaValidator.js';
export * from './utils/errors.js';
export { getErrorStatus } from './utils/httpErrors.js';
export * from './utils/getFolderStructure.js';
export * from './utils/environmentContext.js';
export * from './utils/memoryDiscovery.js';
export * from './utils/gitIgnoreParser.js';
export * from './utils/gitUtils.js';
export * from './utils/editor.js';
export * from './utils/quotaErrorDetection.js';
export * from './utils/fileUtils.js';
export * from './utils/retry.js';
export * from './utils/shell-utils.js';
export * from './utils/terminalSerializer.js';
export * from './utils/systemEncoding.js';
export * from './utils/textUtils.js';
export * from './utils/formatters.js';
export * from './utils/generateContentResponseUtilities.js';
export * from './utils/ripgrepUtils.js';
export * from './utils/filesearch/fileSearch.js';
export * from './utils/errorParsing.js';
export * from './utils/package.js';
export * from './utils/version.js';
export * from './utils/workspaceContext.js';
export * from './utils/ignorePatterns.js';
export * from './utils/partUtils.js';
export * from './utils/subagentGenerator.js';
export * from './utils/projectSummary.js';
export * from './utils/promptIdContext.js';
export * from './utils/thoughtUtils.js';
export * from './utils/debugLogger.js';
export {
  isCommandAllowed as isShellCommandAllowed,
  isShellInvocationAllowlisted,
} from './utils/shell-permissions.js';

// Export services
export * from './services/fileDiscoveryService.js';
export * from './services/gitService.js';
export * from './services/chatRecordingService.js';
export * from './services/contextManager.js';
export * from './services/sessionSummaryService.js';
export * from './services/sessionSummaryUtils.js';
export * from './services/sessionService.js';
export * from './services/fileSystemService.js';
export {
  ModelConfigService,
  type ModelConfigKey as ModelConfigServiceKey,
  type ModelConfigAlias as ModelConfigAliasConfig,
  type ModelConfigOverride as ModelConfigOverrideConfig,
  type ModelConfigServiceConfig,
  type ResolvedModelConfig,
} from './services/modelConfigService.js';
export * from './services/modelConfigServiceTestUtils.js';

// Export IDE specific logic
export * from './ide/ide-client.js';
export * from './ide/ideContext.js';
export * from './ide/ide-installer.js';
export { IDE_DEFINITIONS, type IdeInfo } from './ide/detect-ide.js';
export * from './ide/constants.js';
export * from './ide/types.js';

// Export Shell Execution Service
export * from './services/shellExecutionService.js';

// Export base tool definitions
export * from './tools/tools.js';
export * from './tools/tool-error.js';
export * from './tools/tool-registry.js';
export * from './tools/tool-names.js';
export * from './tools/get-internal-docs.js';

// Export subagents (Phase 1)
export * from './subagents/index.js';

// Export prompt logic
export * from './prompts/mcp-prompts.js';

// Agents and policy
export * from './agents/types.js';
export * from './agents/executor.js';
export * from './agents/invocation.js';
export * from './agents/registry.js';
export * from './agents/local-executor.js';
export * from './agents/local-invocation.js';
export * from './agents/remote-invocation.js';
export * from './agents/toml-loader.js';
export * from './agents/codebase-investigator.js';
export * from './agents/delegate-to-agent-tool.js';
export * from './agents/introspection-agent.js';
export * from './agents/subagent-tool-wrapper.js';
export {
  PolicyDecision,
  ApprovalMode as PolicyApprovalMode,
  type PolicyRule,
  type PolicyEngineConfig,
  type PolicySettings,
  DEFAULT_POLICY_TIER,
  USER_POLICY_TIER,
  ADMIN_POLICY_TIER,
} from './policy/index.js';
export { PolicyEngine } from './policy/policy-engine.js';
export {
  createPolicyEngineConfig,
  DEFAULT_CORE_POLICIES_DIR,
  USER_POLICIES_DIR,
  SYSTEM_POLICIES_DIR,
  getPolicyDirectories,
  getPolicyTier,
} from './policy/config.js';
export * from './resources/resource-registry.js';

// Export specific tool logic
export * from './tools/read-file.js';
export * from './tools/ls.js';
export * from './tools/grep.js';
export * from './tools/ripGrep.js';
export * from './tools/glob.js';
export * from './tools/edit.js';
export * from './tools/write-file.js';
export * from './tools/web-fetch.js';
export * from './tools/memoryTool.js';
export * from './tools/shell.js';
export * from './tools/web-search/index.js';
export * from './tools/read-many-files.js';
export * from './tools/mcp-client.js';
export * from './tools/mcp-tool.js';
export * from './tools/task.js';
export * from './tools/todoWrite.js';
export * from './tools/exitPlanMode.js';
export * from './tools/custom-tools.js';

// MCP OAuth
export { MCPOAuthProvider } from './mcp/oauth-provider.js';
export type {
  OAuthToken,
  OAuthCredentials,
} from './mcp/token-storage/types.js';
export { MCPOAuthTokenStorage } from './mcp/oauth-token-storage.js';
export type { MCPOAuthConfig } from './mcp/oauth-provider.js';
export type {
  OAuthAuthorizationServerMetadata,
  OAuthProtectedResourceMetadata,
} from './mcp/oauth-utils.js';
export { OAuthUtils } from './mcp/oauth-utils.js';

// Export telemetry functions
export * from './telemetry/index.js';
export * from './utils/checkpointUtils.js';
export * from './utils/browser.js';
// OpenAI Logging Utilities
export { OpenAILogger, openaiLogger } from './utils/openaiLogger.js';
export { Storage } from './config/storage.js';
