# Papert Code A2A Server

## All code in this package is experimental and under active development

This package contains the A2A server implementation for Papert Code.

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
- Memory loading supports custom ignore files via `CUSTOM_IGNORE_FILE_PATHS` (path-delimited list) and `settings.fileFiltering.customIgnoreFilePaths`.
- Task streaming now tolerates retry/invalid-stream control events and preserves checkpoint ids on restorable tool calls.
