/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Shell permission helpers backed by the policy engine.
 */

import { PolicyDecision, ApprovalMode } from '../policy/types.js';
import { PolicyEngine } from '../policy/policy-engine.js';
import { createPolicyEngineConfig } from '../policy/config.js';

let cachedEngine: PolicyEngine | null = null;

function getEngine(): PolicyEngine {
  if (cachedEngine) return cachedEngine;
  const config = createPolicyEngineConfig(
    {},
    // Default approval mode
    ApprovalMode.DEFAULT,
  );
  cachedEngine = new PolicyEngine(config);
  return cachedEngine;
}

/**
 * Returns true if the provided shell invocation is allowed by policy.
 */
export function isShellInvocationAllowlisted(command: string): boolean {
  const engine = getEngine();
  const decision = engine.check(
    {
      name: 'run_shell_command',
      args: { command },
    },
    undefined,
  );
  return decision === PolicyDecision.ALLOW;
}

/**
 * Returns true if a command is allowed. This is a thin wrapper around
 * {@link isShellInvocationAllowlisted}.
 */
export function isCommandAllowed(
  command: string,
  _allowedCommands?: string[],
): boolean {
  return isShellInvocationAllowlisted(command);
}
