/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseToolInvocation, type ToolBuilder, type ToolResult, Kind } from '../tools/tools.js';
import type { PartListUnion } from '@google/genai';
import { ToolErrorType } from '../tools/tool-error.js';

interface SubagentParams {
  name: string;
  input?: string;
}

class SubagentInvocation
  extends BaseToolInvocation<SubagentParams, ToolResult> {
  getDescription(): string {
    return `Invoke subagent "${this.params.name}"`;
  }

  async execute(): Promise<ToolResult> {
    const message =
      'The subagent_tool_wrapper tool is not implemented yet. Use configured subagents through the main orchestration flow.';
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

export const SubagentToolWrapper: ToolBuilder<SubagentParams, ToolResult> = {
  name: 'subagent_tool_wrapper',
  displayName: 'Subagent Tool Wrapper',
  description: 'Runs a configured subagent (placeholder implementation).',
  kind: Kind.Think,
  schema: {
    name: 'subagent_tool_wrapper',
    description: 'Runs a configured subagent (placeholder implementation).',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        input: { type: 'string' },
      },
      required: ['name'],
    },
  },
  isOutputMarkdown: true,
  canUpdateOutput: false,
  build: (params: SubagentParams) => new SubagentInvocation(params),
};
