# Feature Operations Guide

This guide consolidates runtime usage, web exposure, test commands, and troubleshooting for the implemented feature set.

## Scope

Covered features:

1. Command doc parity
2. Rewind command and web rewind panel
3. Session workflows (`/chat`, `/resume`)
4. GitHub automation commands
5. MCP diagnostics
6. Policy explain mode and web deny visibility
7. Release channels (CLI + web selector)
8. OpenAPI contracts and versioning policy
9. Eval suite expansion and CI matrix
10. Performance + bundle budget guardrails

## Environment prerequisites

- Repository root: `/Users/azhar/code/coding-agent/papert-code`
- Node 20+
- `npm ci` completed
- For GitHub automation: authenticated `gh` CLI
- For terminal-bench full runs: `tb` installed and required API credentials

## CLI and Web command map

### Rewind and restore

- CLI:
  - `/rewind`
  - `/rewind <checkpoint-id>`
  - `/restore <checkpoint-id>`
- Web:
  - `Rewind` tab lists checkpoint entries and prefills `/rewind <id>` via **Use**

### MCP diagnostics

- CLI:
  - `/mcp diagnose`
  - `/mcp diagnose <server>`
  - `/mcp auth <server>`
  - `/mcp refresh`
- Web:
  - command palette includes `/mcp diagnose` and `/mcp auth`

### GitHub automation

- CLI:
  - `/github install`
  - `/github status`
  - `/github run <alias> [--ref <branch>] [--input key=value]`
  - `/github runs [alias]`
- Web:
  - command palette includes core GitHub commands

### Session workflows

- CLI:
  - `/chat list`
  - `/chat resume`
  - `/chat resume <tag>`
  - `/resume`
- Web:
  - shortcuts are available through command catalog entries

## Verification commands

### Build and core validations

```bash
npm run build
npm run docs:commands:check
```

### Feature-specific tests

```bash
# rewind + loader
npm run test --workspace packages/cli -- src/ui/commands/rewindCommand.test.ts src/services/BuiltinCommandLoader.test.ts

# chat workflow
npm run test --workspace packages/cli -- src/ui/commands/chatCommand.test.ts

# github automation
npm run test --workspace packages/cli -- src/ui/commands/githubCommand.test.ts

# mcp diagnostics
npm run test --workspace packages/cli -- src/ui/commands/mcpCommand.test.ts

# policy explain mode
npm run test --workspace packages/core -- src/policy/policy-engine.test.ts src/confirmation-bus/message-bus.test.ts

# web ui integration
npm run test --workspace packages/a2a-server -- src/http/web-ui.test.ts

# openapi contracts
npm run test --workspace packages/a2a-server -- src/http/openapi.test.ts src/http/openapi.disabled.test.ts src/http/openapi.contract.test.ts

# script-level guardrails
npm run test:scripts -- command-doc-parity perf-budgets bundle-budgets
```

### Eval suite checks

```bash
# task catalog + selector logic
npx vitest run integration-tests/terminal-bench/taskCatalog.test.ts

# summary aggregation logic
npx vitest run integration-tests/terminal-bench/scripts/summarize-results.test.ts
```

## CI workflows

### Terminal-bench eval matrix

- File: `.github/workflows/terminal-bench-evals.yml`
- Subsets:
  - `fast`
  - `full`
- Produces summary artifacts per subset.

### Performance guardrails

- File: `.github/workflows/perf-guardrails.yml`
- Enforces:
  - source perf budgets (`npm run perf:check`)
  - bundle budgets (`npm run bundle:check`)
- Uploads artifact: `perf-guardrail-summary`

## Troubleshooting matrix

### `/rewind` unknown or unusable

- Symptom: unknown command or disabled message
- Fix:
  - ensure latest build is used (`npm run build`)
  - if message says checkpointing disabled, set:
    - `general.checkpointing.enabled = true`
  - restart CLI

### MCP diagnose shows transport failures

- Verify URL and network path to remote MCP endpoint
- Run:
  - `/mcp auth <server>` if OAuth is required
  - `/mcp refresh` to restart MCP sessions

### GitHub command failures

- Run `gh auth status`
- Ensure workflow files exist (`/github status`)
- Verify alias name and optional flags

### Web UI catalog stale

- Refresh session and catalog
- Use `Rewind` refresh button
- Reconnect remote session if expired

### Budget checks failing

- Source budget:
  - `npm run perf:check`
- Bundle budget:
  - `npm run bundle:check`
- Refactor first; only raise budget limits when justified.

## Related docs

- `docs/features/rewind.md`
- `docs/features/mcp-diagnostics.md`
- `docs/features/session-workflows.md`
- `docs/features/github-automation.md`
- `docs/features/policy-explain-mode.md`
- `docs/features/release-channels.md`
- `docs/features/server-openapi-contracts.md`
- `docs/features/openapi-versioning-policy.md`
- `docs/features/eval-suite-expansion.md`
- `docs/features/eval-ci-matrix.md`
- `docs/features/performance-budgets.md`
