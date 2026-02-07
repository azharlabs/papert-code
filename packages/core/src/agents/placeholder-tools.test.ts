/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { DelegateToAgentTool } from './delegate-to-agent-tool.js';
import { SubagentToolWrapper } from './subagent-tool-wrapper.js';
import { ToolErrorType } from '../tools/tool-error.js';

describe('placeholder agent tools', () => {
  it('returns an explicit error for delegate_to_agent', async () => {
    const invocation = DelegateToAgentTool.build({
      agentName: 'worker',
      input: 'hello',
    });
    const result = await invocation.execute(new AbortController().signal);
    expect(result.error?.type).toBe(ToolErrorType.EXECUTION_FAILED);
    expect(result.returnDisplay).toContain('not implemented');
  });

  it('returns an explicit error for subagent_tool_wrapper', async () => {
    const invocation = SubagentToolWrapper.build({
      name: 'worker',
      input: 'hello',
    });
    const result = await invocation.execute(new AbortController().signal);
    expect(result.error?.type).toBe(ToolErrorType.EXECUTION_FAILED);
    expect(result.returnDisplay).toContain('not implemented');
  });
});
