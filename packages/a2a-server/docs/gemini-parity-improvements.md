# Gemini Parity Improvements

This document tracks the A2A server parity work ported from `gemini-cli` into `papert-code`.

## Implemented

1. Memory command suite
- Added `memory`, `memory show`, `memory refresh`, `memory list`, and `memory add`.
- `memory add` routes through `save_memory` tool execution and refreshes in-memory context.
- Added tests in `/Users/azhar/code/coding-agent/papert-code/packages/a2a-server/src/commands/memory.test.ts`.

2. Restore command parity
- `restore` now requires an explicit checkpoint name.
- Restore flow now supports history payload restoration and git-state restoration messaging.
- Added tests in `/Users/azhar/code/coding-agent/papert-code/packages/a2a-server/src/commands/restore.test.ts`.

3. Checkpointing safety guard
- When checkpointing is enabled but git is unavailable, checkpointing is automatically disabled.
- Added A2A config tests in `/Users/azhar/code/coding-agent/papert-code/packages/a2a-server/src/config/config.test.ts`.

4. File filtering parity
- Added support for:
  - `settings.fileFiltering.respectPapertIgnore`
  - `settings.fileFiltering.customIgnoreFilePaths`
  - `CUSTOM_IGNORE_FILE_PATHS` environment variable
- Extended `FileDiscoveryService` to support custom ignore files.
- Added tests in:
  - `/Users/azhar/code/coding-agent/papert-code/packages/a2a-server/src/config/config.test.ts`
  - `/Users/azhar/code/coding-agent/papert-code/packages/core/src/services/fileDiscoveryService.test.ts`

5. Command registry lifecycle
- Added `CommandRegistry.initialize()` to clear and rebuild built-in command registrations.
- Added tests in `/Users/azhar/code/coding-agent/papert-code/packages/a2a-server/src/commands/command-registry.test.ts`.

6. Task stream robustness
- Preserves checkpoint ids per tool call in task scheduling.
- Handles retry/invalid stream control events without surfacing false user-facing errors.
- Accepts model info control events to refresh task model metadata when present.
- Added tests in `/Users/azhar/code/coding-agent/papert-code/packages/a2a-server/src/agent/task.test.ts`.

7. Package/dependency hygiene
- Upgraded `@a2a-js/sdk` to `^0.3.8`.
- Upgraded `@google-cloud/storage` to `^7.16.0`.
- Moved eslint-related packages to `devDependencies`.

## Not Ported Exactly

- `SimpleExtensionLoader` architecture in `gemini-cli` is not directly portable because `papert-code-core` currently models extensions as concrete extension objects in config rather than an extension-loader abstraction.
- Equivalent behavior is retained via existing `loadExtensions(...)` and extension context path handling.

## Post-Parity Hardening (2026-03-01)

- Fixed Web UI checkpoint catalog path to use Papert storage checkpoint directory.
- Hardened share auth/token verification with timing-safe hash comparisons.
- Moved share secret persistence to hashed-at-rest format.
- Added strict payload validation and unknown-field rejection for high-risk Web UI mutating routes.
- Added serialized atomic JSON writes for settings/schedule/state-backed updates.
- Added regression tests for the above in:
  - `/Users/azhar/code/coding-agent/papert-code/packages/a2a-server/src/http/shareStore.test.ts`
  - `/Users/azhar/code/coding-agent/papert-code/packages/a2a-server/src/http/share-auth.test.ts`
  - `/Users/azhar/code/coding-agent/papert-code/packages/a2a-server/src/http/web-ui.test.ts`
