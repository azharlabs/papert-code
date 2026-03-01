# A2A Hardening Update (2026-03-01)

This note documents hardening work applied to `packages/a2a-server` after Gemini/Qwen parity review.

## Implemented

1. Checkpoint catalog path fix
- Web UI catalog rewind listing now reads checkpoints from:
  - `Storage.getProjectTempCheckpointsDir()`
- This removes the legacy `.gemini/checkpoints` path dependency.

2. Share secret security
- Share records now persist `secretHash` (SHA-256) instead of plaintext `secret`.
- Share deletion validates provided secret via timing-safe hash comparison.
- Legacy records that still contain plaintext `secret` remain removable for backward compatibility.

3. Share bearer auth hardening
- Share creation auth now parses bearer tokens via shared parsing (`parseBearerToken`).
- Server token comparison uses timing-safe hash comparison.

4. Web UI payload validation improvements
- Added strict body validation (including unknown-field rejection) for these mutating routes:
  - `POST/PUT /api/v1/webui/{agents|skills|tools|custom-tools|plugins}`
  - `POST/PUT/DELETE /api/v1/webui/mcps`
  - `POST/PUT/DELETE /api/v1/webui/hooks/*`
  - `POST/PUT/DELETE /api/v1/webui/schedules/*`
- Invalid payloads now return `400` with clear error messages.

5. Serialized atomic JSON writes
- Added per-file serialized write queues + atomic JSON write path for state/settings/schedule-backed updates.
- Reduces lost updates under concurrent request bursts.

6. HTTP route modularization
- Extracted Web UI mutating routes into:
  - `packages/a2a-server/src/http/webUiMutations.ts`
- `app.ts` now wires this module via `registerWebUiMutationRoutes(...)`, reducing central file size and isolating validation/mutation logic.

## Tests Added/Updated

- `src/http/shareStore.test.ts`
  - verifies hashed secret persistence and no plaintext secret at rest
  - verifies legacy plaintext-record compatibility
- `src/http/share-auth.test.ts`
  - verifies case-insensitive/trimmed bearer auth parsing
- `src/http/web-ui.test.ts`
  - verifies rewind points are read from Papert checkpoint storage
  - adds invalid-payload coverage for agents/mcps/schedules routes

## Verification

- Full A2A package tests pass:
  - `npm run test --workspace packages/a2a-server`

## Downstream Compatibility Audit

- Audited downstream consumers (`packages/desktop` and `papert-claw`) for direct usage of newly promoted OpenAPI/SDK endpoints.
- No required code changes were identified for this batch because all added API/SDK surfaces are backward-compatible additions.

## Notes on OpenAPI Scope

- The current OpenAPI contract remains focused on stable remote-control endpoints.
- Many `webui` mutating routes are implementation endpoints for the bundled Web UI and are intentionally outside the stable SDK contract surface.
- As part of this pass, `webui/state` was promoted into the stable OpenAPI + SDK surface:
  - `GET /api/v1/webui/state`
  - `PUT /api/v1/webui/state`
