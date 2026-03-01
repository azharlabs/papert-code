# OpenAPI Versioning Policy

This project maintains OpenAPI contracts for remote-control and web-ui server endpoints.

## Source of truth

- Spec module: `packages/a2a-server/src/http/openapi.ts`
- Served at runtime: `GET /openapi.json`
- Interactive docs: `GET /docs`
- SDK client generation: `npm run generate:remote-api-clients`
- Contract scope: stable remote-control API only. Web UI implementation endpoints may exist outside this contract.

## Versioning rules

1. Additive, backward-compatible changes (new optional fields/endpoints):
   - keep `info.version` and `REMOTE_CONTROL_OPENAPI_CONTRACT_VERSION` aligned.
   - update contract tests.
2. Breaking changes (removed/renamed fields, changed required semantics):
   - require explicit changelog entry.
   - regenerate SDK clients before rollout.
   - bump API version semantics in `info.version` and `REMOTE_CONTROL_OPENAPI_CONTRACT_VERSION`.
3. Security/authorization behavior changes:
   - update schema/response docs.
   - add/adjust contract tests for `401/403/409` paths.

## Contract enforcement

- `packages/a2a-server/src/http/openapi.contract.test.ts` validates required paths, methods, operation IDs, auth flags, and status schemas.
- CI should fail when spec and expected contracts drift.
- Internal Web UI endpoints not listed in this spec should not be consumed by SDK clients as stable contracts.

## Changelog

### 2026-02-07

- Added web-ui endpoint contracts:
  - `GET /api/v1/webui/catalog`
  - `PUT /api/v1/webui/release-channel`
- Added shared auth error schema:
  - `#/components/schemas/ErrorResponse`

### 2026-03-01

- Clarified contract boundary:
  - OpenAPI covers stable remote-control endpoints.
  - Web UI internal mutating endpoints remain out-of-contract unless explicitly promoted.
