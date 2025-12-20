/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseToolInvocation, type ToolBuilder, type ToolResult, Kind } from '../tools/tools.js';
import type { PartListUnion } from '@google/genai';

interface DelegateParams {
  agentName: string;
  input: string;
}

class DelegateInvocation
  extends BaseToolInvocation<DelegateParams, ToolResult>
{
  getDescription(): string {
    return `Delegate to agent "${this.params.agentName}"`;
  }

  async execute(): Promise<ToolResult> {
    const message = `Delegated to agent "${this.params.agentName}" with input: ${this.params.input}`;
    return {
      llmContent: [{ text: message }] as PartListUnion,
      returnDisplay: message,
    };
  }
}

export const DelegateToAgentTool: ToolBuilder<DelegateParams, ToolResult> = {
  name: 'delegate_to_agent',
  displayName: 'Delegate to Agent',
  description: 'Delegates work to another agent (placeholder implementation).',
  kind: Kind.Think,
  schema: {
    name: 'delegate_to_agent',
    description: 'Delegates work to another agent (placeholder implementation).',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        agentName: { type: 'string' },
        input: { type: 'string' },
      },
      required: ['agentName', 'input'],
    },
  },
  isOutputMarkdown: true,
  canUpdateOutput: false,
  build: (params: DelegateParams) => new DelegateInvocation(params),
};
