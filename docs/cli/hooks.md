# Hooks

Hooks let you run external scripts at specific lifecycle events in Papert Code.
They are designed for validation, logging, context injection, or policy
enforcement without modifying the CLI source.

> Hooks are separate from the JavaScript **plugin** system. Plugins are loaded
> as modules and run in-process. Hooks are external commands executed by the CLI.

## Enable hooks

Hooks are disabled by default. Enable them in settings and restart the CLI:

```json
{
  "tools": {
    "enableHooks": true
  }
}
```

You can set this in `~/.papert/settings.json` (user) or
`<project>/.papert/settings.json` (workspace).

## Configure hooks (settings.json)

Hooks are configured under the `hooks` key. Each hook event contains an array
of hook definitions. A definition can include an optional `matcher`, an optional
`sequential` flag, and a list of `hooks` to run.

```json
{
  "hooks": {
    "BeforeTool": [
      {
        "matcher": "write_.*",
        "hooks": [
          {
            "type": "command",
            "name": "block-writes",
            "command": "./hooks/block_writes.sh",
            "timeout": 30000
          }
        ]
      }
    ],
    "disabled": ["block-writes"]
  }
}
```

### Hook definition fields

- `matcher` (optional): Pattern used to decide whether the hook should run.
- `sequential` (optional): If true, hooks run in order and can modify the input
  for subsequent hooks. If any definition sets this to true, all matching hooks
  for that event run sequentially.
- `hooks`: Array of hook configs.

### Hook config fields

- `type`: `"command"` (currently the only supported type)
- `command`: Command to execute
- `name` (optional): Friendly name used by `/hooks enable|disable`
- `description` (optional): Short description
- `timeout` (optional): Timeout in milliseconds (default: 60000)

### Disabling hooks

Add hook names to `hooks.disabled` to prevent them from running:

```json
{
  "hooks": {
    "disabled": ["block-writes"]
  }
}
```

You can also use `/hooks disable <hook-name>` to update the user settings.

## Project hooks (hooks.json)

Papert Code supports a project-level `hooks/hooks.json` file. This is useful for
team-shared hooks and works with Claude-style hook configs.

**Important:** Project hooks are only executed in **trusted folders**. If the
workspace is untrusted, project hooks are ignored.

Supported formats:

```json
{
  "BeforeTool": [
    {
      "hooks": [
        { "type": "command", "command": "./hooks/check.sh" }
      ]
    }
  ]
}
```

Claude-style wrapper:

```json
{
  "hooks": {
    "BeforeTool": [
      {
        "hooks": [
          { "type": "command", "command": "./hooks/check.sh" }
        ]
      }
    ]
  }
}
```

## Hook events

Papert Code supports the following hook events:

- `SessionStart` (source: `startup` | `resume` | `clear`)
- `SessionEnd` (reason: `exit` | `clear` | `logout` | `prompt_input_exit` | `other`)
- `BeforeAgent` (prompt text)
- `AfterAgent` (prompt + response text)
- `BeforeModel` (LLM request)
- `AfterModel` (LLM request + response)
- `BeforeToolSelection` (LLM request before tool selection)
- `BeforeTool` (tool name + input)
- `AfterTool` (tool name + input + response)
- `PreCompress` (trigger: `manual` | `auto`)
- `Notification` (notification payload)

## Matchers

Matchers control when a hook runs.

- **Tool events** (`BeforeTool`, `AfterTool`): `matcher` is treated as a regular
  expression tested against the tool name.
- **Non-tool events**: `matcher` is treated as an exact string and compared to
  the event trigger/source.
- `""` or `"*"` matches everything.

## Input payloads

Each hook receives JSON on `stdin`. All events include:

```json
{
  "session_id": "…",
  "transcript_path": "…",
  "cwd": "…",
  "hook_event_name": "BeforeTool",
  "timestamp": "…"
}
```

Event-specific fields are added on top (for example, `tool_name`, `tool_input`,
`llm_request`, `llm_response`, or `prompt`).

## Output payloads and exit codes

Hooks should write **one JSON object** to `stdout`. Use `stderr` for logging.

Output fields (all optional):

- `decision`: `allow` | `deny` | `block` | `ask`
- `reason`: Human-readable reason for a deny/block
- `continue`: Set to `false` to stop the current turn
- `systemMessage`: Additional message added to the agent context
- `suppressOutput`: Hide the hook output from the UI
- `hookSpecificOutput`: Event-specific payloads (see below)

Exit codes:

- `0`: Success. Output is parsed as JSON (if present).
- `2`: Blocking error. Treated as a deny with the error message.
- Any other non-zero: Non-blocking warning (execution continues).

If `stdout` is not valid JSON, Papert Code treats the text as a `systemMessage`
instead of failing the hook.

### Event-specific outputs

Some events accept structured `hookSpecificOutput`:

- **BeforeTool**: `tool_input` to modify the tool call input.
- **BeforeAgent/AfterTool/SessionStart**: `additionalContext` (string).
- **BeforeModel**: `llm_request` (partial override) or `llm_response`
  (synthetic response to short-circuit the model call).
- **AfterModel**: `llm_response` (partial override) or `continue: false` to stop.
- **BeforeToolSelection**: `toolConfig` to modify tool routing (mode, allowed tools).

## Environment variables

The CLI exposes a few variables for convenience:

- `PAPERT_PROJECT_DIR` - current project root
- `CLAUDE_PROJECT_DIR` - alias for compatibility
- `CLAUDE_PLUGIN_ROOT` - alias for compatibility

## Security notes

- Hooks execute with the same OS permissions as the user running Papert Code.
- Project hooks only run in **trusted** folders.
- Hooks run outside the tool sandbox, so treat them as local scripts.
