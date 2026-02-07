# Web Command Catalog Parity

The web client command palette now loads dynamic server commands from `/listCommands` and merges them with curated slash-command shortcuts.

## What changed

- Web UI fetch now calls:
  - `/api/v1/webui/catalog`
  - `/listCommands`
- Server command trees are flattened into runnable command templates (for example, `papert extensions list`).
- Dynamic commands are merged with built-in shortcut entries without duplicates.

## Why this matters

- Reduces drift between server command capabilities and web client discoverability.
- New server commands appear in the web command catalog without hardcoding every command.

## Behavior

- Curated shortcuts remain available for common slash and shell workflows.
- Dynamic entries are appended with `terminal` tag.
- Merge deduplicates by command template text.

## Validation

- `packages/a2a-server/src/http/web-ui.test.ts` checks the Web UI payload includes `/listCommands` integration logic.
