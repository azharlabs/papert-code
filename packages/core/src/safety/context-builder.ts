/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SafetyCheckInput, ConversationTurn } from './protocol.js';
import type { Config } from '../config/config.js';

export class ContextBuilder {
  constructor(
    private readonly config: Config,
    private readonly conversationHistory: ConversationTurn[] = [],
  ) {}

  buildFullContext(): SafetyCheckInput['context'] {
    return {
      environment: {
        cwd: process.cwd(),
        workspaces: this.config
          .getWorkspaceContext()
          .getDirectories() as string[],
      },
      history: {
        turns: this.conversationHistory,
      },
    };
  }

  buildMinimalContext(
    requiredKeys: Array<keyof SafetyCheckInput['context']>,
  ): SafetyCheckInput['context'] {
    const fullContext = this.buildFullContext();
    const minimalContext: Partial<SafetyCheckInput['context']> = {};

    for (const key of requiredKeys) {
      if (key === 'environment') {
        minimalContext.environment = fullContext.environment;
      }
      if (key === 'history') {
        minimalContext.history = fullContext.history;
      }
    }

    return minimalContext as SafetyCheckInput['context'];
  }
}
