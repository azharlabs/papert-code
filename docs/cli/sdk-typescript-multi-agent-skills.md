# TypeScript SDK: Multi-agent, Skills, and `.papert` Playbook

This guide shows complete TypeScript SDK usage for:

- `.papert` project setup
- skills and subagents
- targeting a specific subagent
- runtime subagent injection (`options.agents`)
- reusable SDK sessions via `createClient`

## 1) Recommended `.papert` layout

```text
your-project/
  .papert/
    settings.json
    agents/
      orchestrator.md
      code-reviewer.md
      debugger.md
    skills/
      api-design/
        SKILL.md
      test-design/
        SKILL.md
    commands/
      review.md
    hooks/
      hooks.json
    plugins/
      hook-demo.mjs
```

## 2) Minimal `.papert/settings.json`

```json
{
  "$version": 2,
  "model": {
    "name": "gpt-4o-mini",
    "maxSessionTurns": 30
  },
  "context": {
    "fileFiltering": {
      "respectGitIgnore": true,
      "respectPapertIgnore": true
    }
  }
}
```

## 3) Subagent file format

Create `your-project/.papert/agents/code-reviewer.md`:

```markdown
---
name: code-reviewer
description: Reviews code for bugs, risks, and missing tests.
tools:
  - read_file
  - read_many_files
systemPrompt: |
  You are a senior code reviewer.
  Focus on regressions and test gaps.
modelConfig:
  model: gpt-4o-mini
  temp: 0.1
runConfig:
  max_time_minutes: 10
  max_turns: 12
---
```

## 4) Skill file format

Create `your-project/.papert/skills/api-design/SKILL.md`:

```markdown
# API Design Skill

When asked to design APIs:
1. Start with OpenAPI.
2. Add request/response examples.
3. Include validation and error responses.
```

## 5) High-level client with reusable sessions

```ts
import { createClient } from '@papert-code/sdk-typescript';

async function main() {
  const client = createClient({
    cwd: '/absolute/path/to/your-project',
    model: 'gpt-4o-mini',
    permissionMode: 'default',
  });

  const session = client.createSession({ sessionId: 'demo-session' });

  const first = await session.send('Summarize this repository structure.');
  const second = await session.send('Now focus only on test strategy.');

  console.log(first.length, second.length);
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

## 6) Use a specific subagent

```ts
import { createClient } from '@papert-code/sdk-typescript';

async function main() {
  const client = createClient({ cwd: '/absolute/path/to/your-project' });
  const session = client.createSession();

  await session.send(
    'Use subagent `code-reviewer` to review packages/core/src/tools for P0/P1 issues.',
  );

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

## 7) Inject runtime subagents from SDK

```ts
import { query, type SubagentConfig } from '@papert-code/sdk-typescript';

const runtimeAgents: SubagentConfig[] = [
  {
    name: 'test-architect',
    description: 'Designs deterministic high-value tests',
    systemPrompt: 'You are a test specialist. Prefer deterministic tests.',
    tools: ['read_file', 'write_file', 'run_shell_command'],
    modelConfig: { model: 'gpt-4o-mini', temp: 0.1 },
    runConfig: { max_time_minutes: 8, max_turns: 10 },
    level: 'session',
  },
];

async function main() {
  const result = query({
    prompt: 'Use `test-architect` to improve auth test coverage.',
    options: {
      cwd: '/absolute/path/to/your-project',
      agents: runtimeAgents,
    },
  });

  for await (const message of result) {
    if (message.type === 'result') {
      console.log('done');
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

## 8) Use specific skills directories

```ts
import { query } from '@papert-code/sdk-typescript';

const result = query({
  prompt: 'Apply the API design skill to propose v2 endpoints.',
  options: {
    cwd: '/absolute/path/to/your-project',
    skillsPath: [
      '/absolute/path/to/your-project/.papert/skills',
      '/absolute/path/to/company-shared-skills',
    ],
  },
});
```

## 9) Multi-agent orchestration prompt pattern

```text
Use `orchestrator` to coordinate:
1) debugger on failing checkout tests
2) test-architect to add/fix tests
3) docs-writer to update TESTING.md
Return final summary with changed files and residual risks.
```

## 10) Troubleshooting

- Subagent is not used:
  - Ensure `.papert/agents/<name>.md` exists
  - Ensure `name` in frontmatter matches the name in prompt
  - Use explicit phrasing: "Use subagent `<name>` now"
- Skills are not loaded:
  - Ensure each skill has `SKILL.md`
  - Pass `skillsPath` when using non-default locations
- Wrong project context:
  - Set `options.cwd` to the project root containing `.papert`

