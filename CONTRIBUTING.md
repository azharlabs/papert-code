# Contributing to Papert Code

Thanks for helping improve Papert Code.

## Before You Start

- Open an issue (bug/feature/proposal) before large changes.
- Keep changes focused and scoped to one concern.
- Prefer small PRs over large mixed PRs.

## Pull Request Expectations

1. Link the PR to an issue.
2. Explain what changed and why.
3. Include tests for behavior changes.
4. Update docs for user-facing changes.
5. Ensure CI checks pass.

## Local Development Setup

### Prerequisites

- Node.js `>=20`
- npm
- Git

### Clone and install

```bash
git clone https://github.com/azharlabs/papert-code.git
cd papert-code
npm install
```

### Build

```bash
npm run build
```

### Run from source

```bash
npm start
```

### Build all (including sandbox + companion)

```bash
npm run build:all
```

## Testing and Quality

### Unit/package tests

```bash
npm run test
```

### CI-like checks

```bash
npm run preflight
```

### Integration tests

```bash
npm run test:e2e
```

Integration docs: `docs/development/integration-tests.md`

### Lint / format / typecheck

```bash
npm run lint
npm run format
npm run typecheck
```

## Repository Structure

- `packages/cli` - Papert CLI (TUI, commands, runtime wiring)
- `packages/core` - core tools, model/runtime plumbing
- `packages/sdk-typescript` - TypeScript SDK
- `packages/sdk-python` - Python SDK
- `packages/desktop` - desktop app
- `packages/admin-web` - admin control plane
- `packages/a2a-server` - A2A integration server
- `docs/` - user and developer docs

## Coding Guidelines

- Match the style and conventions already used in the touched package.
- Keep diffs minimal and avoid unrelated refactors.
- Add tests near changed behavior.
- Use clear commit messages.

## Sandboxing Notes

Papert supports macOS Seatbelt and container sandboxing.

- Enable container sandboxing with `PAPERT_SANDBOX=true|docker|podman`.
- Customize sandbox with `.papert/sandbox.Dockerfile` and `.papert/sandbox.bashrc`.

See `README.md` and docs under `docs/features/sandbox.md` for details.

## Debugging

### Node/CLI debug

```bash
npm run debug
```

### React DevTools (CLI UI)

```bash
DEV=true npm start
npx react-devtools@4.28.5
```

## Release and Publishing

For release/version tasks, use the scripts in root `package.json`.

Examples:

```bash
npm run release:version
npm run prepare:package
```

## Security

Do not commit secrets. Use local env files and GitHub Actions secrets for CI.

---

If you are unsure about design direction, open a draft PR early and ask for feedback.
