/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { AllowedPathChecker } from './built-in.js';
import { SafetyCheckDecision } from './protocol.js';
import type { SafetyCheckInput } from './protocol.js';

describe('AllowedPathChecker', () => {
  const buildInput = (
    cwd: string,
    workspaces: string[],
    toolArgs: Record<string, unknown>,
  ): SafetyCheckInput => ({
    protocolVersion: '1.0.0',
    toolCall: {
      name: 'write_file',
      args: toolArgs,
    },
    context: {
      environment: { cwd, workspaces },
    },
  });

  it('allows paths within workspace', async () => {
    const checker = new AllowedPathChecker();
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'papert-safety-'));
    const input = buildInput(workspace, [workspace], {
      file_path: path.join(workspace, 'file.txt'),
    });

    const result = await checker.check(input);
    expect(result.decision).toBe(SafetyCheckDecision.ALLOW);
  });

  it('denies paths outside workspace', async () => {
    const checker = new AllowedPathChecker();
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'papert-safety-'));
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'papert-outside-'));
    const input = buildInput(workspace, [workspace], {
      file_path: path.join(outside, 'file.txt'),
    });

    const result = await checker.check(input);
    expect(result.decision).toBe(SafetyCheckDecision.DENY);
  });
});
