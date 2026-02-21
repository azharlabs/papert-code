/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */
// @vitest-environment node

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { sandboxCommand } from './sandboxCommand.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import type { CommandContext } from './types.js';
import type { Config } from '@papert-code/papert-code-core';

const { mockResolveCommandPath, mockReadFile } = vi.hoisted(() => ({
  mockResolveCommandPath: vi.fn(),
  mockReadFile: vi.fn(),
}));

vi.mock('@papert-code/papert-code-core', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@papert-code/papert-code-core')>();
  return {
    ...original,
    resolveCommandPath: mockResolveCommandPath,
  };
});

vi.mock('node:fs/promises', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...original,
    readFile: mockReadFile,
  };
});

describe('sandboxCommand', () => {
  const oldEnv = process.env;
  let context: CommandContext;

  beforeEach(() => {
    process.env = { ...oldEnv };
    process.env['SANDBOX'] = 'sandbox-exec';
    process.env['SEATBELT_PROFILE'] = 'permissive-open';
    process.env['SANDBOX_MOUNTS'] = '/tmp:/tmp:ro,/var:/var:rw';
    process.env['HTTP_PROXY'] = 'http://localhost:8080';
    process.env['SANDBOX_SET_UID_GID'] = '1';

    mockReadFile.mockResolvedValue(
      'overlay / overlay rw 0 0\n/dev/disk1 /private/apfs apfs rw 0 0\n',
    );
    mockResolveCommandPath.mockImplementation((command: string) => {
      if (command === 'docker' || command === 'git' || command === 'node') {
        return { path: `/usr/bin/${command}` };
      }
      return { path: null };
    });

    const config = {
      getSandbox: vi.fn().mockReturnValue({
        command: 'sandbox-exec',
        image: 'ghcr.io/papert/sandbox:latest',
      }),
      isRestrictiveSandbox: vi.fn().mockReturnValue(false),
      getTargetDir: vi.fn().mockReturnValue('/workspace/project'),
    } as unknown as Config;

    context = createMockCommandContext({
      services: {
        config,
      },
    });
  });

  afterEach(() => {
    process.env = oldEnv;
    vi.resetAllMocks();
  });

  it('returns a diagnostics report with sandbox sections', async () => {
    const result = await sandboxCommand.action?.(context, '');
    expect(result).toEqual(
      expect.objectContaining({
        type: 'message',
        messageType: 'info',
      }),
    );
    const content = (result as { content: string }).content;
    expect(content).toContain('Sandbox self-diagnostics');
    expect(content).toContain('Profile');
    expect(content).toContain('Mounts');
    expect(content).toContain('Network');
    expect(content).toContain('Identity');
    expect(content).toContain('Tool availability');
    expect(content).toContain('- docker: available (/usr/bin/docker)');
    expect(content).toContain('- podman: missing');
    expect(content).toContain('/tmp:/tmp:ro');
  });

  it('accepts the diagnose argument', async () => {
    const result = await sandboxCommand.action?.(context, 'diagnose');
    expect(result).toEqual(
      expect.objectContaining({
        type: 'message',
        messageType: 'info',
      }),
    );
  });

  it('returns usage error for unsupported arguments', async () => {
    const result = await sandboxCommand.action?.(context, 'invalid');
    expect(result).toEqual({
      type: 'message',
      messageType: 'error',
      content: 'Usage: /sandbox [diagnose]',
    });
  });

  it('completes with diagnose', async () => {
    expect(await sandboxCommand.completion?.(context, 'd')).toEqual([
      'diagnose',
    ]);
    expect(await sandboxCommand.completion?.(context, 'x')).toEqual([]);
  });
});
