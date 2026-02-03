# TypeScript SDK

The Papert Code TypeScript SDK lets you run the CLI as a subprocess and stream
messages programmatically. It also bundles a CLI build so you do not need a
separate CLI install for most SDK use cases.

## Install

```bash
npm install @papert-code/sdk-typescript
```

## Requirements

- Node.js >= 18
- Optional: a system `papert` install if you want to override the bundled CLI

## Bundled CLI behavior

The SDK package ships a bundled CLI at `dist/cli/cli.js`. By default, the SDK
uses this bundled CLI. You can override it by setting:

- `pathToPapertExecutable` in `query()`
- `cliBinaryPath` in `createPapertAgent()`
- `PAPERT_CODE_CLI_PATH` environment variable

## Quick start: streaming query

```ts
import { query } from '@papert-code/sdk-typescript';

const result = query({
  prompt: 'List the top-level folders in this repo',
  options: { cwd: '/path/to/repo' },
});

for await (const message of result) {
  if (message.type === 'assistant') {
    console.log(message.message.content);
  }
}
```

## Quick start: full CLI agent

```ts
import { createPapertAgent } from '@papert-code/sdk-typescript';

const agent = await createPapertAgent({
  cliArgs: {
    model: 'gpt-4o-mini',
    approvalMode: 'auto-edit',
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: 'https://api.openai.com/v1',
  },
});

const result = await agent.runPrompt('Summarize outstanding TODOs', {
  extraArgs: ['--output-format', 'json'],
});

console.log(result.stdout);
```

## Sample scripts (copy/paste)

### 1) Multi-turn conversation

```ts
import { query, type SDKUserMessage } from '@papert-code/sdk-typescript';

async function* messages(): AsyncIterable<SDKUserMessage> {
  yield {
    type: 'user',
    session_id: 'demo-session',
    message: { role: 'user', content: 'Create a hello.txt file' },
    parent_tool_use_id: null,
  };

  yield {
    type: 'user',
    session_id: 'demo-session',
    message: { role: 'user', content: 'Now read the file back' },
    parent_tool_use_id: null,
  };
}

const result = query({
  prompt: messages(),
  options: { permissionMode: 'auto-edit' },
});

for await (const message of result) {
  console.log(message);
}
```

### 2) Custom permission handler

```ts
import { query, type CanUseTool } from '@papert-code/sdk-typescript';

const canUseTool: CanUseTool = async (toolName, input) => {
  if (toolName.startsWith('read_')) {
    return { behavior: 'allow', updatedInput: input };
  }

  const approved = true; // replace with your own approval UI
  return approved
    ? { behavior: 'allow', updatedInput: input }
    : { behavior: 'deny', message: 'User denied the operation' };
};

const result = query({
  prompt: 'Create a new file',
  options: { canUseTool },
});

for await (const message of result) {
  console.log(message);
}
```

### 3) MCP server integration

```ts
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

for await (const message of result) {
  console.log(message);
}
```

### 4) Abort a running query

```ts
import { query, isAbortError } from '@papert-code/sdk-typescript';

const abortController = new AbortController();

const result = query({
  prompt: 'Long running task...',
  options: { abortController },
});

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

### 5) Remote driving control-plane request

```ts
import { createClient } from '@papert-code/sdk-typescript';

async function run() {
  const client = await createClient({
    url: 'http://HOST:41242',
    token: process.env.PAPERT_REMOTE_SERVER_TOKEN,
  });

  const list = await client.control({
    subtype: 'scheduler_list',
    cwd: '/path/to/project',
    include_disabled: true,
  });

  console.log(list);
  await client.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

## Notes

- When running from the monorepo, build the SDK and bundle the CLI:
  `npm run build && npm run bundle:cli` (from `packages/sdk-typescript`).
- If you want to use a specific CLI binary, set `pathToPapertExecutable` or
  `PAPERT_CODE_CLI_PATH`.
