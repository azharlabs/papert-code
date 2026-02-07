# Command Doc Parity

This document explains how Papert Code keeps built-in slash command documentation in sync with the source of truth in:

- `packages/cli/src/services/BuiltinCommandLoader.ts`

## Why this exists

The CLI command surface changes over time. Manual updates to `docs/cli/commands.md` are easy to miss, which causes:

- missing command docs
- outdated command indexes
- confusing `/help` vs docs mismatches

To prevent this, Papert Code now has a command-doc parity workflow.

## Source of truth

Built-in command inclusion is determined by the loader:

- `packages/cli/src/services/BuiltinCommandLoader.ts`

If a command is added or removed there, docs parity will require documentation to be synced.

## Generated section

`docs/cli/commands.md` contains an auto-generated section bounded by markers:

- `<!-- BEGIN AUTO-GENERATED BUILTIN COMMAND INDEX -->`
- `<!-- END AUTO-GENERATED BUILTIN COMMAND INDEX -->`

Only that section is managed automatically. The rest of the page remains manually maintained.

## Commands

### Sync docs

```bash
npm run docs:commands:sync
```

What it does:

- reads built-in command registrations from the loader
- resolves command names from command modules
- rewrites the generated command index section in `docs/cli/commands.md`

### Check parity

```bash
npm run docs:commands:check
```

What it does:

- computes expected generated section
- compares with current `docs/cli/commands.md`
- exits non-zero if they differ

## CI integration

Parity check is part of `lint:ci`:

```bash
npm run lint:ci
```

Current behavior:

- CI fails when command index is out of sync
- fix by running `npm run docs:commands:sync` and committing the resulting doc change

## Typical contributor workflow

1. Add/update/remove built-in command in `packages/cli/src/services/BuiltinCommandLoader.ts`.
2. Implement command logic in `packages/cli/src/ui/commands/*`.
3. Run:
   - `npm run docs:commands:sync`
   - `npm run docs:commands:check`
4. Update manual command descriptions in `docs/cli/commands.md` if behavior changed.
5. Run tests and commit.

## Troubleshooting

### `docs:commands:check` fails

Run:

```bash
npm run docs:commands:sync
```

Then review and commit `docs/cli/commands.md`.

### New command name not extracted as expected

The parity script uses command module inspection and fallbacks. If extraction is incorrect:

- verify `name: '...'` exists in the command definition
- verify command is exported and included by `BuiltinCommandLoader`
- update `scripts/command-doc-parity.mjs` fallback mapping if needed

## Script and tests

- Script: `scripts/command-doc-parity.mjs`
- Tests: `scripts/tests/command-doc-parity.test.js`

These tests validate:

- command name extraction
- generated section rendering
- generated section replacement/prepend behavior
