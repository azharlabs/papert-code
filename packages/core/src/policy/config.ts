/**
 * @license
 * Copyright 2025 Google LLC
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
  const { rules: tomlRules } = loadPoliciesFromToml(
    approvalMode,
    policyDirs,
    (dir) => getPolicyTier(dir, defaultPoliciesDir),
  );

  const rules: PolicyRule[] = [...tomlRules];

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

  return {
    rules,
    defaultDecision: PolicyDecision.ASK_USER,
  };
}
