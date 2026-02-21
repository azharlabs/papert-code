/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { createPolicyEngineConfig } from './config.js';
import { PolicyEngine } from './policy-engine.js';
import { ApprovalMode, PolicyDecision } from './types.js';

describe('createPolicyEngineConfig permission DSL', () => {
  it('parses string and object permission rules', () => {
    const config = createPolicyEngineConfig(
      {
        tools: {
          permissions: [
            'allow read_*',
            'ask run_shell_command',
            {
              decision: 'deny',
              tool: 'run_shell_command',
              reason: 'Shell is blocked by policy',
            },
          ],
        },
      },
      ApprovalMode.DEFAULT,
      '/tmp/nonexistent-core-policy-dir',
    );

    const engine = new PolicyEngine(config);

    expect(
      engine.check({ name: 'read_file', args: { file_path: 'a.txt' } }, undefined),
    ).toBe(PolicyDecision.ALLOW);

    const shellDecision = engine.getDecisionDetails(
      { name: 'run_shell_command', args: { command: 'ls -la' } },
      undefined,
    );
    expect(shellDecision.decision).toBe(PolicyDecision.DENY);
    expect(shellDecision.reason).toBe('Shell is blocked by policy');
  });

  it('ignores malformed DSL entries', () => {
    const config = createPolicyEngineConfig(
      {
        tools: {
          permissions: ['bad-rule-format', 'allow   '],
        },
      },
      ApprovalMode.DEFAULT,
      '/tmp/nonexistent-core-policy-dir',
    );

    const engine = new PolicyEngine(config);
    const details = engine.getDecisionDetails(
      { name: 'read_file', args: { file_path: 'x' } },
      undefined,
    );

    expect(details.decision).toBe(PolicyDecision.ASK_USER);
  });
});
