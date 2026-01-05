/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type PolicyEngineConfig,
  type PolicySettings,
  createPolicyEngineConfig as createCorePolicyEngineConfig,
  ApprovalMode as ConfigApprovalMode,
  PolicyApprovalMode,
} from '@papert-code/papert-code-core';
import { type Settings } from './settings.js';

function toPolicyApprovalMode(
  approvalMode: ConfigApprovalMode,
): PolicyApprovalMode {
  switch (approvalMode) {
    case ConfigApprovalMode.AUTO_EDIT:
      return PolicyApprovalMode.AUTO_EDIT;
    case ConfigApprovalMode.YOLO:
      return PolicyApprovalMode.YOLO;
    case ConfigApprovalMode.PLAN:
    case ConfigApprovalMode.DEFAULT:
    default:
      return PolicyApprovalMode.DEFAULT;
  }
}

export async function createPolicyEngineConfig(
  settings: Settings,
  approvalMode: ConfigApprovalMode,
): Promise<PolicyEngineConfig> {
  const policySettings: PolicySettings = {
    mcp: settings.mcp,
    tools: settings.tools,
    mcpServers: settings.mcpServers,
  };

  return createCorePolicyEngineConfig(
    policySettings,
    toPolicyApprovalMode(approvalMode),
  );
}
