# TypeScript SDK

The Papert Code TypeScript SDK lets you embed Papert CLI with:

- low-level streaming via `query()`
- high-level reusable sessions via `createClient()`
- full subprocess control via `createPapertAgent()`

## Install

```bash
npm install @papert-code/sdk-typescript
```

The SDK package includes `@papert-code/papert-code` as a dependency so users do
not need to install the CLI package separately for standard SDK usage.

## Requirements

- Node.js >= 18
- Optional: system `papert` install if you want to override the bundled CLI

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

## Quick start: reusable sessions

```ts
import { createClient } from '@papert-code/sdk-typescript';

const client = createClient({
  cwd: '/path/to/repo',
  permissionMode: 'auto-edit',
});

const session = client.createSession({ sessionId: 'demo-session' });
await session.send('Create TODO.md with 3 items');
await session.send('Now summarize TODO.md');
await client.close();
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

## Runtime subagents example

```ts
import { query, type SubagentConfig } from '@papert-code/sdk-typescript';

const agents: SubagentConfig[] = [
  {
    name: 'test-architect',
    description: 'Creates robust deterministic tests',
    systemPrompt: 'You are a test specialist.',
    tools: ['read_file', 'write_file', 'run_shell_command'],
    modelConfig: { model: 'gpt-4o-mini', temp: 0.1 },
    runConfig: { max_time_minutes: 10, max_turns: 12 },
    level: 'session',
  },
];

const result = query({
  prompt: 'Use `test-architect` to improve checkout test coverage.',
  options: {
    cwd: '/path/to/project',
    agents,
  },
});
```

## Client Session API

- `createClient(options?)`
- `client.createSession({ sessionId?, options? })`
- `client.getSession(sessionId)`
- `client.close()`
- `session.stream(prompt, options?)`
- `session.send(prompt, options?)`
- `session.close()`
- `session.getSessionId()`

## Multi-agent, Skills, and `.papert` Full Guide

Detailed guide with complete examples:

- [TypeScript SDK Multi-agent & Skills](./sdk-typescript-multi-agent-skills.md)

## Notes

- Build and bundle from monorepo: `npm run build && npm run bundle:cli`
- To force a CLI binary, set `pathToPapertExecutable` or `PAPERT_CODE_CLI_PATH`
- `session.send()` is best for request/response flows; `session.stream()` for live streaming
- Remote daemon/client docs are here: [Remote Driving](./remote-driving.md)
