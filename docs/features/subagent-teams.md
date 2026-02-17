# Subagent Teams

Subagent Teams extend Papert Code subagents with queue-backed collaboration, `@agent` handoffs, and per-agent model selection.

This feature is designed to bring the same operational patterns used by long-running multi-agent systems into Papert Code workflows.

## What this adds

1. File-backed team queue with crash recovery.
2. Team handoffs via `[@agent: message]` tags.
3. Per-agent model overrides (no provider switching required).
4. Per-agent workspace isolation paths.
5. Structured team event logs for observability.
6. Runtime lifecycle artifacts under `.papert/runtime/subagent-teams/`.
7. Optional sender allowlist to gate team execution.

## Team config

Create `.papert/agent-teams.json`:

```json
{
  "teams": [
    {
      "id": "dev",
      "name": "Development Team",
      "leader": "coder",
      "maxMessages": 40,
      "allowlist": ["alice", "ops-bot"],
      "agents": [
        { "name": "coder", "model": "papert-2.5-pro", "workspace": "coder" },
        { "name": "reviewer", "model": "papert-2.5-flash", "workspace": "reviewer" },
        { "name": "writer", "model": "papert-2.5-flash", "workspace": "writer" }
      ]
    }
  ]
}
```

Notes:
- `leader` receives the first message unless prompt starts with `@agent`.
- `model` is per agent and overrides only model selection.
- `allowlist` is optional; if present, unknown senders are blocked.

## Usage

Use the `Task` tool with team targets:
- `team:<id>` (recommended)
- `@<id>`
- `<id>` (if unique team id/name)

Example:

```json
{
  "description": "Fix and review auth bug",
  "prompt": "Fix auth state regression in login.ts. [@reviewer: review the patch]",
  "subagent_type": "team:dev",
  "sender_id": "alice"
}
```

Initial routing override:
- Prompt starts with `@reviewer ...` to route first step to `reviewer` instead of team leader.

Handoff syntax from agent output:
- `[@reviewer: check edge cases]`
- `[@reviewer,writer: review and document]`

## Runtime files

Team runtime artifacts are written to:

- `.papert/runtime/subagent-teams/<team-id>/conversations/<conversation-id>/queue/`
- `.papert/runtime/subagent-teams/<team-id>/events/<conversation-id>.jsonl`
- `.papert/runtime/subagent-teams/<team-id>/workspaces/<agent-or-workspace>/`

Queue folders:
- `incoming/` pending messages
- `processing/` in-flight messages
- `outgoing/` final aggregated result

Recovery behavior:
- On start, files in `processing/` are moved back to `incoming/`.

## Operational details

- Max chain depth is bounded by `maxMessages` (default `50`).
- Final team response aggregates each step as `@agent: output`.
- Tag blocks are removed from final user-facing text after routing.

## Test cases

The following automated test coverage is included:

- `packages/core/src/subagent-teams/mention-parser.test.ts`
- `packages/core/src/subagent-teams/queue-store.test.ts`
- `packages/core/src/subagent-teams/team-manager.test.ts`
- `packages/core/src/subagent-teams/team-executor.test.ts`

These validate:
- `@agent` prefix parsing.
- bracket handoff extraction.
- queue enqueue/dequeue/recovery flow.
- allowlist enforcement.
- per-agent model override during team execution.

