import type {
  PermissionMode,
  PermissionSuggestion,
  SubagentConfig,
} from './protocol.js';

export type { PermissionMode };

type JSONSchema = {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
  description?: string;
  [key: string]: unknown;
};

export type ToolDefinition<TInput = unknown, TOutput = unknown> = {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  handler: (input: TInput) => Promise<TOutput>;
};

export type TransportOptions = {
  pathToQwenExecutable: string;
  cwd?: string;
  model?: string;
  permissionMode?: PermissionMode;
  env?: Record<string, string>;
  abortController?: AbortController;
  debug?: boolean;
  stderr?: (message: string) => void;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  maxSessionTurns?: number;
  coreTools?: string[];
  excludeTools?: string[];
  allowedTools?: string[];
  authType?: string;
  includePartialMessages?: boolean;
};

type ToolInput = Record<string, unknown>;

export type CanUseTool = (
  toolName: string,
  input: ToolInput,
  options: {
    signal: AbortSignal;
    suggestions?: PermissionSuggestion[] | null;
  },
) => Promise<PermissionResult>;

export type PermissionResult =
  | {
      behavior: 'allow';
      updatedInput: ToolInput;
    }
  | {
      behavior: 'deny';
      message: string;
      interrupt?: boolean;
    };

export interface ExternalMcpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface SdkMcpServerConfig {
  connect: (transport: unknown) => Promise<void>;
}

/**
 * Configuration options for creating a query session with the Qwen CLI.
 */
export interface QueryOptions {
  /**
   * The working directory for the query session.
   * This determines the context in which file operations and commands are executed.
   * @default process.cwd()
   */
  cwd?: string;

  /**
   * The AI model to use for the query session.
   * This takes precedence over the environment variables `OPENAI_MODEL` and `QWEN_MODEL`
   * @example 'qwen-max', 'qwen-plus', 'qwen-turbo'
   */
  model?: string;

  /**
   * Path to the Qwen CLI executable or runtime specification.
   *
   * Supports multiple formats:
   * - 'qwen' -> native binary (auto-detected from PATH)
   * - '/path/to/qwen' -> native binary (explicit path)
   * - '/path/to/cli.js' -> Node.js bundle (default for .js files)
   * - '/path/to/index.ts' -> TypeScript source (requires tsx)
   * - 'bun:/path/to/cli.js' -> Force Bun runtime
   * - 'node:/path/to/cli.js' -> Force Node.js runtime
   * - 'tsx:/path/to/index.ts' -> Force tsx runtime
   * - 'deno:/path/to/cli.ts' -> Force Deno runtime
   *
   * If not provided, the SDK will auto-detect the native binary in this order:
   * 1. QWEN_CODE_CLI_PATH environment variable
   * 2. ~/.volta/bin/qwen
   * 3. ~/.npm-global/bin/qwen
   * 4. /usr/local/bin/qwen
   * 5. ~/.local/bin/qwen
   * 6. ~/node_modules/.bin/qwen
   * 7. ~/.yarn/bin/qwen
   *
   * The .ts files are only supported for debugging purposes.
   *
   * @example 'qwen'
   * @example '/usr/local/bin/qwen'
   * @example 'tsx:/path/to/packages/cli/src/index.ts'
   */
  pathToQwenExecutable?: string;

  /**
   * Environment variables to pass to the Qwen CLI process.
   * These variables will be merged with the current process environment.
   */
  env?: Record<string, string>;

  /**
   * Permission mode controlling how the SDK handles tool execution approval.
   *
   * - 'default': Write tools are denied unless approved via `canUseTool` callback or in `allowedTools`.
   *   Read-only tools execute without confirmation.
   * - 'plan': Blocks all write tools, instructing AI to present a plan first.
   *   Read-only tools execute normally.
   * - 'auto-edit': Auto-approve edit tools (edit, write_file) while other tools require confirmation.
   * - 'yolo': All tools execute automatically without confirmation.
   *
   * **Priority Chain (highest to lowest):**
   * 1. `excludeTools` - Blocks tools completely (returns permission error)
   * 2. `permissionMode: 'plan'` - Blocks non-read-only tools (except exit_plan_mode)
   * 3. `permissionMode: 'yolo'` - Auto-approves all tools
   * 4. `allowedTools` - Auto-approves matching tools
   * 5. `canUseTool` callback - Custom approval logic
   * 6. Default behavior - Auto-deny in SDK mode
   *
   * @default 'default'
   * @see canUseTool For custom permission handling
   * @see allowedTools For auto-approving specific tools
   * @see excludeTools For blocking specific tools
   */
  permissionMode?: 'default' | 'plan' | 'auto-edit' | 'yolo';

  /**
   * Custom permission handler for tool execution approval.
   *
   * This callback is invoked when a tool requires confirmation and allows you to
   * programmatically approve or deny execution. It acts as a fallback after
   * `allowedTools` check but before default denial.
   *
   * **When is this called?**
   * - Only for tools requiring confirmation (write operations, shell commands, etc.)
   * - After `excludeTools` and `allowedTools` checks
   * - Not called in 'yolo' mode or 'plan' mode
   * - Not called for tools already in `allowedTools`
   *
   * **Usage with permissionMode:**
   * - 'default': Invoked for all write tools not in `allowedTools`; if not provided, auto-denied.
   * - 'auto-edit': Invoked for non-edit tools (edit/write_file auto-approved); if not provided, auto-denied.
   * - 'plan': Not invoked; write tools are blocked by plan mode.
   * - 'yolo': Not invoked; all tools auto-approved.
   *
   * @see allowedTools For auto-approving tools without callback
   */
  canUseTool?: CanUseTool;

  /**
   * External MCP (Model Context Protocol) servers to connect to.
   * Each server is identified by a unique name and configured with command, args, and environment.
   * @example { 'my-server': { command: 'node', args: ['server.js'], env: { PORT: '3000' } } }
   */
  mcpServers?: Record<string, ExternalMcpServerConfig>;

  /**
   * AbortController to cancel the query session.
   * Call abortController.abort() to terminate the session and cleanup resources.
   * Remember to handle the AbortError when the session is aborted.
   */
  abortController?: AbortController;

  /**
   * Enable debug mode for verbose logging.
   * When true, additional diagnostic information will be output.
   * Use this with `logLevel` to control the verbosity of the logs.
   * @default false
   */
  debug?: boolean;

  /**
   * Custom handler for stderr output from the Qwen CLI process.
   * Use this to capture and process error messages or diagnostic output.
   */
  stderr?: (message: string) => void;

  /**
   * Logging level for the SDK.
   * Controls the verbosity of log messages output by the SDK.
   * @default 'info'
   */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';

  /**
   * Maximum number of conversation turns before the session automatically terminates.
   * A turn consists of a user message and an assistant response.
   * @default -1 (unlimited)
   */
  maxSessionTurns?: number;

  /**
   * Equivalent to `tool.core` in settings.json.
   * List of core tools to enable for the session.
   * If specified, only these tools will be available to the AI.
   * @example ['read_file', 'write_file', 'run_terminal_cmd']
   */
  coreTools?: string[];

  /**
   * Equivalent to `tool.exclude` in settings.json.
   * List of tools to exclude from the session.
   *
   * **Behavior:**
   * - Excluded tools return a permission error immediately when invoked
   * - Takes highest priority - overrides all other permission settings
   * - Tools will not be available to the AI, even if in `coreTools` or `allowedTools`
   *
   * **Pattern matching:**
   * - Tool name: `'write_file'`, `'run_shell_command'`
   * - Tool class: `'WriteTool'`, `'ShellTool'`
   * - Shell command prefix: `'ShellTool(git commit)'` (matches commands starting with "git commit")
   *
   * @example ['run_terminal_cmd', 'delete_file', 'ShellTool(rm )']
   * @see allowedTools For allowing specific tools
   */
  excludeTools?: string[];

  /**
   * Equivalent to `tool.allowed` in settings.json.
   * List of tools that are allowed to run without confirmation.
   *
   * **Behavior:**
   * - Matching tools bypass `canUseTool` callback and execute automatically
   * - Only applies when tool requires confirmation (write operations, shell commands)
   * - Checked after `excludeTools` but before `canUseTool` callback
   * - Does not override `permissionMode: 'plan'` (plan mode blocks all write tools)
   * - Has no effect in `permissionMode: 'yolo'` (already auto-approved)
   *
   * **Pattern matching:**
   * - Tool name: `'write_file'`, `'run_shell_command'`
   * - Tool class: `'WriteTool'`, `'ShellTool'`
   * - Shell command prefix: `'ShellTool(git status)'` (matches commands starting with "git status")
   *
   * **Use cases:**
   * - Auto-approve safe shell commands: `['ShellTool(git status)', 'ShellTool(ls)']`
   * - Auto-approve specific tools: `['write_file', 'edit']`
   * - Combine with `permissionMode: 'default'` to selectively auto-approve tools
   *
   * @example ['read_file', 'ShellTool(git status)', 'ShellTool(npm test)']
   * @see canUseTool For custom approval logic
   * @see excludeTools For blocking specific tools
   */
  allowedTools?: string[];

  /**
   * Authentication type for the AI service.
   * - 'openai': Use OpenAI-compatible authentication
   * - 'qwen-oauth': Use Qwen OAuth authentication
   *
   * Though we support 'qwen-oauth', it's not recommended to use it in the SDK.
   * Because the credentials are stored in `~/.papert` and may need to refresh periodically.
   */
  authType?: 'openai' | 'qwen-oauth';

  /**
   * Configuration for subagents that can be invoked during the session.
   * Subagents are specialized AI agents that can handle specific tasks or domains.
   * The invocation is marked as a `task` tool use with the name of agent and a tool_use_id.
   * The tool use of these agent is marked with the parent_tool_use_id of the `task` tool use.
   */
  agents?: SubagentConfig[];

  /**
   * Include partial messages in the response stream.
   * When true, the SDK will emit incomplete messages as they are being generated,
   * allowing for real-time streaming of the AI's response.
   * @default false
   */
  includePartialMessages?: boolean;
}
