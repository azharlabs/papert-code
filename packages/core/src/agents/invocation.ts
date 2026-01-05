/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Config } from '../config/config.js';
import { AgentExecutor } from './executor.js';
import type { AgentDefinition, AgentInvocationResult } from './types.js';

export class AgentInvocation<TOutput = unknown> {
  private executor: AgentExecutor<TOutput> | null = null;

  constructor(
    private readonly definition: AgentDefinition<TOutput>,
    private readonly config: Config,
  ) { }

  async initialize(): Promise<void> {
    this.executor = await AgentExecutor.create(this.definition, this.config);
  }

  async run(): Promise<AgentInvocationResult<TOutput>> {
    if (!this.executor) {
      await this.initialize();
    }
    return (this.executor as AgentExecutor<TOutput>).run();
  }
}
