/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Command, CommandContext, CommandExecutionResponse } from './types.js';

function showMemoryContent(context: CommandContext): string {
  const memoryContent = context.config.getUserMemory() || '';
  const fileCount = context.config.getGeminiMdFileCount() || 0;

  if (memoryContent.length === 0) {
    return 'Memory is currently empty.';
  }

  return `Current memory content from ${fileCount} file(s):\n\n---\n${memoryContent}\n---`;
}

function listMemoryFilePaths(context: CommandContext): string {
  const memoryContent = context.config.getUserMemory() || '';
  const markerRegex = /--- Context from: (.+?) ---/g;
  const paths = new Set<string>();

  for (const match of memoryContent.matchAll(markerRegex)) {
    const value = match[1]?.trim();
    if (value) {
      paths.add(value);
    }
  }

  if (paths.size > 0) {
    const sortedPaths = [...paths].sort((a, b) => a.localeCompare(b));
    return `There are ${sortedPaths.length} papert.md file(s) in use:\n\n${sortedPaths.join(
      '\n',
    )}`;
  }

  const fileCount = context.config.getGeminiMdFileCount() || 0;
  if (fileCount > 0) {
    return `There are ${fileCount} papert.md file(s) in use, but file paths are unavailable in this runtime.`;
  }

  return 'No papert.md files in use.';
}

export class MemoryCommand implements Command {
  readonly name = 'memory';
  readonly description = 'Manage memory.';
  readonly subCommands = [
    new ShowMemoryCommand(),
    new RefreshMemoryCommand(),
    new ListMemoryCommand(),
    new AddMemoryCommand(),
  ];
  readonly topLevel = true;
  readonly requiresWorkspace = true;

  async execute(
    context: CommandContext,
    args: string[],
  ): Promise<CommandExecutionResponse> {
    return new ShowMemoryCommand().execute(context, args);
  }
}

export class ShowMemoryCommand implements Command {
  readonly name = 'memory show';
  readonly description = 'Shows the current memory contents.';

  async execute(
    context: CommandContext,
    _: string[],
  ): Promise<CommandExecutionResponse> {
    return { name: this.name, data: showMemoryContent(context) };
  }
}

export class RefreshMemoryCommand implements Command {
  readonly name = 'memory refresh';
  readonly description = 'Refreshes the memory from the source.';

  async execute(
    context: CommandContext,
    _: string[],
  ): Promise<CommandExecutionResponse> {
    await context.config.refreshContextMemory({ force: true });
    const refreshedMemory = context.config.getUserMemory() || '';
    const fileCount = context.config.getGeminiMdFileCount() || 0;
    const content =
      refreshedMemory.length > 0
        ? `Memory refreshed successfully. Loaded ${refreshedMemory.length} characters from ${fileCount} file(s).`
        : 'Memory refreshed successfully. No memory content found.';

    return { name: this.name, data: content };
  }
}

export class ListMemoryCommand implements Command {
  readonly name = 'memory list';
  readonly description = 'Lists the paths of the papert.md files in use.';

  async execute(
    context: CommandContext,
    _: string[],
  ): Promise<CommandExecutionResponse> {
    return { name: this.name, data: listMemoryFilePaths(context) };
  }
}

export class AddMemoryCommand implements Command {
  readonly name = 'memory add';
  readonly description = 'Add content to the memory.';

  async execute(
    context: CommandContext,
    args: string[],
  ): Promise<CommandExecutionResponse> {
    const textToAdd = args.join(' ').trim();
    if (!textToAdd) {
      return {
        name: this.name,
        data: 'Usage: /memory add <text to remember>',
      };
    }

    const toolRegistry = context.config.getToolRegistry();
    const tool = toolRegistry.getTool('save_memory');

    if (!tool) {
      return {
        name: this.name,
        data: 'Error: Tool save_memory not found.',
      };
    }

    const abortController = new AbortController();
    await tool.buildAndExecute(
      { fact: textToAdd },
      abortController.signal,
      undefined,
      undefined,
    );
    await context.config.refreshContextMemory({ force: true });
    return {
      name: this.name,
      data: `Added memory: "${textToAdd}"`,
    };
  }
}
