/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Config } from '../config/config.js';
import type { SubagentTeamConfig } from './types.js';

interface TeamConfigFile {
  teams?: SubagentTeamConfig[];
}

export class SubagentTeamManager {
  private readonly configPath: string;

  constructor(private readonly config: Config) {
    this.configPath = path.join(this.config.getProjectRoot(), '.papert', 'agent-teams.json');
  }

  async listTeams(): Promise<SubagentTeamConfig[]> {
    const parsed = await this.readConfigFile();
    return parsed.teams ?? [];
  }

  async loadTeam(teamIdOrName: string): Promise<SubagentTeamConfig | null> {
    const key = teamIdOrName.replace(/^@/, '').trim().toLowerCase();
    const teams = await this.listTeams();
    return (
      teams.find((team) => team.id.toLowerCase() === key) ??
      teams.find((team) => team.name.toLowerCase() === key) ??
      null
    );
  }

  resolveTeamAgentNames(team: SubagentTeamConfig): string[] {
    return team.agents.map((agent) => agent.name.toLowerCase());
  }

  getTeamAgentModel(team: SubagentTeamConfig, agentName: string): string | undefined {
    const normalized = agentName.toLowerCase();
    return team.agents.find((agent) => agent.name.toLowerCase() === normalized)?.model;
  }

  getTeamAgentWorkspace(team: SubagentTeamConfig, agentName: string): string | undefined {
    const normalized = agentName.toLowerCase();
    return team.agents.find((agent) => agent.name.toLowerCase() === normalized)?.workspace;
  }

  ensureSenderAllowed(team: SubagentTeamConfig, senderId?: string): void {
    if (!team.allowlist || team.allowlist.length === 0) {
      return;
    }
    if (!senderId || !team.allowlist.includes(senderId)) {
      throw new Error(
        `Sender "${senderId ?? 'unknown'}" is not allowed for team "${team.id}". Add sender to allowlist in .papert/agent-teams.json.`,
      );
    }
  }

  private async readConfigFile(): Promise<TeamConfigFile> {
    try {
      const raw = await fs.readFile(this.configPath, 'utf8');
      const parsed = JSON.parse(raw) as TeamConfigFile;
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {};
      }
      throw error;
    }
  }
}
