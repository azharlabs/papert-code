/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { FunctionCall } from '@google/genai';

export interface ConversationTurn {
  user: {
    text: string;
  };
  model: {
    text?: string;
    toolCalls?: FunctionCall[];
  };
}

export interface SafetyCheckInput {
  protocolVersion: '1.0.0';
  toolCall: FunctionCall;
  context: {
    environment: {
      cwd: string;
      workspaces: string[];
    };
    history?: {
      turns: ConversationTurn[];
    };
  };
  config?: unknown;
}

export enum SafetyCheckDecision {
  ALLOW = 'allow',
  DENY = 'deny',
  ASK_USER = 'ask_user',
}

export type SafetyCheckResult =
  | {
      decision: SafetyCheckDecision.ALLOW;
      reason?: string;
    }
  | {
      decision: SafetyCheckDecision.DENY;
      reason: string;
    }
  | {
      decision: SafetyCheckDecision.ASK_USER;
      reason: string;
    };
