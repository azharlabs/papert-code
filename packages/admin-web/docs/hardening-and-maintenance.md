# Admin Web Hardening And Maintenance Notes

This document summarizes the hardening and maintainability upgrades implemented for `@papert-code/admin-web`.

## Security and correctness upgrades

- Frontend correctness issues fixed:
  - Removed accidental non-UI text rendered in the main app shell.
  - Removed invalid state setter usage (`setNewGroupName`) and resolved strict nullability issues in timestamp formatting.
- Server build/type safety fixed:
  - `server/tsconfig.json` now uses `module: "NodeNext"` with `moduleResolution: "NodeNext"`.
- Sensitive fields are no longer exposed:
  - Admin user responses now serialize through `toPublicUser` and do not include `passwordHash`.
- CORS policy is now configurable and production-safe:
  - Added `PAPERT_ADMIN_CORS_ORIGINS` (comma-separated).
  - Production startup now fails if this value is not set.

## Reliability and API behavior upgrades

- Added centralized async and error handling:
  - Async route handlers are wrapped by `asyncHandler`.
  - `adminErrorHandler` normalizes unexpected failures and CORS rejections to structured JSON responses.
- Usage accounting is now atomic and race-safe:
  - Added unique index on `(user_id, period, period_start)`.
  - Usage writes use SQL `ON CONFLICT` upsert accumulation.
- Usage accounting now tracks token breakdown fields:
  - `usage` table stores `prompt_tokens` and `completion_tokens` in addition to `tokens_used`.
  - `/api/v1/user/usage` persists all three counters per daily/monthly bucket.
- Session transcript storage is now configurable:
  - Added `PAPERT_ADMIN_SESSIONS_DIR` (default: `./data/sessions`).
- List endpoints now support pagination/filtering:
  - `GET /api/v1/admin/users`: supports `q`, `limit`, `offset`.
  - `GET /api/v1/admin/quota-requests`: supports `status`, `limit`, `offset`.
  - `GET /api/v1/admin/sessions`: supports `userId`, `limit`, `offset`.
  - These endpoints return `page: { limit, offset, total, hasMore }`.

## Maintainability upgrades

- Extracted reusable UI components from `src/App.tsx`:
  - `src/components/Toggle.tsx`
  - `src/components/PolicyEditor.tsx`
  - `src/components/ProviderEditor.tsx`
- Centralized admin resource fetching in:
  - `src/hooks/useAdminResourceState.ts`
- Added metrics helpers in:
  - `src/lib/userMetrics.ts` (session token parsing, totals, date-wise rollups).
- User click flow now opens a dedicated metrics page:
  - From `Users`, clicking a user opens `User metrics`.
  - The page shows total/input/output tokens and date-wise sessions/token rows.

## Quality gates

Package-level scripts now provide a consistent local/CI gate:

```bash
npm run lint --workspace=packages/admin-web
npm run typecheck --workspace=packages/admin-web
npm run test --workspace=packages/admin-web
npm run build --workspace=packages/admin-web
npm run build:server --workspace=packages/admin-web
npm run check --workspace=packages/admin-web
```

## Cross-package compatibility notes

No code changes were required in the SDKs, desktop app, or A2A server for these admin-web updates because:

- The changed/added environment variables are server-side admin-web settings.
- Client-facing admin auth/env contracts consumed by CLI/desktop/a2a are unchanged.
- Pagination added fields to list responses without removing existing payload keys.

Validation runs:

- `npm run typecheck --workspace=packages/sdk-typescript`
- `python3 -m pytest packages/sdk-python/tests -q`
- `npm run typecheck --workspace=packages/desktop`
- `npm run typecheck --workspace=packages/a2a-server`
