/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Config } from '../config/config.js';
import type {
  AgentDefinition,
  AgentInvocationResult,
} from './types.js';

/**
 * Minimal agent executor. Upstream executes an agent loop; here we simply
 * return the instructions as the result to preserve API shape.
 */
export class AgentExecutor<TOutput = unknown> {
  constructor(
    readonly definition: AgentDefinition<TOutput>,
    readonly runtimeContext: Config,
  ) {}

  static async create<TOutput = unknown>(
    definition: AgentDefinition<TOutput>,
    runtimeContext: Config,
  ): Promise<AgentExecutor<TOutput>> {
    return new AgentExecutor(definition, runtimeContext);
  }

  async run(): Promise<AgentInvocationResult<TOutput>> {
    return {
      status: 'completed',
      output: (this.definition.instructions as unknown as TOutput) ?? null,
      message: this.definition.description,
    };
  }
}
