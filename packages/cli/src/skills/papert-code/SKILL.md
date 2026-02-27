---
name: papert-code
description: "Papert Code CLI operations including scheduler jobs, extensions management, MCP server configuration, and settings. Use when user wants to schedule tasks, manage extensions, configure MCP servers, or modify Papert Code settings."
---

# Papert Code Operations

## Overview

This skill provides commands for managing Papert Code's core functionality including scheduling, extensions, MCP servers, and settings.

## Subagent Teams

Use the `/team` slash command for team discovery and validation.

### Team config location

`<project-root>/.papert/agent-teams.json`

### Commands

```bash
/team
/team list
/team show <team-id>
/team validate [team-id]
/team subagents
```

### Important usage notes

- Use `team:<id>` as the team target in task routing (for example `team:dev`).
- Do **not** use `@team-id` as a routing target in normal chat prompts, because `@...` can be interpreted as include/file syntax.
- `leader` and every `agents[].name` in `agent-teams.json` must match real subagent names.
- Check available subagents with `/team subagents`, then verify team config with `/team validate`.

## Scheduler

### Concepts

- **Jobs**: Named tasks with schedules and payloads
- **Schedules**: `every` (interval), `at` (one-shot), `cron` (cron expression)
- **Heartbeat jobs**: Lightweight check-ins without full LLM prompts
- **Session targeting**: `main` (active chat) or `isolated` (clean session)
- **Run history**: Logged to JSONL for auditing

### Storage

Jobs: `~/.papert/projects/<project-id>/schedule/jobs.json`
Run history: `~/.papert/projects/<project-id>/schedule/runs/<job-id>.jsonl`

### Commands

#### Add a recurring job

```bash
papert schedule add \
  --name "Daily summary" \
  --every 24h \
  --prompt "Summarize open PRs and list next steps."
```

#### Add a cron job

```bash
papert schedule add \
  --name "Weekday standup" \
  --cron "0 9 * * 1-5" \
  --tz "America/Los_Angeles" \
  --prompt "Summarize status, blockers, and next actions."
```

#### Add a one-shot job

```bash
papert schedule add \
  --name "Release check" \
  --at "2026-02-01T09:00:00Z" \
  --prompt "Run the release checklist."
```

#### Heartbeat job

```bash
papert schedule heartbeat \
  --name "Ping" \
  --text "Quick check-in: review critical alerts" \
  --every 15m
```

#### Start scheduler

```bash
papert schedule start
```

Notes:
- `papert schedule add` and `papert schedule heartbeat` auto-start scheduler processing for that workspace.
- Use `papert schedule start` mainly to restart after an explicit `papert schedule stop` or process restart.

#### List jobs

```bash
papert schedule list
papert schedule list --all
papert schedule list --json
```

#### Run a job now

```bash
papert schedule run <job-id>
papert schedule run <job-id> --force
```

#### Enable/disable jobs

```bash
papert schedule disable <job-id>
papert schedule enable <job-id>
```

#### Update a job

```bash
papert schedule update <job-id> --prompt "Updated prompt" --cron "0 8 * * *"
```

#### Remove a job

```bash
papert schedule remove <job-id>
```

#### Show status

```bash
papert schedule status
```

#### Run history

```bash
papert schedule runs <job-id> --limit 20
```

#### Webhook server

```bash
# Start webhook server
papert schedule webhook start --port 7111 --token "my-secret"

# Trigger via HTTP POST
curl -X POST \
  -H "Authorization: Bearer my-secret" \
  http://127.0.0.1:7111/webhook/<job-id>

# Trigger by name
curl -X POST "http://127.0.0.1:7111/webhook/Daily%20summary?by=name"
```

### Presets

```bash
# Use built-in presets
papert schedule add --name "Hourly check" --preset hourly --prompt "Check something"
papert schedule add --name "Daily digest" --preset daily --prompt "Summarize daily"
```

## Extensions

### Install extension

```bash
# From GitHub
papert extensions install https://github.com/papert-cli-extensions/security

# From GitHub shorthand
papert extensions install wshobson/agents:reverse-engineering

# From local path
papert extensions install ./local-extension
```

### List extensions

```bash
papert extensions list
```

### Show extension details

```bash
papert extensions detail <name>
```

### Uninstall extension

```bash
papert extensions uninstall <name-or-source>
```

### Enable/disable extension

```bash
# User level (all workspaces)
papert extensions enable <name>
papert extensions disable <name>

# Workspace level only
papert extensions enable <name> --scope workspace
papert extensions disable <name> --scope workspace
```

### Update extension

```bash
# Update specific extension
papert extensions update <name>

# Update all
papert extensions update --all
```

### Explore marketplace

```bash
# Default marketplace
papert extensions explore

# With keyword filter
papert extensions explore wshobson/agents reverse
```

### Create new extension

```bash
# Available templates: context, custom-commands, exclude-tools, mcp-server
papert extensions new my-extension mcp-server

# Then link for development
cd my-extension
npm install
npm run build
papert extensions link .
```

### Validate extension

```bash
papert extensions validate <path>
```

### Extension settings

```bash
# Set a setting
papert extensions settings set <extension> <key> <value>

# List settings
papert extensions settings list <extension>

# Show specific setting
papert extensions settings show <extension> <key>

# Unset a setting
papert extensions settings unset <extension> <key>
```

### Extension configuration (papert-extension.json)

```json
{
  "name": "my-extension",
  "version": "1.0.0",
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["${extensionPath}${/}dist${/}server.js"],
      "cwd": "${extensionPath}"
    }
  },
  "contextFileName": "papert.md",
  "excludeTools": ["run_shell_command"]
}
```

**Variables available:**
- `${extensionPath}` - Extension directory path
- `${workspacePath}` - Current workspace path
- `${/}` or `${pathSeparator}` - OS path separator

## MCP Servers

### Configuration in settings.json

Add MCP servers to your `~/.papert/settings.json`:

```json
{
  "mcp": {
    "servers": {
      "my-server": {
        "command": "npx",
        "args": ["-y", "my-mcp-package"]
      },
      "filesystem": {
        "command": "node",
        "args": ["/path/to/mcp-filesystem.js"],
        "env": {
          "ALLOWED_DIRS": "/home/user/projects"
        }
      }
    }
  }
}
```

### MCP server options

- `command` (required): Executable to start server
- `args` (optional): Command line arguments array
- `env` (optional): Environment variables
- `cwd` (optional): Working directory
- `timeout` (optional): Timeout in ms

### Add MCP server to settings

```bash
# Edit ~/.papert/settings.json directly or use the interactive /settings command
```

### Common MCP servers

```bash
# Filesystem
npx -y @modelcontextprotocol/server-filesystem /path/to/dir

# GitHub
npx -y @modelcontextprotocol/server-github

# Brave Search
npx -y @modelcontextprotocol/server-brave-search

# PostgreSQL
npx -y @modelcontextprotocol/server-postgres
```

## Settings

### Settings files locations

- **User**: `~/.papert/settings.json`
- **Workspace**: `<project>/.papert/settings.json`
- **System**: `/etc/papert-code/settings.json` or `/Library/Application Support/PapertCode/settings.json`

### Interactive settings

```bash
# Open interactive settings panel
/settings
```

### Config introspection and migration

```bash
# Show effective config and source precedence
/config explain

# Show one key
/config explain model.name

# JSON output for automation/scripts
/config explain --json

# Migrate legacy Gemini naming to Papert naming
/migrate --from-gemini --dry-run
/migrate --from-gemini
```

Notes:
- `PAPERT_*` env vars are canonical.
- `GEMINI_*` aliases are deprecated and should be migrated.
- Run dry-run first, then apply migration, then verify with `/config explain`.

### Common settings

```json
{
  "general": {
    "preferredEditor": "vscode",
    "vimMode": false,
    "checkpointing": {
      "enabled": true
    }
  },
  "model": {
    "name": "gpt-4o",
    "maxSessionTurns": -1,
    "skipLoopDetection": false,
    "skipStartupContext": false
  },
  "tools": {
    "sandbox": false,
    "approvalMode": "default",
    "allowed": ["run_shell_command(git)", "run_shell_command(npm test)"]
  },
  "ui": {
    "theme": "dark",
    "hideTips": false,
    "hideBanner": false
  },
  "privacy": {
    "usageStatisticsEnabled": true
  }
}
```

### Approval modes

- `plan` - Analyze only, no file edits or commands
- `default` - Require approval before edits/commands
- `auto-edit` - Auto-approve file edits
- `yolo` - Auto-approve all

### Environment variables in settings

```json
{
  "openai": {
    "apiKey": "$OPENAI_API_KEY"
  }
}
```

## Plugins

### Enable plugins

```json
{
  "enablePlugins": true,
  "enableNpmPlugins": true,
  "autoInstallNpmPlugins": true
}
```

### Plugin locations

- **Project**: `<project>/.papert/plugins/`
- **Global**: `~/.papert/plugins/`

### Plugin format

```javascript
// my-plugin.mjs
export default function pluginFactory() {
  return {
    name: 'my-plugin',
    hooks: {
      'tool.execute.before': (payload) => {
        console.log('Tool about to run:', payload.toolName);
      },
      'session.start': (payload) => {
        console.log('Session started:', payload.sessionId);
      }
    }
  };
}
```

### Available hook events

- `tool.execute.before` / `tool.execute.after`
- `session.start` / `session.end`
- `model.before` / `model.after`
- `chat.params` / `chat.headers`
- `message.updated`
- `permission.asked` / `permission.replied`
- `lsp.updated`

### Load plugins in settings

```json
{
  "plugins": [
    "./.papert/plugins/my-plugin.mjs",
    "/Users/username/.papert/plugins/another-plugin.mjs",
    "papert-plugin-tool-logger"
  ]
}
```

## Custom Commands

### Command file location

- **Project**: `<project>/.papert/commands/`
- **User**: `~/.papert/commands/`

### Command format (TOML)

```toml
prompt = """
Please help with: {{args}}

!{command-to-run {{args}}}
"""
```

### Example

File: `~/.papert/commands/fs/grep-code.toml`

```toml
prompt = """
Summarize findings for pattern: {{args}}

Search results:
!{grep -r {{args}} .}
"""
```

Usage: `/fs:grep-code "pattern"`

## Interactive Slash Commands

Inside `papert` sessions:

- `/extensions list`
- `/extensions install <source>`
- `/extensions uninstall <name>`
- `/extensions enable <name>`
- `/extensions disable <name>`
- `/extensions detail <name>`
- `/schedule panel`
- `/settings`
- `/config explain [key] [--json]`
- `/migrate --from-gemini [--dry-run]`

## Troubleshooting

### Extension not appearing after install

1. Run `/extensions list` in same session
2. Check details: `/extensions detail <name>`
3. Rebuild CLI: `npm run build && npm install -g .`

### Scheduler not running

1. Add/heartbeat auto-starts scheduler; run `papert schedule start` only if it was stopped
2. Check status: `papert schedule status`
3. Verify credentials in environment

### SDK scheduler events not appearing

1. Keep the SDK stream/query session open (short `send()` calls won't receive future events)
2. Watch `system` messages with subtype `scheduler_event`
3. Verify jobs exist: `papert schedule list --json`

### MCP server not loading

1. Check settings.json syntax
2. Verify command/path exists
3. Test server manually

### Settings not applying

1. Check file location (workspace overrides user)
2. Verify JSON syntax
3. Restart CLI session
