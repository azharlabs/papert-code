/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { CommandContext, SlashCommand } from './types.js';
import { CommandKind } from './types.js';
import { MessageType } from '../types.js';
import { t } from '../../i18n/index.js';

interface TeamAgentConfig {
  name: string;
  model?: string;
  workspace?: string;
}

interface TeamConfig {
  id: string;
  name: string;
  leader: string;
  agents: TeamAgentConfig[];
  allowlist?: string[];
  maxMessages?: number;
}

interface TeamConfigFile {
  teams?: TeamConfig[];
}

function getProjectRoot(context: CommandContext): string {
  return context.services.config?.getProjectRoot?.() ?? process.cwd();
}

function getTeamFilePath(projectRoot: string): string {
  return path.join(projectRoot, '.papert', 'agent-teams.json');
}

async function loadTeams(projectRoot: string): Promise<TeamConfig[]> {
  const filePath = getTeamFilePath(projectRoot);
  const raw = await fs.readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw) as TeamConfigFile;
  return parsed.teams ?? [];
}

function renderHelp(): string {
  return [
    'Team commands:',
    '  /team list',
    '  /team show <team-id>',
    '  /team validate [team-id]',
    '  /team subagents',
    '',
    'Config file:',
    '  .papert/agent-teams.json',
    '',
    'Tip:',
    '  Use team targets as "team:<id>" (not @id) to avoid @include behavior.',
  ].join('\n');
}

function addInfo(context: CommandContext, text: string): void {
  context.ui.addItem({ type: MessageType.INFO, text }, Date.now());
}

function addError(context: CommandContext, text: string): void {
  context.ui.addItem({ type: MessageType.ERROR, text }, Date.now());
}

async function handleList(context: CommandContext): Promise<void> {
  const projectRoot = getProjectRoot(context);
  const filePath = getTeamFilePath(projectRoot);
  let teams: TeamConfig[];
  try {
    teams = await loadTeams(projectRoot);
  } catch (error) {
    addError(
      context,
      `Failed to read team config at ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return;
  }

  if (teams.length === 0) {
    addInfo(context, `No teams configured in ${filePath}.`);
    return;
  }
  const lines = teams.map(
    (team) =>
      `team:${team.id} | leader:@${team.leader} | agents:${team.agents.map((agent) => agent.name).join(', ')}`,
  );
  addInfo(context, `Teams (${teams.length}):\n${lines.join('\n')}`);
}

async function handleShow(context: CommandContext, teamIdOrName: string): Promise<void> {
  const projectRoot = getProjectRoot(context);
  const filePath = getTeamFilePath(projectRoot);
  let teams: TeamConfig[];
  try {
    teams = await loadTeams(projectRoot);
  } catch (error) {
    addError(
      context,
      `Failed to read team config at ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return;
  }

  const requested = teamIdOrName.toLowerCase();
  if (!requested) {
    addError(context, 'Usage: /team show <team-id>');
    return;
  }

  const team = teams.find(
    (item) =>
      item.id.toLowerCase() === requested || item.name.toLowerCase() === requested,
  );
  if (!team) {
    addError(
      context,
      `Team "${requested}" not found. Use /team list to see available teams.`,
    );
    return;
  }
  addInfo(context, JSON.stringify(team, null, 2));
}

async function handleSubagents(context: CommandContext): Promise<void> {
  const manager = context.services.config?.getSubagentManager?.();
  if (!manager) {
    addError(context, 'Subagent manager unavailable.');
    return;
  }
  const subagents = await manager.listSubagents();
  const names = subagents.map((item) => item.name).sort();
  addInfo(
    context,
    names.length > 0
      ? `Available subagents (${names.length}):\n${names.join('\n')}`
      : 'No subagents found. Create one with /agents create.',
  );
}

async function handleValidate(
  context: CommandContext,
  teamIdOrName?: string,
): Promise<void> {
  const projectRoot = getProjectRoot(context);
  const filePath = getTeamFilePath(projectRoot);
  let teams: TeamConfig[];
  try {
    teams = await loadTeams(projectRoot);
  } catch (error) {
    addError(
      context,
      `Failed to read team config at ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return;
  }

  const target = (teamIdOrName ?? '').toLowerCase();
  const selected = target
    ? teams.filter(
        (item) =>
          item.id.toLowerCase() === target || item.name.toLowerCase() === target,
      )
    : teams;

  if (selected.length === 0) {
    addError(
      context,
      target ? `Team "${target}" not found.` : `No teams configured in ${filePath}.`,
    );
    return;
  }

  const manager = context.services.config?.getSubagentManager?.();
  if (!manager) {
    addError(context, 'Subagent manager unavailable.');
    return;
  }
  const subagents = await manager.listSubagents();
  const available = new Set(subagents.map((item) => item.name.toLowerCase()));

  const lines: string[] = [];
  let hasErrors = false;

  for (const team of selected) {
    const missingAgents = team.agents
      .map((agent) => agent.name)
      .filter((name) => !available.has(name.toLowerCase()));
    const leaderMissing = !available.has(team.leader.toLowerCase());
    if (missingAgents.length === 0 && !leaderMissing) {
      lines.push(`team:${team.id} OK`);
      continue;
    }
    hasErrors = true;
    lines.push(`team:${team.id} INVALID`);
    if (leaderMissing) {
      lines.push(`  - missing leader subagent: ${team.leader}`);
    }
    for (const missing of missingAgents) {
      lines.push(`  - missing agent subagent: ${missing}`);
    }
  }

  if (hasErrors) {
    addError(context, lines.join('\n'));
  } else {
    addInfo(context, lines.join('\n'));
  }
}

async function handleTeamCommand(context: CommandContext, args: string): Promise<void> {
  const [subcommandRaw, ...rest] = args.trim().split(/\s+/).filter(Boolean);
  const subcommand = (subcommandRaw ?? 'help').toLowerCase();

  if (subcommand === 'help') {
    addInfo(context, renderHelp());
    return;
  }

  if (subcommand === 'list') {
    await handleList(context);
    return;
  }

  if (subcommand === 'show') {
    await handleShow(context, rest[0] ?? '');
    return;
  }

  if (subcommand === 'validate') {
    await handleValidate(context, rest[0]);
    return;
  }

  if (subcommand === 'subagents') {
    await handleSubagents(context);
    return;
  }

  addError(context, `Unknown subcommand "${subcommand}".\n\n${renderHelp()}`);
}

export const teamCommand: SlashCommand = {
  name: 'team',
  get description() {
    return t('Manage subagent teams and validate team config.');
  },
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext, args: string): Promise<void> =>
    handleTeamCommand(context, args),
  subCommands: [
    {
      name: 'list',
      get description() {
        return t('List configured subagent teams.');
      },
      kind: CommandKind.BUILT_IN,
      action: async (context: CommandContext): Promise<void> => handleList(context),
    },
    {
      name: 'show',
      get description() {
        return t('Show one team configuration.');
      },
      kind: CommandKind.BUILT_IN,
      action: async (context: CommandContext, args: string): Promise<void> =>
        handleShow(context, args.trim()),
    },
    {
      name: 'validate',
      get description() {
        return t('Validate team members against available subagents.');
      },
      kind: CommandKind.BUILT_IN,
      action: async (context: CommandContext, args: string): Promise<void> =>
        handleValidate(context, args.trim() || undefined),
    },
    {
      name: 'subagents',
      get description() {
        return t('List available subagent names.');
      },
      kind: CommandKind.BUILT_IN,
      action: async (context: CommandContext): Promise<void> =>
        handleSubagents(context),
    },
    {
      name: 'help',
      get description() {
        return t('Show /team command help.');
      },
      kind: CommandKind.BUILT_IN,
      action: async (context: CommandContext): Promise<void> =>
        addInfo(context, renderHelp()),
    },
  ],
};
