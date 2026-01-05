/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Config } from '../config/config.js';
import type { AgentDefinition } from './types.js';
import { debugLogger } from '../utils/debugLogger.js';

export class AgentRegistry {
  private readonly agents = new Map<string, AgentDefinition>();

  constructor(_config: Config) { }

  async initialize(): Promise<void> {
    // Placeholder for future discovery.
    debugLogger.debug(
      `[AgentRegistry] initialized with ${this.agents.size} agents`,
    );
  }

  registerAgent(definition: AgentDefinition): void {
    this.agents.set(definition.name, definition);
  }

  getAgent(name: string): AgentDefinition | undefined {
    return this.agents.get(name);
  }

  listAgents(): AgentDefinition[] {
    return Array.from(this.agents.values());
  }
}
