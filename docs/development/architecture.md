# Papert Code Architecture Overview

This document defines the package boundaries across `core`, `cli`, `sdk`, `web`, and `desktop`.

## Package map

1. **Core (`packages/core`)**
   - Owns agent orchestration, model routing/availability, policy evaluation, tool registry/execution, checkpointing, and shared protocol/types.
   - Must stay UI-agnostic (no Ink/Tauri/browser dependencies).

2. **CLI (`packages/cli`)**
   - Terminal UX: slash commands, dialogs, rendering, local interaction flow, and non-interactive/headless adapters.
   - Consumes `core` public APIs; does not own model/tool execution logic.

3. **SDKs**
   - TypeScript: `packages/sdk-typescript`
   - Python: `packages/sdk-python`
   - Provide programmatic access to Papert sessions/streams/protocol events.
   - Depend on stable CLI/server protocol contracts, not private UI internals.

4. **Web + Server (`packages/a2a-server`)**
   - Remote session daemon, HTTP APIs, Web UI, OpenAPI contract, and workspace control plane.
   - Uses `core` for execution logic and exposes orchestration through network boundaries.

5. **Desktop (`packages/desktop`)**
   - Tauri-based shell + desktop web layer.
   - Integrates with CLI/server flows but should avoid duplicating core orchestration logic.

## Boundary rules

1. **`core` is the domain layer**
   - UI/web/desktop code must call into `core`; `core` must not import from those layers.

2. **`cli`, `a2a-server`, and `desktop` are delivery layers**
   - They differ by transport/UX (terminal, HTTP/web, desktop shell) but should share execution behavior through `core`.

3. **SDKs are contract clients**
   - SDK behavior should track protocol schemas and streaming semantics, not internal command implementations.

4. **Cross-layer changes require contract updates**
   - If behavior crosses process boundaries (web APIs, headless JSON, SDK streams), update tests/docs in each affected layer.

## Runtime topologies

### Local CLI topology

1. User interacts with `packages/cli`.
2. CLI resolves command/session context and dispatches to `core`.
3. `core` orchestrates model/tool flow and returns structured events/results.
4. CLI renders updates and applies confirmation/safety UX.

### Remote/web topology

1. `packages/a2a-server` hosts task/session APIs + Web UI.
2. Server delegates execution logic to `core`.
3. Web/remote clients consume server APIs and stream events.

### Desktop topology

1. `packages/desktop` hosts a local desktop shell.
2. Desktop UI interacts with server/CLI-compatible flows.
3. Execution semantics remain aligned with `core` behavior.

## Testing ownership

- `cli` lane: CLI typecheck + tests.
- `sdk` lane: TypeScript + Python SDK tests.
- `sandbox integration` lane: integration tests in sandbox-none mode.
- Deflake workflow: retry-based integration execution and flaky-signature reporting.
