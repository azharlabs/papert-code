/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Storage } from '../config/storage.js';
import {
  DEFAULT_POLICY_TIER,
  USER_POLICY_TIER,
  ADMIN_POLICY_TIER,
} from './index.js';
import {
  type PolicyEngineConfig,
  PolicyDecision,
  type PolicyRule,
  type ApprovalMode,
  type PolicySettings,
  type PermissionDslDecision,
  type PermissionDslRule,
} from './types.js';
import { loadPoliciesFromToml } from './toml-loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const DEFAULT_CORE_POLICIES_DIR = path.join(__dirname, 'policies');
export const USER_POLICIES_DIR = path.join(
  Storage.getGlobalPapertDir(),
  'policies',
);
export const SYSTEM_POLICIES_DIR = path.join(
  Storage.getGlobalPapertDir(),
  'system-policies',
);

function toPolicyDecision(
  decision: PermissionDslDecision,
): PolicyDecision {
  if (decision === 'allow') {
    return PolicyDecision.ALLOW;
  }
  if (decision === 'deny') {
    return PolicyDecision.DENY;
  }
  return PolicyDecision.ASK_USER;
}

function parsePermissionDslString(
  entry: string,
): {
  decision: PolicyDecision;
  toolName: string;
  commandPrefix?: string;
  permissionClass?: 'external_directory';
} | null {
  const match = entry.trim().match(/^(allow|ask|deny)\s+([^\s(]+)(?:\((.+)\))?$/i);
  if (!match) {
    return null;
  }
  const [, decisionKeyword, toolPattern, commandPrefix] = match;
  const normalizedToolPattern = toolPattern.trim();
  if (!normalizedToolPattern) {
    return null;
  }

  const normalizedCommandPrefix = commandPrefix?.trim();
  if (normalizedToolPattern === 'external_directory') {
    return {
      decision: toPolicyDecision(
        decisionKeyword.toLowerCase() as PermissionDslDecision,
      ),
      toolName: '*',
      permissionClass: 'external_directory',
    };
  }

  return {
    decision: toPolicyDecision(
      decisionKeyword.toLowerCase() as PermissionDslDecision,
    ),
    toolName: normalizedToolPattern,
    ...(normalizedCommandPrefix
      ? { commandPrefix: normalizedCommandPrefix }
      : {}),
  };
}

function parsePermissionDslEntry(
  entry: string | PermissionDslRule,
  forcedAgentName?: string,
): PolicyRule | null {
  if (typeof entry === 'string') {
    const parsed = parsePermissionDslString(entry);
    if (!parsed) {
      return null;
    }
    return {
      toolName: parsed.toolName,
      decision: parsed.decision,
      ...(parsed.commandPrefix
        ? { commandPrefix: parsed.commandPrefix }
        : {}),
      ...(parsed.permissionClass
        ? { permissionClass: parsed.permissionClass }
        : {}),
      ...(forcedAgentName ? { agentName: forcedAgentName } : {}),
    };
  }

  if (!entry || typeof entry.tool !== 'string') {
    return null;
  }

  const toolName = entry.tool.trim();
  if (!toolName) {
    return null;
  }

  return {
    toolName,
    decision: toPolicyDecision(entry.decision),
    ...(entry.commandPrefix ? { commandPrefix: entry.commandPrefix } : {}),
    ...(entry.permissionClass
      ? { permissionClass: entry.permissionClass }
      : {}),
    ...(forcedAgentName || entry.agentName
      ? { agentName: forcedAgentName ?? entry.agentName }
      : {}),
    reason: entry.reason,
  };
}

export function getPolicyDirectories(defaultPoliciesDir?: string): string[] {
  const dirs = [];
  if (defaultPoliciesDir) {
    dirs.push(defaultPoliciesDir);
  } else {
    dirs.push(DEFAULT_CORE_POLICIES_DIR);
  }
  dirs.push(USER_POLICIES_DIR);
  dirs.push(SYSTEM_POLICIES_DIR);
  return dirs.reverse();
}

export function getPolicyTier(
  dir: string,
  defaultPoliciesDir?: string,
): number {
  const normalizedDir = path.resolve(dir);
  if (
    defaultPoliciesDir &&
    normalizedDir === path.resolve(defaultPoliciesDir)
  ) {
    return DEFAULT_POLICY_TIER;
  }
  if (normalizedDir === path.resolve(DEFAULT_CORE_POLICIES_DIR)) {
    return DEFAULT_POLICY_TIER;
  }
  if (normalizedDir === path.resolve(USER_POLICIES_DIR)) {
    return USER_POLICY_TIER;
  }
  if (normalizedDir === path.resolve(SYSTEM_POLICIES_DIR)) {
    return ADMIN_POLICY_TIER;
  }
  return DEFAULT_POLICY_TIER;
}

export function createPolicyEngineConfig(
  settings: PolicySettings,
  approvalMode: ApprovalMode,
  defaultPoliciesDir?: string,
): PolicyEngineConfig {
  const policyDirs = getPolicyDirectories(defaultPoliciesDir);
  const { rules: tomlRules, checkers: tomlCheckers } = loadPoliciesFromToml(
    approvalMode,
    policyDirs,
    (dir) => getPolicyTier(dir, defaultPoliciesDir),
  );

  const rules: PolicyRule[] = [...tomlRules];
  const checkers = [...tomlCheckers];

  if (settings.mcp?.excluded) {
    for (const serverName of settings.mcp.excluded) {
      rules.push({
        toolName: `${serverName}__*`,
        decision: PolicyDecision.DENY,
        priority: 2.9,
      });
    }
  }

  if (settings.tools?.exclude) {
    for (const tool of settings.tools.exclude) {
      rules.push({
        toolName: tool,
        decision: PolicyDecision.DENY,
        priority: 2.4,
      });
    }
  }

  if (settings.tools?.allowed) {
    for (const tool of settings.tools.allowed) {
      rules.push({
        toolName: tool,
        decision: PolicyDecision.ALLOW,
        priority: 2.3,
      });
    }
  }

  if (settings.mcpServers) {
    for (const [serverName, serverConfig] of Object.entries(
      settings.mcpServers,
    )) {
      if (serverConfig.trust) {
        rules.push({
          toolName: `${serverName}__*`,
          decision: PolicyDecision.ALLOW,
          priority: 2.2,
        });
      }
    }
  }

  if (settings.tools?.permissions) {
    const parsedPermissionRules = settings.tools.permissions
      .map((entry) => parsePermissionDslEntry(entry))
      .filter((rule): rule is PolicyRule => !!rule);

    parsedPermissionRules.forEach((rule, index) => {
      rules.push({
        ...rule,
        priority: 2.95 + index / 1000,
      });
    });
  }

  if (settings.tools?.agentPermissions) {
    let agentRuleOffset = 0;
    for (const [agentName, permissions] of Object.entries(
      settings.tools.agentPermissions,
    )) {
      const normalizedAgentName = agentName.trim();
      if (!normalizedAgentName || !Array.isArray(permissions)) {
        continue;
      }

      const parsedAgentRules = permissions
        .map((entry) => parsePermissionDslEntry(entry, normalizedAgentName))
        .filter((rule): rule is PolicyRule => !!rule);

      parsedAgentRules.forEach((rule, index) => {
        rules.push({
          ...rule,
          // Agent-scoped permission rules intentionally evaluate after global
          // rules so they can override behavior for that specific agent.
          priority: 2.98 + (agentRuleOffset + index) / 1000,
        });
      });

      agentRuleOffset += parsedAgentRules.length;
    }
  }

  return {
    rules,
    checkers,
    defaultDecision: PolicyDecision.ASK_USER,
  };
}
