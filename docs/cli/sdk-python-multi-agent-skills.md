# Python SDK: Multi-agent, Skills, and `.papert` Playbook

This guide shows how to use the Python SDK with:

- Project-level `.papert` configuration
- Skills
- Subagents
- Multi-agent orchestration
- Runtime session agents (`options.agents`)

It is designed as a practical "copy, run, adapt" reference.

## 1) Recommended `.papert` structure

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
      scripts/
        validate-prompt.py
    plugins/
      hook-demo.mjs
    tools/
      context-info.mjs
```

What each folder is for:

- `.papert/settings.json`: project defaults (model, tools, hooks, plugins, MCP)
- `.papert/agents/`: reusable subagents (Markdown + frontmatter)
- `.papert/skills/`: reusable skill instructions (`SKILL.md`)
- `.papert/commands/`: custom slash commands
- `.papert/hooks/`: lifecycle hooks and scripts
- `.papert/plugins/`: in-process JavaScript plugins
- `.papert/tools/`: local custom tools

## 2) Minimal `settings.json` starter

Create `your-project/.papert/settings.json`:

```json
{
  "$version": 2,
  "model": {
    "name": "gpt-4o-mini",
    "maxSessionTurns": 30
  },
  "tools": {
    "enableHooks": true
  },
  "context": {
    "fileFiltering": {
      "respectGitIgnore": true,
      "respectPapertIgnore": true
    }
  }
}
```

## 3) Define subagents in `.papert/agents`

Subagent file format:

```markdown
---
name: code-reviewer
description: Reviews code for correctness, maintainability, and risks.
tools:
  - read_file
  - read_many_files
systemPrompt: |
  You are a senior code reviewer.
  Focus on bugs, regressions, and missing tests.
modelConfig:
  model: gpt-4o-mini
  temp: 0.1
runConfig:
  max_time_minutes: 10
  max_turns: 12
---
```

Notes:

- `name`, `description`, and `systemPrompt` are required.
- `tools`, `modelConfig`, `runConfig`, and `color` are optional.
- Project-level subagents in `.papert/agents` override user-level subagents in `~/.papert/agents`.

## 4) Define skills in `.papert/skills`

Create `your-project/.papert/skills/api-design/SKILL.md`:

```markdown
# API Design Skill

When asked to design or update APIs:
1. Write OpenAPI spec first.
2. Add request/response examples.
3. Include validation and error codes.
4. Add migration notes for breaking changes.
```

You can add many skills under `.papert/skills/<skill-name>/SKILL.md`.

## 5) Python SDK quick start (project-aware)

```python
import asyncio
from papert_code_sdk import create_client

async def main():
    client = create_client(
        {
            "cwd": "/absolute/path/to/your-project",
            "permissionMode": "default",
            "model": "gpt-4o-mini"
        }
    )

    session = client.create_session(session_id="demo-session")
    messages = await session.send("Summarize this repo architecture.")
    print(f"Received {len(messages)} messages")
    await client.close()

asyncio.run(main())
```

## 6) Use a particular subagent

If the subagent exists in `.papert/agents/code-reviewer.md`, call it explicitly in your prompt:

```python
import asyncio
from papert_code_sdk import create_client

async def main():
    client = create_client({"cwd": "/absolute/path/to/your-project"})
    session = client.create_session()

    await session.send(
        "Use the `code-reviewer` subagent to review auth changes in src/auth."
    )
    await client.close()

asyncio.run(main())
```

For strongest routing, use explicit wording:

- "Use subagent `code-reviewer`"
- "Delegate this task to `debugger` subagent"

## 7) Inject subagents at runtime (session-only agents)

You can provide agents directly in SDK options without creating files:

```python
import asyncio
from papert_code_sdk import query

runtime_agents = [
    {
        "name": "test-architect",
        "description": "Designs high-value tests and edge-case coverage",
        "systemPrompt": "You are a testing specialist. Prefer deterministic tests.",
        "tools": ["read_file", "write_file", "run_shell_command"],
        "modelConfig": {"model": "gpt-4o-mini", "temp": 0.1},
        "runConfig": {"max_time_minutes": 8, "max_turns": 10}
    },
    {
        "name": "docs-writer",
        "description": "Writes concise developer documentation",
        "systemPrompt": "You produce practical docs with verified commands.",
        "tools": ["read_file", "write_file", "read_many_files"]
    }
]

async def main():
    q = query(
        prompt="Use `test-architect` to add tests, then `docs-writer` to update README.",
        options={
            "cwd": "/absolute/path/to/your-project",
            "agents": runtime_agents
        }
    )
    async for msg in q:
        if msg.type == "result":
            print("Done")

asyncio.run(main())
```

This is useful for API servers that create short-lived, dynamic subagent sets per request.

## 8) Use a particular skill directory

If you keep skills outside the project folder, pass them explicitly:

```python
from papert_code_sdk import query

q = query(
    prompt="Apply the API design skill to create v2 user endpoints.",
    options={
        "cwd": "/absolute/path/to/your-project",
        "skillsPath": [
            "/absolute/path/to/your-project/.papert/skills",
            "/absolute/path/to/company-shared-skills"
        ]
    }
)
```

You can also use `skillsPaths` or `skills_path`.

## 9) Multi-agent orchestration pattern

A practical pattern:

1. `orchestrator` plans.
2. `debugger` investigates failures.
3. `test-architect` adds/updates tests.
4. `docs-writer` updates docs.
5. Main agent verifies and summarizes.

Prompt example:

```text
Use `orchestrator` subagent to coordinate this workflow:
1) debugger on failing checkout tests
2) test-architect to fix/add tests
3) docs-writer to update TESTING.md
Return a final summary with files changed and remaining risks.
```

## 10) End-to-end "everything in `.papert`" example

```python
import asyncio
from papert_code_sdk import create_client

async def main():
    client = create_client(
        {
            "cwd": "/absolute/path/to/your-project",
            "permissionMode": "auto-edit",
            "model": "gpt-4o-mini",
            "skillsPath": "/absolute/path/to/your-project/.papert/skills",
            "includePartialMessages": True,
            "excludeTools": ["ShellTool(rm )"]
        }
    )

    session = client.create_session(session_id="release-readiness")

    await session.send(
        "Use `orchestrator` to run a release-readiness pass: "
        "security-auditor, code-reviewer, test-architect, docs-writer."
    )

    await session.send(
        "Now use `code-reviewer` only on packages/core/src/tools and "
        "report P0/P1 issues first."
    )

    await client.close()

asyncio.run(main())
```

## 11) Troubleshooting

- Subagent not used:
  - Ensure file exists in `.papert/agents/*.md`
  - Ensure `name` in frontmatter matches prompt reference exactly
  - Use explicit instruction: "Use subagent `<name>` now"
- Skills not discovered:
  - Ensure each skill has `SKILL.md`
  - Pass `skillsPath` if the skill folder is outside project defaults
- Wrong working tree:
  - Set `options.cwd` to project root so `.papert` is loaded
- Too many tool prompts:
  - Use `permissionMode: auto-edit` and/or `allowedTools`

## 12) API summary used in this guide

- `create_client(options)` / `Client.create_session(...)`
- `ClientSession.send(prompt)` / `ClientSession.stream(prompt)`
- `query(prompt, options)` for low-level streaming
- `options.agents` for runtime subagents
- `options.skillsPath` for custom skill directories

