# Papert Code — repository context (papert.md)

This file is **instructional context** for Papert Code (the CLI agent) when working in this repository.

## 1) What this repo is

**Papert Code** is an AI agent engine for software engineering workflows.

It provides:

- A terminal-first interactive CLI (`papert`) with a React/Ink TUI.
- A web/remote mode (`papert server ...`) for remote driving and a Web UI.
- A modular monorepo with shared core tooling, SDKs (TypeScript + Python), and a VS Code companion extension.
- Safety controls: approval modes, sandboxing (macOS Seatbelt and container-based), and policy/admin controls.

### Tech stack

- **Language:** TypeScript (ESM)
- **Runtime:** Node.js **>= 20**
- **Monorepo:** npm workspaces (`workspaces: ["packages/*"]`)
- **Build:** custom scripts + **esbuild** bundling to `dist/`
- **Lint/format:** ESLint (flat config) + Prettier
- **Tests:** Vitest (multi-project)

### Key packages

- `packages/cli` — the `papert` CLI (TUI, commands, sandbox integration)
- `packages/core` — core tool implementations, MCP plumbing, shared services
- `packages/sdk-typescript` — TypeScript SDK
- `packages/sdk-python` — Python SDK
- `packages/vscode-ide-companion` — VS Code extension
- `packages/a2a-server` — A2A server
- `packages/admin-web` — admin controls site
- `packages/desktop` — desktop app (Tauri)
- `packages/test-utils` — shared test helpers

## 2) Repo layout (top-level)

- `packages/` — workspace packages (primary source)
- `docs/` — user + contributor docs
- `scripts/` — build/test/release utilities
- `schemas/` — JSON schemas (settings, etc.)
- `dist/` — built/bundled output (generated)
- `integration-tests/` — end-to-end/integration tests (Vitest)
- `.integration-tests/` — artifacts (often ignored)
- `.husky/` — git hooks

## 3) How to build, run, and test

### Install

```bash
npm install
```

### Build

```bash
npm run build
```

Build everything (CLI + sandbox + VS Code companion):

```bash
npm run build:all
```

### Run (from source)

```bash
npm run start
```

Debug (Node inspector):

```bash
npm run debug
```

### Tests

Unit/workspace tests:

```bash
npm test
```

CI-style tests:

```bash
npm run test:ci
```

Integration tests (no sandbox):

```bash
npm run test:integration:sandbox:none
```

Integration tests (all sandbox modes):

```bash
npm run test:integration:all
```

E2E convenience target:

```bash
npm run test:e2e
```

### Lint / format / typecheck

```bash
npm run lint
npm run format
npm run typecheck
```

### Preflight (heavy; cleans + reinstalls)

```bash
npm run preflight
```

> Note: `preflight` runs `clean`, `npm ci`, `format`, `lint:ci`, `build`, `typecheck`, and `test:ci`.

### Makefile shortcuts

The root `Makefile` mirrors common npm scripts:

```bash
make install
make build
make build-all
make test
make lint
make format
make preflight
make start
make debug
```

## 4) Entry points and architecture notes

### CLI entry

- Root package bin: `papert` → `dist/cli.js` (built by esbuild)
- Workspace CLI package bin: `packages/cli/dist/index.js`

`packages/cli/index.ts` is the runtime entrypoint.

Important behavior:

- If invoked with `server` in argv, it **avoids initializing the interactive TUI** and runs the server handler directly.
- Otherwise it imports and runs the interactive main (`./src/gemini.js`).

### Core exports

`packages/core/index.ts` re-exports `./src/index.js` plus a set of commonly used utilities/config constants.

## 5) Model/provider configuration (no secrets in repo)

Papert Code uses an **OpenAI-compatible API**. Configure via env vars or `.env` / `.papert/.env`.

Common env vars:

- `OPENAI_API_KEY` (required)
- `OPENAI_BASE_URL` (optional)
- `OPENAI_MODEL` (optional)

Example:

```bash
export OPENAI_API_KEY="..."
export OPENAI_BASE_URL="https://api.your-provider.com/v1"
export OPENAI_MODEL="gpt-4o-mini"
```

Security rules for this repo:

- **Never** print, log, commit, or paste API keys/tokens.
- Treat `.env`, `.papert/.env`, `~/.papert/.env` as sensitive.

## 6) Sandboxing (important for local safety)

Papert Code supports sandboxing:

- **macOS Seatbelt** via `sandbox-exec` with built-in profiles.
- **Container sandbox** via Docker/Podman when `PAPERT_SANDBOX` is enabled.

Common knobs (see docs for full details):

- `PAPERT_SANDBOX=true|docker|podman|<command>`
- `SEATBELT_PROFILE=restrictive-closed` (or other built-in profiles)

When running commands that modify the system outside the repo, prefer enabling sandboxing.

## 7) Development conventions (how to change code here)

### TypeScript / ESM

- This repo is ESM (`"type": "module"`). Prefer `import ... from`.
- TS config is strict; avoid `any`.

### ESLint rules to keep in mind

From `eslint.config.js`:

- `@typescript-eslint/no-explicit-any`: **error**
- `eqeqeq`: **always** (except null)
- `prefer-const`: **error**
- `no-var`: **error**
- `import/no-relative-packages`: **error** (don’t import other workspaces via relative paths)
- `import/no-internal-modules`: **error** (with a small allowlist)
- `import/no-default-export`: **warn** (prefer named exports)
- `no-restricted-syntax`: disallows `require()` and throwing non-Error literals

### Formatting

- Prettier is the source of truth.
- Run `npm run format` before pushing large diffs.

### Tests

- Use Vitest.
- Prefer adding/adjusting tests in the relevant package (`packages/*`) or `integration-tests/`.

### Keep changes scoped

- Follow existing patterns in the package you’re editing.
- Avoid cross-package coupling; use public exports.

## 8) Common workflows for Papert Code (agent) in this repo

When asked to implement changes:

1. **Research first**: locate the relevant package and read surrounding code.
2. **Verify dependencies**: don’t introduce new libs unless already used or explicitly requested.
3. **Add tests**: unit/integration as appropriate.
4. **Validate**: run `npm test` (and `npm run typecheck` if TS-heavy).

When asked to run commands:

- Explain any command that modifies the filesystem, installs deps, or changes system state.
- Prefer running commands from repo root unless a package requires `--workspace`.

## 9) Docs pointers

- Architecture: `docs/architecture.md` (if present)
- Remote driving: `docs/cli/remote-driving.md` and `docs/development/remote-driving.md`
- Safety/admin: `docs/features/safety-admin-core-cli.md`

## 10) Notes / TODOs for future context

- TODO: If you need deeper guidance on a subsystem (MCP, admin-web, desktop), read the relevant package README/docs and extend this file.
