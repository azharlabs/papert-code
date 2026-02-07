/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseToolInvocation, type ToolBuilder, type ToolResult, Kind } from '../tools/tools.js';
import type { PartListUnion } from '@google/genai';
import { ToolErrorType } from '../tools/tool-error.js';

interface DelegateParams {
  agentName: string;
  input: string;
}

class DelegateInvocation
  extends BaseToolInvocation<DelegateParams, ToolResult> {
  getDescription(): string {
    return `Delegate to agent "${this.params.agentName}"`;
  }

  async execute(): Promise<ToolResult> {
    const message =
      'The delegate_to_agent tool is not implemented yet. Configure and use subagents instead.';
    return {
      llmContent: [{ text: message }] as PartListUnion,
      returnDisplay: message,
      error: {
        message,
        type: ToolErrorType.EXECUTION_FAILED,
      },
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
