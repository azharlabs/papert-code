/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AgentDefinition<TOutput = unknown> {
  name: string;
  description: string;
  instructions?: string;
  modelConfig?: Record<string, unknown>;
  runConfig?: Record<string, unknown>;
  outputSchema?: TOutput;
}

export interface AgentInvocationResult<TOutput = unknown> {
  status: 'completed' | 'failed';
  output: TOutput | null;
  message?: string;
}
