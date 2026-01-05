/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

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
}

export interface PolicyRule {
  toolName?: string;
  argsPattern?: RegExp;
  decision: PolicyDecision;
  priority?: number;
}

export interface HookExecutionContext {
  eventName: string;
  hookSource?: HookSource;
}

export interface PolicyEngineConfig {
  rules?: PolicyRule[];
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
  };
  mcpServers?: Record<string, { trust?: boolean }>;
}
