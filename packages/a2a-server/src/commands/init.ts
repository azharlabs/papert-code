/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { CoderAgentEvent, type AgentSettings } from '../types.js';
import { getCurrentGeminiMdFilename } from '@papert-code/papert-code-core';
import type {
  Command,
  CommandContext,
  CommandExecutionResponse,
} from './types.js';
import type { CoderAgentExecutor } from '../agent/executor.js';
import type {
  ExecutionEventBus,
  RequestContext,
  AgentExecutionEvent,
} from '@a2a-js/sdk/server';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

export class InitCommand implements Command {
  name = 'init';
  description = 'Analyzes the project and creates a tailored papert.md file';
  requiresWorkspace = true;
  streaming = true;

  private handleMessageResult(
    result: { content: string; messageType: 'info' | 'error' },
    context: CommandContext,
    eventBus: ExecutionEventBus,
    taskId: string,
    contextId: string,
  ): CommandExecutionResponse {
    const statusState = result.messageType === 'error' ? 'failed' : 'completed';
    const eventType =
      result.messageType === 'error'
        ? CoderAgentEvent.StateChangeEvent
        : CoderAgentEvent.TextContentEvent;

    const event: AgentExecutionEvent = {
      kind: 'status-update',
      taskId,
      contextId,
      status: {
        state: statusState,
        message: {
          kind: 'message',
          role: 'agent',
          parts: [{ kind: 'text', text: result.content }],
          messageId: uuidv4(),
          taskId,
          contextId,
        },
        timestamp: new Date().toISOString(),
      },
      final: true,
      metadata: {
        coderAgent: { kind: eventType },
        model: context.config.getModel(),
      },
    };

    logger.info('[EventBus event]: ', event);
    eventBus.publish(event);
    return {
      name: this.name,
      data: result,
    };
  }

  private async handleSubmitPromptResult(
    result: { content: unknown },
    context: CommandContext,
    geminiMdPath: string,
    eventBus: ExecutionEventBus,
    taskId: string,
    contextId: string,
  ): Promise<CommandExecutionResponse> {
    fs.writeFileSync(geminiMdPath, '', 'utf8');

    if (!context.agentExecutor) {
      throw new Error('Agent executor not found in context.');
    }
    const agentExecutor = context.agentExecutor as CoderAgentExecutor;

    const agentSettings: AgentSettings = {
      kind: CoderAgentEvent.StateAgentSettingsEvent,
      workspacePath: process.env['CODER_AGENT_WORKSPACE_PATH']!,
      autoExecute: true,
    };

    if (typeof result.content !== 'string') {
      throw new Error('Init command content must be a string.');
    }
    const promptText = result.content;

    const requestContext: RequestContext = {
      userMessage: {
        kind: 'message',
        role: 'user',
        parts: [{ kind: 'text', text: promptText }],
        messageId: uuidv4(),
        taskId,
        contextId,
        metadata: {
          coderAgent: agentSettings,
        },
      },
      taskId,
      contextId,
    };

    // The executor will handle the entire agentic loop, including
    // creating the task, streaming responses, and handling tools.
    await agentExecutor.execute(requestContext, eventBus);
    return {
      name: this.name,
      data: geminiMdPath,
    };
  }

  async execute(
    context: CommandContext,
    _args: string[] = [],
  ): Promise<CommandExecutionResponse> {
    if (!context.eventBus) {
      return {
        name: this.name,
        data: 'Use executeStream to get streaming results.',
      };
    }

    const workspacePath = process.env['CODER_AGENT_WORKSPACE_PATH'];
    if (!workspacePath) {
      return {
        name: this.name,
        data: {
          type: 'message',
          messageType: 'error',
          content:
            'CODER_AGENT_WORKSPACE_PATH must be set to run the init command.',
        },
      };
    }

    const contextFileName = getCurrentGeminiMdFilename();
    const geminiMdPath = path.join(workspacePath, contextFileName);
    const result = buildInitResult(fs.existsSync(geminiMdPath), contextFileName);

    const taskId = uuidv4();
    const contextId = uuidv4();

    switch (result.type) {
      case 'message':
        return this.handleMessageResult(
          result,
          context,
          context.eventBus,
          taskId,
          contextId,
        );
      case 'submit_prompt':
        return this.handleSubmitPromptResult(
          result,
          context,
          geminiMdPath,
          context.eventBus,
          taskId,
          contextId,
        );
      default:
        throw new Error('Unknown result type from buildInitResult');
    }
  }
}

function buildInitResult(
  doesContextFileExist: boolean,
  contextFileName: string,
): { type: 'message'; messageType: 'info' | 'error'; content: string } | {
  type: 'submit_prompt';
  content: string;
} {
  if (doesContextFileExist) {
    return {
      type: 'message',
      messageType: 'info',
      content: `A ${contextFileName} file already exists in this directory. No changes were made.`,
    };
  }

  return {
    type: 'submit_prompt',
    content: `
You are Papert Code, an interactive CLI agent. Analyze the current directory and generate a comprehensive ${contextFileName} file to be used as instructional context for future interactions.

**Analysis Process:**

1.  **Initial Exploration:**
    *   Start by listing the files and directories to get a high-level overview of the structure.
    *   Read the README file (e.g., \`README.md\`, \`README.txt\`) if it exists. This is often the best place to start.

2.  **Iterative Deep Dive (up to 10 files):**
    *   Based on your initial findings, select a few files that seem most important (e.g., configuration files, main source files, documentation).
    *   Read them. As you learn more, refine your understanding and decide which files to read next. You don't need to decide all 10 files at once. Let your discoveries guide your exploration.

3.  **Identify Project Type:**
    *   **Code Project:** Look for clues like \`package.json\`, \`requirements.txt\`, \`pom.xml\`, \`go.mod\`, \`Cargo.toml\`, \`build.gradle\`, or a \`src\` directory. If you find them, this is likely a software project.
    *   **Non-Code Project:** If you don't find code-related files, this might be a directory for documentation, research papers, notes, or something else.

**${contextFileName} Content Generation:**

**For a Code Project:**

*   **Project Overview:** Write a clear and concise summary of the project's purpose, main technologies, and architecture.
*   **Building and Running:** Document the key commands for building, running, and testing the project. Infer these from the files you've read (e.g., \`scripts\` in \`package.json\`, \`Makefile\`, etc.). If you can't find explicit commands, provide a placeholder with a TODO.
*   **Development Conventions:** Describe any coding styles, testing practices, or contribution guidelines you can infer from the codebase.

**For a Non-Code Project:**

*   **Directory Overview:** Describe the purpose and contents of the directory. What is it for? What kind of information does it hold?
*   **Key Files:** List the most important files and briefly explain what they contain.
*   **Usage:** Explain how the contents of this directory are intended to be used.

**Final Output:**

Write the complete content to the \`${contextFileName}\` file. The output must be well-formatted Markdown.
`,
  };
}
