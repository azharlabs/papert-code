# @papert-code/sdk-typescript

A minimum experimental TypeScript SDK for programmatic access to Papert Code.

Feel free to submit a feature request/issue/PR.

## What’s inside

- Streaming `query` API (multi-turn, tool-aware) for embedding the agent.
- Programmatic CLI wrapper (`createPapertAgent`) to drive the full CLI/core end-to-end.
- Permission controls (plan/default/auto-edit/yolo), custom tool approvals, and MCP server support.
- Ready-made examples under `packages/sdk-typescript/examples` (TS + JS/ESM).

## Installation

```bash
npm install @papert-code/sdk-typescript
```

## Requirements

- Node.js >= 20.0.0
- [Qwen Code](https://github.com/azharlabs/papert-code) installed and accessible in PATH

> **Note for nvm users**: If you use nvm to manage Node.js versions, the SDK may not be able to auto-detect the Qwen Code executable. You should explicitly set the `pathToQwenExecutable` option to the full path of the `qwen` binary.

## Quick Start (streaming)

```typescript
import { query } from '@papert-code/sdk-typescript';

// Single-turn query
const result = query({
  prompt: 'What files are in the current directory?',
  options: {
    cwd: '/path/to/project',
  },
});

// Iterate over messages
for await (const message of result) {
  if (message.type === 'assistant') {
    console.log('Assistant:', message.message.content);
  } else if (message.type === 'result') {
    console.log('Result:', message.result);
  }
}
```

## Quick Start (full CLI agent)

Drive the CLI/core as a subprocess while setting model/base URL/API key programmatically.

```typescript
import { createPapertAgent } from '@papert-code/sdk-typescript';

const agent = await createPapertAgent({
  cliArgs: {
    model: 'gpt-4o-mini', // or your provider model id
    approvalMode: 'auto-edit', // plan | default | auto-edit | yolo
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: 'https://api.openai.com/v1', // optional for compatible APIs
    // cliBinaryPath: '/abs/path/to/cli/dist/index.js', // optional override
  },
});

const { stdout, stderr, exitCode } = await agent.runPrompt(
  'Summarize outstanding TODOs',
  { extraArgs: ['--output-format', 'json'] }, // per-call flags
);
```

### Run the baked examples (no ts-node needed)

```bash
npm run build                         # ensure cli/dist exists
export OPENAI_API_KEY="your_key"
node packages/sdk-typescript/examples/basic-run.mjs
node packages/sdk-typescript/examples/custom-endpoint.mjs
node packages/sdk-typescript/examples/abort-run.mjs
node packages/sdk-typescript/examples/bad-key.mjs
```

## API Reference

### `query(config)`

Creates a new query session with the Qwen Code.

#### Parameters

- `prompt`: `string | AsyncIterable<SDKUserMessage>` - The prompt to send. Use a string for single-turn queries or an async iterable for multi-turn conversations.
- `options`: `QueryOptions` - Configuration options for the query session.

#### QueryOptions

| Option                   | Type                                           | Default          | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------ | ---------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cwd`                    | `string`                                       | `process.cwd()`  | The working directory for the query session. Determines the context in which file operations and commands are executed.                                                                                                                                                                                                                                                                                                                                                               |
| `model`                  | `string`                                       | -                | The AI model to use (e.g., `'qwen-max'`, `'qwen-plus'`, `'qwen-turbo'`). Takes precedence over `OPENAI_MODEL` and `QWEN_MODEL` environment variables.                                                                                                                                                                                                                                                                                                                                 |
| `pathToQwenExecutable`   | `string`                                       | Auto-detected    | Path to the Qwen Code executable. Supports multiple formats: `'qwen'` (native binary from PATH), `'/path/to/qwen'` (explicit path), `'/path/to/cli.js'` (Node.js bundle), `'node:/path/to/cli.js'` (force Node.js runtime), `'bun:/path/to/cli.js'` (force Bun runtime). If not provided, auto-detects from: `QWEN_CODE_CLI_PATH` env var, `~/.volta/bin/qwen`, `~/.npm-global/bin/qwen`, `/usr/local/bin/qwen`, `~/.local/bin/qwen`, `~/node_modules/.bin/qwen`, `~/.yarn/bin/qwen`. |
| `permissionMode`         | `'default' \| 'plan' \| 'auto-edit' \| 'yolo'` | `'default'`      | Permission mode controlling tool execution approval. See [Permission Modes](#permission-modes) for details.                                                                                                                                                                                                                                                                                                                                                                           |
| `canUseTool`             | `CanUseTool`                                   | -                | Custom permission handler for tool execution approval. Invoked when a tool requires confirmation. Must respond within 30 seconds or the request will be auto-denied. See [Custom Permission Handler](#custom-permission-handler).                                                                                                                                                                                                                                                     |
| `env`                    | `Record<string, string>`                       | -                | Environment variables to pass to the Qwen Code process. Merged with the current process environment.                                                                                                                                                                                                                                                                                                                                                                                  |
| `mcpServers`             | `Record<string, ExternalMcpServerConfig>`      | -                | External MCP (Model Context Protocol) servers to connect. Each server is identified by a unique name and configured with `command`, `args`, and `env`.                                                                                                                                                                                                                                                                                                                                |
| `abortController`        | `AbortController`                              | -                | Controller to cancel the query session. Call `abortController.abort()` to terminate the session and cleanup resources.                                                                                                                                                                                                                                                                                                                                                                |
| `debug`                  | `boolean`                                      | `false`          | Enable debug mode for verbose logging from the CLI process.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `maxSessionTurns`        | `number`                                       | `-1` (unlimited) | Maximum number of conversation turns before the session automatically terminates. A turn consists of a user message and an assistant response.                                                                                                                                                                                                                                                                                                                                        |
| `coreTools`              | `string[]`                                     | -                | Equivalent to `tool.core` in settings.json. If specified, only these tools will be available to the AI. Example: `['read_file', 'write_file', 'run_terminal_cmd']`.                                                                                                                                                                                                                                                                                                                   |
| `excludeTools`           | `string[]`                                     | -                | Equivalent to `tool.exclude` in settings.json. Excluded tools return a permission error immediately. Takes highest priority over all other permission settings. Supports pattern matching: tool name (`'write_file'`), tool class (`'ShellTool'`), or shell command prefix (`'ShellTool(rm )'`).                                                                                                                                                                                      |
| `allowedTools`           | `string[]`                                     | -                | Equivalent to `tool.allowed` in settings.json. Matching tools bypass `canUseTool` callback and execute automatically. Only applies when tool requires confirmation. Supports same pattern matching as `excludeTools`.                                                                                                                                                                                                                                                                 |
| `authType`               | `'openai' \| 'qwen-oauth'`                     | `'openai'`       | Authentication type for the AI service. Using `'qwen-oauth'` in SDK is not recommended as credentials are stored in `~/.papert` and may need periodic refresh.                                                                                                                                                                                                                                                                                                                        |
| `agents`                 | `SubagentConfig[]`                             | -                | Configuration for subagents that can be invoked during the session. Subagents are specialized AI agents for specific tasks or domains.                                                                                                                                                                                                                                                                                                                                                |
| `includePartialMessages` | `boolean`                                      | `false`          | When `true`, the SDK emits incomplete messages as they are being generated, allowing real-time streaming of the AI's response.                                                                                                                                                                                                                                                                                                                                                        |

### Timeouts

The SDK enforces the following timeouts:

| Timeout             | Duration   | Description                                                                                                                  |
| ------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Permission Callback | 30 seconds | Maximum time for `canUseTool` callback to respond. If exceeded, the tool request is auto-denied.                             |
| Control Request     | 30 seconds | Maximum time for control operations like `initialize()`, `setModel()`, `setPermissionMode()`, and `interrupt()` to complete. |

### Message Types

The SDK provides type guards to identify different message types:

```typescript
import {
  isSDKUserMessage,
  isSDKAssistantMessage,
  isSDKSystemMessage,
  isSDKResultMessage,
  isSDKPartialAssistantMessage,
} from '@papert-code/sdk-typescript';

for await (const message of result) {
  if (isSDKAssistantMessage(message)) {
    // Handle assistant message
  } else if (isSDKResultMessage(message)) {
    // Handle result message
  }
}
```

### Query Instance Methods

The `Query` instance returned by `query()` provides several methods:

```typescript
const q = query({ prompt: 'Hello', options: {} });

// Get session ID
const sessionId = q.getSessionId();

// Check if closed
const closed = q.isClosed();

// Interrupt the current operation
await q.interrupt();

// Change permission mode mid-session
await q.setPermissionMode('yolo');

// Change model mid-session
await q.setModel('qwen-max');

// Close the session
await q.close();
```

## Permission Modes

The SDK supports different permission modes for controlling tool execution:

- **`default`**: Write tools are denied unless approved via `canUseTool` callback or in `allowedTools`. Read-only tools execute without confirmation.
- **`plan`**: Blocks all write tools, instructing AI to present a plan first.
- **`auto-edit`**: Auto-approve edit tools (edit, write_file) while other tools require confirmation.
- **`yolo`**: All tools execute automatically without confirmation.

### Permission Priority Chain

1. `excludeTools` - Blocks tools completely
2. `permissionMode: 'plan'` - Blocks non-read-only tools
3. `permissionMode: 'yolo'` - Auto-approves all tools
4. `allowedTools` - Auto-approves matching tools
5. `canUseTool` callback - Custom approval logic
6. Default behavior - Auto-deny in SDK mode

## Examples

### Multi-turn Conversation

```typescript
import { query, type SDKUserMessage } from '@papert-code/sdk-typescript';

async function* generateMessages(): AsyncIterable<SDKUserMessage> {
  yield {
    type: 'user',
    session_id: 'my-session',
    message: { role: 'user', content: 'Create a hello.txt file' },
    parent_tool_use_id: null,
  };

  // Wait for some condition or user input
  yield {
    type: 'user',
    session_id: 'my-session',
    message: { role: 'user', content: 'Now read the file back' },
    parent_tool_use_id: null,
  };
}

const result = query({
  prompt: generateMessages(),
  options: {
    permissionMode: 'auto-edit',
  },
});

for await (const message of result) {
  console.log(message);
}
```

### Custom Permission Handler

```typescript
import { query, type CanUseTool } from '@papert-code/sdk-typescript';

const canUseTool: CanUseTool = async (toolName, input, { signal }) => {
  // Allow all read operations
  if (toolName.startsWith('read_')) {
    return { behavior: 'allow', updatedInput: input };
  }

  // Prompt user for write operations (in a real app)
  const userApproved = await promptUser(`Allow ${toolName}?`);

  if (userApproved) {
    return { behavior: 'allow', updatedInput: input };
  }

  return { behavior: 'deny', message: 'User denied the operation' };
};

const result = query({
  prompt: 'Create a new file',
  options: {
    canUseTool,
  },
});
```

### With MCP Servers

```typescript
import { query } from '@papert-code/sdk-typescript';

const result = query({
  prompt: 'Use the custom tool from my MCP server',
  options: {
    mcpServers: {
      'my-server': {
        command: 'node',
        args: ['path/to/mcp-server.js'],
        env: { PORT: '3000' },
      },
    },
  },
});
```

### Abort a Query

```typescript
import { query, isAbortError } from '@papert-code/sdk-typescript';

const abortController = new AbortController();

const result = query({
  prompt: 'Long running task...',
  options: {
    abortController,
  },
});

// Abort after 5 seconds
setTimeout(() => abortController.abort(), 5000);

try {
  for await (const message of result) {
    console.log(message);
  }
} catch (error) {
  if (isAbortError(error)) {
    console.log('Query was aborted');
  } else {
    throw error;
  }
}
```

## Error Handling

The SDK provides an `AbortError` class for handling aborted queries:

```typescript
import { AbortError, isAbortError } from '@papert-code/sdk-typescript';

try {
  // ... query operations
} catch (error) {
  if (isAbortError(error)) {
    // Handle abort
  } else {
    // Handle other errors
  }
}
```

## License

Apache-2.0 - see [LICENSE](./LICENSE) for details.
