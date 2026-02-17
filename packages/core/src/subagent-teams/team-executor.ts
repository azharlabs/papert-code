/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Config } from '../config/config.js';
import type { SubagentManager } from '../subagents/subagent-manager.js';
import type { SubagentConfig } from '../subagents/types.js';
import { ContextState } from '../subagents/subagent.js';
import { parseInitialAgentPrefix, parseTeamHandoffs } from './mention-parser.js';
import { createQueuePaths, TeamQueueStore } from './queue-store.js';
import { SubagentTeamManager } from './team-manager.js';
import type {
  SubagentTeamConfig,
  TeamEvent,
  TeamExecutionRequest,
  TeamExecutionResult,
  TeamQueueMessage,
  TeamStepResult,
} from './types.js';

const DEFAULT_MAX_MESSAGES = 50;

export class SubagentTeamExecutor {
  private readonly teamManager: SubagentTeamManager;

  constructor(
    private readonly config: Config,
    private readonly subagentManager: SubagentManager,
  ) {
    this.teamManager = new SubagentTeamManager(config);
  }

  async execute(request: TeamExecutionRequest): Promise<TeamExecutionResult> {
    const team = await this.teamManager.loadTeam(request.teamIdOrName);
    if (!team) {
      throw new Error(
        `Team "${request.teamIdOrName}" not found. Configure it in .papert/agent-teams.json.`,
      );
    }

    this.teamManager.ensureSenderAllowed(team, request.senderId);
    const validAgents = new Set(this.teamManager.resolveTeamAgentNames(team));
    const conversationId = randomUUID();
    const queueStore = new TeamQueueStore(
      createQueuePaths(this.config.getProjectRoot(), team.id, conversationId),
    );
    const eventsDir = path.join(
      this.config.getProjectRoot(),
      '.papert',
      'runtime',
      'subagent-teams',
      team.id,
      'events',
    );
    await fs.mkdir(eventsDir, { recursive: true });
    const eventFile = path.join(eventsDir, `${conversationId}.jsonl`);

    const initialRoute = parseInitialAgentPrefix(request.prompt);
    const initialAgent = initialRoute.agent && validAgents.has(initialRoute.agent)
      ? initialRoute.agent
      : team.leader.toLowerCase();

    const maxMessages = team.maxMessages ?? DEFAULT_MAX_MESSAGES;
    const steps: TeamStepResult[] = [];
    let processedCount = 0;

    await queueStore.recoverProcessingToIncoming();
    await this.emitEvent(eventFile, {
      type: 'team_start',
      conversationId,
      teamId: team.id,
      timestamp: Date.now(),
      payload: {
        leader: team.leader,
        senderId: request.senderId ?? null,
      },
    });

    const initialMessage: TeamQueueMessage = {
      id: randomUUID(),
      conversationId,
      agent: initialAgent,
      message: initialRoute.message.trim(),
      createdAt: Date.now(),
    };
    await queueStore.enqueueIncoming(initialMessage);

    while (processedCount < maxMessages) {
      const batch = await queueStore.dequeueIncomingBatch();
      if (batch.length === 0) {
        break;
      }

      for (const entry of batch) {
        if (processedCount >= maxMessages) {
          break;
        }
        processedCount += 1;
        const step = await this.runSingleMessage(
          team,
          entry.message,
          validAgents,
          eventFile,
        );
        steps.push(step);
        await queueStore.ackProcessing(entry.filePath);

        for (const handoff of step.handoffs) {
          const message: TeamQueueMessage = {
            id: randomUUID(),
            conversationId,
            agent: handoff.toAgent,
            message: handoff.message,
            fromAgent: step.agent,
            createdAt: Date.now(),
          };
          await queueStore.enqueueIncoming(message);
          await this.emitEvent(eventFile, {
            type: 'handoff',
            conversationId,
            teamId: team.id,
            timestamp: Date.now(),
            payload: {
              from: step.agent,
              to: handoff.toAgent,
            },
          });
        }
      }
    }

    const finalText = steps
      .map((step) => `@${step.agent}: ${step.output}`)
      .join('\n\n------\n\n')
      .trim();

    const result: TeamExecutionResult = {
      conversationId,
      teamId: team.id,
      leader: team.leader,
      steps,
      finalText,
    };
    await queueStore.writeOutgoing(conversationId, result);
    await this.emitEvent(eventFile, {
      type: 'team_complete',
      conversationId,
      teamId: team.id,
      timestamp: Date.now(),
      payload: {
        steps: steps.length,
      },
    });

    return result;
  }

  private async runSingleMessage(
    team: SubagentTeamConfig,
    message: TeamQueueMessage,
    validAgents: Set<string>,
    eventFile: string,
  ): Promise<TeamStepResult> {
    const subagentName = message.agent.toLowerCase();
    const subagentConfig = await this.subagentManager.loadSubagent(subagentName);
    if (!subagentConfig) {
      throw new Error(`Subagent "${subagentName}" not found for team "${team.id}".`);
    }

    const runtimeConfig = await this.applyTeamOverrides(
      team,
      subagentConfig,
      subagentName,
    );
    await this.emitEvent(eventFile, {
      type: 'step_start',
      conversationId: message.conversationId,
      teamId: team.id,
      timestamp: Date.now(),
      payload: {
        agent: subagentName,
        fromAgent: message.fromAgent ?? null,
      },
    });

    const scope = await this.subagentManager.createSubagentScope(
      runtimeConfig,
      this.config,
    );
    const context = new ContextState();
    context.set('task_prompt', message.message);
    await scope.runNonInteractive(context);

    const output = scope.getFinalText();
    const parsed = parseTeamHandoffs(output, validAgents);
    const step: TeamStepResult = {
      conversationId: message.conversationId,
      agent: subagentName,
      fromAgent: message.fromAgent,
      input: message.message,
      output: parsed.cleanedResponse,
      handoffs: parsed.handoffs,
      timestamp: Date.now(),
    };
    await this.emitEvent(eventFile, {
      type: 'step_complete',
      conversationId: message.conversationId,
      teamId: team.id,
      timestamp: Date.now(),
      payload: {
        agent: subagentName,
        handoffCount: step.handoffs.length,
      },
    });
    return step;
  }

  private async applyTeamOverrides(
    team: SubagentTeamConfig,
    config: SubagentConfig,
    agentName: string,
  ): Promise<SubagentConfig> {
    const modelFromTeam = this.teamManager.getTeamAgentModel(team, agentName);
    const workspaceFromTeam = this.teamManager.getTeamAgentWorkspace(
      team,
      agentName,
    );

    const workspaceRoot = path.join(
      this.config.getProjectRoot(),
      '.papert',
      'runtime',
      'subagent-teams',
      team.id,
      'workspaces',
      workspaceFromTeam ?? agentName,
    );
    await fs.mkdir(workspaceRoot, { recursive: true });

    const finalModel = modelFromTeam ?? config.modelConfig?.model;
    const workspaceNotice = `\n\nTeam Workspace:\n- Work only within ${workspaceRoot}\n- Keep artifacts for this agent isolated in that directory.`;

    return {
      ...config,
      systemPrompt: `${config.systemPrompt}${workspaceNotice}`,
      modelConfig: {
        ...config.modelConfig,
        model: finalModel,
      },
    };
  }

  private async emitEvent(eventFile: string, event: TeamEvent): Promise<void> {
    await fs.appendFile(eventFile, `${JSON.stringify(event)}\n`, 'utf8');
  }
}
