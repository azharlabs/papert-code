/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TeamAgentConfig {
  name: string;
  model?: string;
  workspace?: string;
}

export interface SubagentTeamConfig {
  id: string;
  name: string;
  leader: string;
  agents: TeamAgentConfig[];
  allowlist?: string[];
  maxMessages?: number;
}

export interface TeamQueueMessage {
  id: string;
  conversationId: string;
  agent: string;
  message: string;
  fromAgent?: string;
  createdAt: number;
}

export interface TeamStepResult {
  conversationId: string;
  agent: string;
  fromAgent?: string;
  input: string;
  output: string;
  handoffs: TeamHandoff[];
  timestamp: number;
}

export interface TeamHandoff {
  toAgent: string;
  message: string;
}

export interface TeamExecutionRequest {
  teamIdOrName: string;
  prompt: string;
  senderId?: string;
}

export interface TeamExecutionResult {
  conversationId: string;
  teamId: string;
  leader: string;
  steps: TeamStepResult[];
  finalText: string;
}

export interface TeamEvent {
  type:
    | 'team_start'
    | 'step_start'
    | 'handoff'
    | 'step_complete'
    | 'team_complete'
    | 'team_error';
  conversationId: string;
  teamId: string;
  timestamp: number;
  payload: Record<string, unknown>;
}
