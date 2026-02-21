/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SafetyCheckInput } from '../safety/protocol.js';

export enum PolicyDecision {
  ALLOW = 'allow',
  DENY = 'deny',
  ASK_USER = 'ask_user',
}

/**
 * Valid sources for hook execution.
 */
export type HookSource = 'project' | 'user' | 'system' | 'extension';

const VALID_HOOK_SOURCES: HookSource[] = [
  'project',
  'user',
  'system',
  'extension',
];

/**
 * Safely extract and validate hook source from input.
 */
export function getHookSource(input: Record<string, unknown>): HookSource {
  const source = input['hook_source'];
  if (
    typeof source === 'string' &&
    VALID_HOOK_SOURCES.includes(source as HookSource)
  ) {
    return source as HookSource;
  }
  return 'project';
}

export enum ApprovalMode {
  DEFAULT = 'default',
  AUTO_EDIT = 'autoEdit',
  YOLO = 'yolo',
  PLAN = 'plan',
}

export interface AllowedPathConfig {
  included_args?: string[];
  excluded_args?: string[];
}

export interface ExternalCheckerConfig {
  type: 'external';
  name: string;
  config?: unknown;
  required_context?: Array<keyof SafetyCheckInput['context']>;
}

export enum InProcessCheckerType {
  ALLOWED_PATH = 'allowed-path',
}

export interface InProcessCheckerConfig {
  type: 'in-process';
  name: InProcessCheckerType;
  config?: AllowedPathConfig;
  required_context?: Array<keyof SafetyCheckInput['context']>;
}

export type SafetyCheckerConfig =
  | ExternalCheckerConfig
  | InProcessCheckerConfig;

export interface SafetyCheckerRule {
  toolName?: string;
  argsPattern?: RegExp;
  priority?: number;
  checker: SafetyCheckerConfig;
  modes?: ApprovalMode[];
}

export interface PolicyRule {
  /**
   * Tool matcher. Supports exact names (e.g. "read_file") and
   * wildcard patterns using "*" (e.g. "run_*" or "*__*").
   */
  toolName?: string;
  /**
   * Optional shell command prefix matcher(s). Applies when tool args include
   * a "command" string (e.g. run_shell_command).
   */
  commandPrefix?: string | string[];
  /**
   * Optional permission class matcher.
   * "external_directory" matches tool calls that reference paths outside of
   * the current workspace roots.
   */
  permissionClass?: 'external_directory';
  argsPattern?: RegExp;
  /**
   * Optional agent scope matcher. When set, the rule only applies to tool
   * calls executed by the named agent/subagent.
   */
  agentName?: string;
  decision: PolicyDecision;
  priority?: number;
  reason?: string;
}

export type PermissionDslDecision = 'allow' | 'ask' | 'deny';

export interface PermissionDslRule {
  decision: PermissionDslDecision;
  tool: string;
  commandPrefix?: string | string[];
  permissionClass?: 'external_directory';
  agentName?: string;
  reason?: string;
}

export interface PolicyEvaluationContext {
  cwd?: string;
  workspaces?: string[];
  agentName?: string;
}

export interface HookExecutionContext {
  eventName: string;
  hookSource?: HookSource;
}

export interface PolicyEngineConfig {
  rules?: PolicyRule[];
  checkers?: SafetyCheckerRule[];
  defaultDecision?: PolicyDecision;
  nonInteractive?: boolean;
  allowHooks?: boolean;
}

export interface PolicySettings {
  mcp?: {
    excluded?: string[];
    allowed?: string[];
  };
  tools?: {
    exclude?: string[];
    allowed?: string[];
    permissions?: Array<string | PermissionDslRule>;
    agentPermissions?: Record<string, Array<string | PermissionDslRule>>;
  };
  mcpServers?: Record<string, { trust?: boolean }>;
}
