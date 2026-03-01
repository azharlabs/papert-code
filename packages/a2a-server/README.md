# Papert Code A2A Server

## All code in this package is experimental and under active development

This package contains the A2A server implementation for Papert Code.

For migration details from `gemini-cli`, see:
- `/Users/azhar/code/coding-agent/papert-code/packages/a2a-server/docs/gemini-parity-improvements.md`
- `/Users/azhar/code/coding-agent/papert-code/packages/a2a-server/docs/a2a-hardening-2026-03.md`

## Commands

The server exposes command execution over `/executeCommand`.

- `extensions list`: Lists installed extensions.
- `init`: Generates a tailored `papert.md` context file for the workspace.
- `restore <checkpoint>`: Restores conversation/file state for a specific checkpoint.
- `restore list`: Lists available checkpoints.
- `memory show`: Shows loaded memory content.
- `memory refresh`: Reloads memory from disk.
- `memory list`: Lists discovered `papert.md` memory files (or file count when paths are unavailable).
- `memory add <text>`: Saves a new memory entry using the `save_memory` tool.

## Runtime Notes

- If checkpointing is enabled but `git` is not available on the host, the server automatically disables checkpointing at startup.
- Web UI rewind/checkpoint listing reads from Papert temp checkpoint storage (`Storage.getProjectTempCheckpointsDir()`), not legacy Gemini paths.
- Share records persist only `secretHash` (SHA-256), not plaintext secrets.
- Share auth and share-secret verification use timing-safe token/hash comparisons.
- Web UI mutating routes now enforce strict payload validation (including unknown-field rejection on validated routes).
- JSON-backed state/settings updates use serialized atomic writes to reduce lost updates under concurrent requests.
- Memory loading supports custom ignore files via `CUSTOM_IGNORE_FILE_PATHS` (path-delimited list) and `settings.fileFiltering.customIgnoreFilePaths`.
- Task streaming now tolerates retry/invalid-stream control events and preserves checkpoint ids on restorable tool calls.
- Command registry can be reinitialized at runtime (`CommandRegistry.initialize()`), which clears stale registrations and restores built-ins.

## Settings Compatibility

The A2A server now supports both legacy flat settings and V2 nested settings
from `.papert/settings.json` and `~/.papert/settings.json`.

- V2 nested keys supported: `tools.core`, `tools.exclude`,
  `ui.showMemoryUsage`, `general.checkpointing`,
  `context.fileFiltering`, `security.folderTrust.enabled`, and `mcp.servers`.
- Legacy aliases remain supported: `coreTools`, `excludeTools`,
  `showMemoryUsage`, `checkpointing`, `fileFiltering`, `folderTrust`,
  and `mcpServers`.
- User and workspace settings are merged deeply, with workspace values taking
  precedence.
