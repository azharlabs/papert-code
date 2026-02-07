/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import path from 'node:path';
import type { SlashCommand, CommandContext, SlashCommandActionReturn } from './types.js';
import { CommandKind } from './types.js';
import { getGitRepoRoot, isGitHubRepository } from '../../utils/gitUtils.js';
import { GITHUB_WORKFLOW_PATHS, setupGithubCommand } from './setupGithubCommand.js';

type WorkflowRunAlias = {
  alias: string;
  fileName: string;
};

const WORKFLOW_ALIASES: WorkflowRunAlias[] = [
  { alias: 'dispatch', fileName: 'gemini-dispatch.yml' },
  { alias: 'assistant', fileName: 'gemini-invoke.yml' },
  { alias: 'triage', fileName: 'gemini-triage.yml' },
  { alias: 'scheduled-triage', fileName: 'gemini-scheduled-triage.yml' },
  { alias: 'review', fileName: 'gemini-review.yml' },
];

const installSubCommand: SlashCommand = {
  name: 'install',
  description: 'Install GitHub workflow templates for Papert automation',
  kind: CommandKind.BUILT_IN,
  action: async (context): Promise<SlashCommandActionReturn | void> =>
    setupGithubCommand.action?.(context) ?? {
      type: 'message',
      messageType: 'error',
      content: 'GitHub installer is unavailable.',
    },
};

const statusSubCommand: SlashCommand = {
  name: 'status',
  description: 'Show installed GitHub workflow status',
  kind: CommandKind.BUILT_IN,
  action: async (): Promise<SlashCommandActionReturn> => {
    if (!isGitHubRepository()) {
      return {
        type: 'message',
        messageType: 'error',
        content:
          'Unable to determine the GitHub repository. Run this command from a git repository.',
      };
    }

    const repoRoot = getGitRepoRoot();
    const workflowsDir = path.join(repoRoot, '.github', 'workflows');

    const expectedFiles = GITHUB_WORKFLOW_PATHS.map((value) =>
      path.basename(value),
    );

    const existingFiles = await fs
      .readdir(workflowsDir)
      .catch(() => [] as string[]);

    const missingFiles = expectedFiles.filter((file) => !existingFiles.includes(file));

    const statusLines = expectedFiles.map((file) =>
      `${missingFiles.includes(file) ? 'MISSING' : 'OK'} ${file}`,
    );

    const summary =
      missingFiles.length === 0
        ? 'All Papert GitHub workflows are installed.'
        : `${missingFiles.length} workflow(s) missing. Run /github install to sync.`;

    return {
      type: 'message',
      messageType: 'info',
      content: `${summary}\n\n${statusLines.join('\n')}`,
    };
  },
};

const runSubCommand: SlashCommand = {
  name: 'run',
  description:
    'Trigger a configured GitHub workflow with gh CLI. Usage: /github run <dispatch|assistant|triage|scheduled-triage|review>',
  kind: CommandKind.BUILT_IN,
  action: async (
    _context: CommandContext,
    args: string,
  ): Promise<SlashCommandActionReturn> => {
    const workflowAlias = args.trim();
    if (!workflowAlias) {
      return {
        type: 'message',
        messageType: 'error',
        content:
          'Missing workflow alias. Usage: /github run <dispatch|assistant|triage|scheduled-triage|review>',
      };
    }

    const selected = WORKFLOW_ALIASES.find((item) => item.alias === workflowAlias);
    if (!selected) {
      return {
        type: 'message',
        messageType: 'error',
        content: `Unknown workflow alias: ${workflowAlias}`,
      };
    }

    return {
      type: 'tool',
      toolName: 'run_shell_command',
      toolArgs: {
        is_background: false,
        description: `Trigger GitHub workflow ${selected.fileName}`,
        command: `gh workflow run ${selected.fileName}`,
      },
    };
  },
};

export const githubCommand: SlashCommand = {
  name: 'github',
  description: 'Manage GitHub automation workflows',
  kind: CommandKind.BUILT_IN,
  subCommands: [installSubCommand, statusSubCommand, runSubCommand],
};
