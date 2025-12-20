/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseToolInvocation, type ToolBuilder, type ToolResult, Kind } from '../tools/tools.js';
import type { PartListUnion } from '@google/genai';

interface SubagentParams {
  name: string;
  input?: string;
}

class SubagentInvocation
  extends BaseToolInvocation<SubagentParams, ToolResult>
{
  getDescription(): string {
    return `Invoke subagent "${this.params.name}"`;
  }

  async execute(): Promise<ToolResult> {
    const message = `Subagent "${this.params.name}" invoked${this.params.input ? ` with input: ${this.params.input}` : ''}.`;
    return {
      llmContent: [{ text: message }] as PartListUnion,
      returnDisplay: message,
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
