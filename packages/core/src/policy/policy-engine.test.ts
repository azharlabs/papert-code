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

  it('supports wildcard tool matching', () => {
    const engine = new PolicyEngine({
      rules: [
        {
          toolName: 'run_*',
          decision: PolicyDecision.DENY,
          reason: 'All run_* tools are blocked in this environment',
        },
      ],
    });

    const details = engine.getDecisionDetails(
      { name: 'run_shell_command', args: { command: 'echo ok' } },
      undefined,
    );

    expect(details.decision).toBe(PolicyDecision.DENY);
    expect(details.reason).toBe('All run_* tools are blocked in this environment');
  });

  it('uses last-match-wins when multiple rules match', () => {
    const engine = new PolicyEngine({
      rules: [
        {
          toolName: 'run_shell_command',
          decision: PolicyDecision.DENY,
          reason: 'default shell deny',
          priority: 1,
        },
        {
          toolName: 'run_shell_command',
          decision: PolicyDecision.ALLOW,
          reason: 'last override allow',
          priority: 5,
        },
      ],
    });

    const details = engine.getDecisionDetails(
      { name: 'run_shell_command', args: { command: 'git status' } },
      undefined,
    );

    expect(details.decision).toBe(PolicyDecision.ALLOW);
    expect(details.reason).toBeUndefined();
  });

  it('supports shell command-prefix rule matching', () => {
    const engine = new PolicyEngine({
      rules: [
        {
          toolName: 'run_shell_command',
          commandPrefix: 'rm -rf',
          decision: PolicyDecision.DENY,
          reason: 'Dangerous delete command blocked',
        },
      ],
    });

    const denied = engine.getDecisionDetails(
      { name: 'run_shell_command', args: { command: 'rm -rf /tmp/cache' } },
      undefined,
    );
    const allowed = engine.getDecisionDetails(
      { name: 'run_shell_command', args: { command: 'git status' } },
      undefined,
    );

    expect(denied.decision).toBe(PolicyDecision.DENY);
    expect(denied.reason).toBe('Dangerous delete command blocked');
    expect(allowed.decision).toBe(PolicyDecision.ASK_USER);
  });

  it('supports external_directory permission class', () => {
    const engine = new PolicyEngine({
      rules: [
        {
          toolName: '*',
          permissionClass: 'external_directory',
          decision: PolicyDecision.DENY,
          reason: 'Out-of-workspace file access is blocked',
        },
      ],
    });

    const workspaceAccess = engine.getDecisionDetails(
      { name: 'read_file', args: { file_path: './src/app.ts' } },
      undefined,
      { cwd: '/repo', workspaces: ['/repo'] },
    );
    const externalAccess = engine.getDecisionDetails(
      { name: 'read_file', args: { file_path: '../secrets.txt' } },
      undefined,
      { cwd: '/repo', workspaces: ['/repo'] },
    );

    expect(workspaceAccess.decision).toBe(PolicyDecision.ASK_USER);
    expect(externalAccess.decision).toBe(PolicyDecision.DENY);
    expect(externalAccess.reason).toBe('Out-of-workspace file access is blocked');
  });
});
