# Server OpenAPI Contracts

Papert server mode now has a dedicated OpenAPI source module plus contract tests.

## What changed

- OpenAPI spec moved to `packages/a2a-server/src/http/openapi.ts`.
- HTTP app wiring now reuses that shared spec for:
  - `GET /openapi.json`
  - `GET /docs` (Scalar UI)
- Added contract tests in:
  - `packages/a2a-server/src/http/openapi.contract.test.ts`

## Why this is important

- Prevents route/spec drift as server endpoints evolve.
- Keeps API docs and runtime behavior aligned.
- Gives CI-level protection on critical remote-control endpoints.

## Contract coverage

The tests validate:

- Required remote-control paths exist:
  - `/api/v1/health`
  - `/api/v1/sessions`
  - `/api/v1/sessions/{sessionId}/release`
- Expected HTTP methods exist for each path.
- Expected status codes are documented.
- Auth requirements for protected endpoints are declared.
- Session-create response schema includes required fields.

## Usage

Enable docs in server mode:

```bash
PAPERT_REMOTE_DOCS_ENABLED=1
```

Then access:

- OpenAPI JSON: `/openapi.json`
- Interactive docs: `/docs`
