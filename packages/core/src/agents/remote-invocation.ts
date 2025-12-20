/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AgentDefinition, AgentInvocationResult } from './types.js';

/**
 * Placeholder for remote agent invocation. Currently mirrors local behavior.
 */
export class RemoteAgentInvocation<TOutput = unknown> {
  constructor(private readonly definition: AgentDefinition<TOutput>) {}

  async run(): Promise<AgentInvocationResult<TOutput>> {
    return {
      status: 'completed',
      output: (this.definition.instructions as unknown as TOutput) ?? null,
      message: this.definition.description,
    };
  }
}
