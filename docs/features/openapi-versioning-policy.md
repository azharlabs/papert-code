# OpenAPI Versioning Policy

This project maintains OpenAPI contracts for remote-control and web-ui server endpoints.

## Source of truth

- Spec module: `packages/a2a-server/src/http/openapi.ts`
- Served at runtime: `GET /openapi.json`
- Interactive docs: `GET /docs`

## Versioning rules

1. Additive, backward-compatible changes (new optional fields/endpoints):
   - keep `info.version` patch/minor aligned with release policy.
   - update contract tests.
2. Breaking changes (removed/renamed fields, changed required semantics):
   - require explicit changelog entry.
   - update clients before rollout.
   - bump API version semantics in `info.version`.
3. Security/authorization behavior changes:
   - update schema/response docs.
   - add/adjust contract tests for `401/403/409` paths.

## Contract enforcement

- `packages/a2a-server/src/http/openapi.contract.test.ts` validates required paths, methods, auth flags, and status schemas.
- CI should fail when spec and expected contracts drift.

## Changelog

### 2026-02-07

- Added web-ui endpoint contracts:
  - `GET /api/v1/webui/catalog`
  - `PUT /api/v1/webui/release-channel`
- Added shared auth error schema:
  - `#/components/schemas/ErrorResponse`
