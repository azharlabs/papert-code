/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */
// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { githubCommand } from './githubCommand.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';

vi.mock('../../utils/gitUtils.js', () => ({
  isGitHubRepository: vi.fn(),
  getGitRepoRoot: vi.fn(),
}));
vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(),
}));

vi.mock('./setupGithubCommand.js', () => ({
  GITHUB_WORKFLOW_PATHS: [
    'issue-triage/gemini-triage.yml',
    'pr-review/gemini-review.yml',
  ],
  setupGithubCommand: {
    action: vi.fn().mockResolvedValue({
      type: 'message',
      messageType: 'info',
      content: 'installed',
    }),
  },
}));

import { isGitHubRepository, getGitRepoRoot } from '../../utils/gitUtils.js';
import { readdir } from 'node:fs/promises';

function getSub(name: string) {
  const sub = githubCommand.subCommands?.find((value) => value.name === name);
  if (!sub?.action) {
    throw new Error(`Missing subcommand: ${name}`);
  }
  return sub;
}

describe('githubCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('install delegates to setup-github flow', async () => {
    const context = createMockCommandContext();
    const install = getSub('install');

    const result = await install.action?.(context, '');
    expect(result).toEqual({
      type: 'message',
      messageType: 'info',
      content: 'installed',
    });
  });

  it('status returns repository error outside git repo', async () => {
    vi.mocked(isGitHubRepository).mockReturnValue(false);
    const status = getSub('status');

    const result = await status.action?.(createMockCommandContext(), '');
    expect(result).toEqual({
      type: 'message',
      messageType: 'error',
      content:
        'Unable to determine the GitHub repository. Run this command from a git repository.',
    });
  });

  it('run builds gh workflow tool command', async () => {
    const run = getSub('run');
    const result = await run.action?.(createMockCommandContext(), 'review');

    expect(result).toEqual({
      type: 'tool',
      toolName: 'run_shell_command',
      toolArgs: {
        is_background: false,
        description: 'Trigger GitHub workflow gemini-review.yml',
        command: "gh workflow run 'gemini-review.yml'",
      },
    });
  });

  it('run supports --ref and --input flags', async () => {
    const run = getSub('run');
    const result = await run.action?.(
      createMockCommandContext(),
      'dispatch --ref main --input env=prod --input dryRun=true',
    );

    expect(result).toEqual({
      type: 'tool',
      toolName: 'run_shell_command',
      toolArgs: {
        is_background: false,
        description: 'Trigger GitHub workflow gemini-dispatch.yml',
        command:
          "gh workflow run 'gemini-dispatch.yml' --ref 'main' -f 'env=prod' -f 'dryRun=true'",
      },
    });
  });

  it('run validates aliases', async () => {
    const run = getSub('run');
    const result = await run.action?.(createMockCommandContext(), '');

    expect(result).toEqual({
      type: 'message',
      messageType: 'error',
      content:
        'Missing workflow alias. Usage: /github run <dispatch|assistant|triage|scheduled-triage|review> [--ref <branch>] [--input key=value]',
    });
  });

  it('runs subcommand builds status command with workflow filter', async () => {
    const runs = getSub('runs');
    const result = await runs.action?.(createMockCommandContext(), 'triage');
    expect(result).toEqual({
      type: 'tool',
      toolName: 'run_shell_command',
      toolArgs: {
        is_background: false,
        description: 'Fetch recent GitHub workflow runs',
        command: "gh run list --limit 10 --workflow 'gemini-triage.yml'",
      },
    });
  });

  it('status lists missing files', async () => {
    vi.mocked(isGitHubRepository).mockReturnValue(true);
    vi.mocked(getGitRepoRoot).mockReturnValue('/tmp/repo');

    vi.mocked(readdir).mockResolvedValue(['gemini-triage.yml'] as any);

    const status = getSub('status');
    const result = await status.action?.(createMockCommandContext(), '');

    expect(result).toEqual({
      type: 'message',
      messageType: 'info',
      content: expect.stringContaining('1 workflow(s) missing. Run /github install to sync.'),
    });
    expect((result as { content: string }).content).toContain('OK gemini-triage.yml');
    expect((result as { content: string }).content).toContain('MISSING gemini-review.yml');
  });
});
