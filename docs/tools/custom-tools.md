---
title: Custom tools
---

# Custom tools (local folder)

Papert Code can load custom tools directly from your filesystem without requiring an MCP server. This is useful for simple automation or project-specific helpers that you want the model to call.

## Where to place tools

Custom tool definitions are discovered from these directories:

- **Project (trusted only):** `.papert/tools/` or `.papert/tool/` inside your project root.
- **Global (always):** `~/.papert/tools/` or `~/.papert/tool/`.

If the workspace is **untrusted**, project-level custom tools are **not** loaded. Global tools are still available.

## Tool file format

Each tool is defined in a JavaScript/TypeScript module that exports a tool definition object.

Supported extensions:

- `.js`, `.mjs`, `.cjs`
- `.ts`, `.tsx` (requires running Papert Code with a TypeScript loader such as `node --import tsx` during development)

### Minimal tool definition

```js
// .papert/tools/hello.mjs
export default {
  description: 'Say hello',
  args: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Name to greet' },
    },
    required: ['name'],
  },
  execute: ({ name }) => `Hello ${name}!`,
};
```

The **filename** becomes the **tool name**. The above creates a `hello` tool.

## Multiple tools per file

If you export multiple tool definitions, each export becomes a separate tool named `<filename>_<exportName>`.

```js
// .papert/tools/math.mjs
export const add = {
  description: 'Add two numbers',
  args: {
    type: 'object',
    properties: {
      a: { type: 'number' },
      b: { type: 'number' },
    },
    required: ['a', 'b'],
  },
  execute: ({ a, b }) => a + b,
};

export const multiply = {
  description: 'Multiply two numbers',
  args: {
    type: 'object',
    properties: {
      a: { type: 'number' },
      b: { type: 'number' },
    },
    required: ['a', 'b'],
  },
  execute: ({ a, b }) => a * b,
};
```

This creates `math_add` and `math_multiply`.

## Parameter schema

Papert Code expects a **JSON Schema** object. You can provide it using any of these keys (in priority order):

1. `parametersJsonSchema`
2. `parameters`
3. `args`

Example:

```js
export default {
  description: 'Echo text',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      text: { type: 'string' },
    },
    required: ['text'],
  },
  execute: ({ text }) => text,
};
```

## Execution context

The `execute` function receives a second argument with runtime context:

```js
export default {
  description: 'Show context',
  args: { type: 'object', properties: {} },
  execute: (_args, ctx) => {
    return [
      `toolName=${ctx.toolName}`,
      `sessionId=${ctx.sessionId}`,
      `projectRoot=${ctx.projectRoot}`,
    ].join('\n');
  },
};
```

Context fields:

- `config`: Papert Code config instance
- `toolName`: resolved tool name
- `toolPath`: full path to the tool file
- `toolDirectory`: directory containing the tool file
- `projectRoot`: workspace root
- `workspaceContext`: resolved workspace metadata
- `sessionId`: current session identifier
- `abortSignal`: abort signal for cancellation

## Return values

Your `execute` function can return:

- `string` (shown to the model and user)
- `number`, `boolean`, `object`, `array` (JSON stringified)
- `ToolResult` for full control (advanced)

## Example: wrapping a Python script

```python
# .papert/tools/add.py
import sys

a = int(sys.argv[1])
b = int(sys.argv[2])
print(a + b)
```

```js
// .papert/tools/python-add.mjs
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export default {
  description: 'Add two numbers using Python',
  args: {
    type: 'object',
    properties: {
      a: { type: 'number' },
      b: { type: 'number' },
    },
    required: ['a', 'b'],
  },
  async execute({ a, b }) {
    const { stdout } = await execFileAsync('python3', [
      '.papert/tools/add.py',
      String(a),
      String(b),
    ]);
    return stdout.trim();
  },
};
```

## Testing the feature

1. Create `.papert/tools/hello.mjs` as shown above.
2. Run Papert Code in the project root.
3. Prompt: “Use the `hello` tool to greet Ada.”
4. Confirm the tool call when prompted.

You can list all available tools via `/tools` (or `/tools desc` for descriptions).
