/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { PolicyEngine } from './policy-engine.js';
import { PolicyDecision } from './types.js';

describe('PolicyEngine.getDecisionReason', () => {
  it('returns custom reason from matching deny rule', () => {
    const engine = new PolicyEngine({
      rules: [
        {
          toolName: 'run_shell_command',
          decision: PolicyDecision.DENY,
          reason: 'Shell execution is restricted in this workspace',
        },
      ],
    });

    const reason = engine.getDecisionReason(
      { name: 'run_shell_command', args: { command: 'rm -rf /tmp' } },
      undefined,
    );

    expect(reason).toBe('Shell execution is restricted in this workspace');
  });

  it('returns generated reason when deny rule has no custom reason', () => {
    const engine = new PolicyEngine({
      rules: [
        {
          toolName: 'run_shell_command',
          argsPattern: /rm -rf/,
          decision: PolicyDecision.DENY,
          priority: 9,
        },
      ],
    });

    const reason = engine.getDecisionReason(
      { name: 'run_shell_command', args: { command: 'rm -rf /tmp' } },
      undefined,
    );

    expect(reason).toContain('Denied by matching policy rule');
    expect(reason).toContain('tool=run_shell_command');
    expect(reason).toContain('argsPattern=rm -rf');
    expect(reason).toContain('priority=9');
  });

  it('returns non-interactive explanation when ASK_USER becomes DENY', () => {
    const engine = new PolicyEngine({
      defaultDecision: PolicyDecision.ASK_USER,
      nonInteractive: true,
    });

    const details = engine.getDecisionDetails(
      { name: 'read_file', args: { file_path: '/tmp/a' } },
      undefined,
    );

    expect(details.decision).toBe(PolicyDecision.DENY);
    expect(details.reason).toBe(
      'Interactive confirmation is disabled in non-interactive mode',
    );
  });
});
