# Papert Code A2A Server

## All code in this package is experimental and under active development

This package contains the A2A server implementation for Papert Code.

## Commands

The server exposes command execution over `/executeCommand`.

- `extensions list`: Lists installed extensions.
- `init`: Generates a tailored `papert.md` context file for the workspace.
- `restore`: Restores to a checkpoint.
- `restore list`: Lists available checkpoints.
- `memory show`: Shows loaded memory content.
- `memory refresh`: Reloads memory from disk.
- `memory list`: Lists discovered `papert.md` memory files (or file count when paths are unavailable).
- `memory add <text>`: Saves a new memory entry using the `save_memory` tool.
