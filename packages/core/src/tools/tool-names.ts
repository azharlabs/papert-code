/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Tool name constants to avoid circular dependencies.
 * These constants are used across multiple files and should be kept in sync
 * with the actual tool class names.
 */
export const GLOB_TOOL_NAME = 'glob';
export const WRITE_TODOS_TOOL_NAME = 'todo_write';
export const WRITE_FILE_TOOL_NAME = 'write_file';
export const WEB_SEARCH_TOOL_NAME = 'web_search';
export const WEB_FETCH_TOOL_NAME = 'web_fetch';
export const EDIT_TOOL_NAME = 'edit';
export const SHELL_TOOL_NAME = 'run_shell_command';
export const GREP_TOOL_NAME = 'grep_search';
export const READ_MANY_FILES_TOOL_NAME = 'read_many_files';
export const READ_FILE_TOOL_NAME = 'read_file';
export const LS_TOOL_NAME = 'list_directory';
export const MEMORY_TOOL_NAME = 'save_memory';
export const GET_INTERNAL_DOCS_TOOL_NAME = 'get_internal_docs';
export const EDIT_TOOL_NAMES = new Set([
  EDIT_TOOL_NAME,
  WRITE_FILE_TOOL_NAME,
  'replace',
]);
export const DELEGATE_TO_AGENT_TOOL_NAME = 'delegate_to_agent';

/** Prefix used for tools discovered via the toolDiscoveryCommand. */
export const DISCOVERED_TOOL_PREFIX = 'discovered_tool_';

/**
 * List of all built-in tool names.
 */
export const ALL_BUILTIN_TOOL_NAMES = [
  GLOB_TOOL_NAME,
  WRITE_TODOS_TOOL_NAME,
  WRITE_FILE_TOOL_NAME,
  WEB_SEARCH_TOOL_NAME,
  'google_web_search',
  WEB_FETCH_TOOL_NAME,
  EDIT_TOOL_NAME,
  'replace',
  SHELL_TOOL_NAME,
  GREP_TOOL_NAME,
  'search_file_content',
  READ_MANY_FILES_TOOL_NAME,
  READ_FILE_TOOL_NAME,
  LS_TOOL_NAME,
  MEMORY_TOOL_NAME,
  DELEGATE_TO_AGENT_TOOL_NAME,
] as const;

export const ToolNames = {
  EDIT: EDIT_TOOL_NAME,
  WRITE_FILE: WRITE_FILE_TOOL_NAME,
  READ_FILE: READ_FILE_TOOL_NAME,
  READ_MANY_FILES: READ_MANY_FILES_TOOL_NAME,
  GREP: GREP_TOOL_NAME,
  GLOB: GLOB_TOOL_NAME,
  SHELL: SHELL_TOOL_NAME,
  TODO_WRITE: WRITE_TODOS_TOOL_NAME,
  MEMORY: MEMORY_TOOL_NAME,
  TASK: 'task',
  EXIT_PLAN_MODE: 'exit_plan_mode',
  WEB_FETCH: WEB_FETCH_TOOL_NAME,
  WEB_SEARCH: WEB_SEARCH_TOOL_NAME,
  LS: LS_TOOL_NAME,
  GET_INTERNAL_DOCS: GET_INTERNAL_DOCS_TOOL_NAME,
  DELEGATE_TO_AGENT: DELEGATE_TO_AGENT_TOOL_NAME,
} as const;

/**
 * Tool display name constants to avoid circular dependencies.
 * These constants are used across multiple files and should be kept in sync
 * with the actual tool display names.
 */
export const ToolDisplayNames = {
  EDIT: 'Edit',
  WRITE_FILE: 'WriteFile',
  READ_FILE: 'ReadFile',
  READ_MANY_FILES: 'ReadManyFiles',
  GREP: 'Grep',
  GLOB: 'Glob',
  SHELL: 'Shell',
  TODO_WRITE: 'TodoWrite',
  MEMORY: 'SaveMemory',
  TASK: 'Task',
  EXIT_PLAN_MODE: 'ExitPlanMode',
  WEB_FETCH: 'WebFetch',
  WEB_SEARCH: 'WebSearch',
  LS: 'ListFiles',
  GET_INTERNAL_DOCS: 'GetInternalDocs',
  DELEGATE_TO_AGENT: 'DelegateToAgent',
} as const;

// Migration from old tool names to new tool names
// These legacy tool names were used in earlier versions and need to be supported
// for backward compatibility with existing user configurations
export const ToolNamesMigration = {
  search_file_content: ToolNames.GREP, // Legacy name from grep tool
  replace: ToolNames.EDIT, // Legacy name from edit tool
} as const;

// Migration from old tool display names to new tool display names
// These legacy display names were used before the tool naming standardization
export const ToolDisplayNamesMigration = {
  SearchFiles: ToolDisplayNames.GREP, // Old display name for Grep
  FindFiles: ToolDisplayNames.GLOB, // Old display name for Glob
  ReadFolder: ToolDisplayNames.LS, // Old display name for ListFiles
} as const;

/**
 * Validates if a tool name is syntactically valid.
 * Checks against built-in tools, discovered tools, and MCP naming conventions.
 */
export function isValidToolName(
  name: string,
  options: { allowWildcards?: boolean } = {},
): boolean {
  // Built-in tools
  if ((ALL_BUILTIN_TOOL_NAMES as readonly string[]).includes(name)) {
    return true;
  }

  // Discovered tools
  if (name.startsWith(DISCOVERED_TOOL_PREFIX)) {
    return true;
  }

  // Policy wildcards
  if (options.allowWildcards && name === '*') {
    return true;
  }

  // MCP tools (format: server__tool)
  if (name.includes('__')) {
    const parts = name.split('__');
    if (parts.length !== 2 || parts[0].length === 0 || parts[1].length === 0) {
      return false;
    }

    const server = parts[0];
    const tool = parts[1];

    if (tool === '*') {
      return !!options.allowWildcards;
    }

    // Basic slug validation for server and tool names
    const slugRegex = /^[a-z0-9-_]+$/i;
    return slugRegex.test(server) && slugRegex.test(tool);
  }

  return false;
}
