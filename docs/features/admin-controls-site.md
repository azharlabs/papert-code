# Admin Control Site

Papert Code includes an optional admin control site that provides a centralized UI and API for managing CLI permissions. It is designed to be simple to run locally for demos, while offering clear seams for future enterprise hardening (SSO/JWT, database-backed storage, and audit logs).

## What it does

- Defines default policy settings for all users.
- Creates user-specific overrides to enable or disable MCP, extensions, and skills.
- Serves an API that can be consumed by the Papert Code CLI or other clients.
- Manages user credentials, groups, token quotas, and session uploads.

## Package layout

- `packages/admin-web/` — React + Vite admin UI
- `packages/admin-web/server/` — Express API server

## Run locally

```bash
npm install
npm run dev --workspace=packages/admin-web
```

- UI: `http://localhost:4173`
- API: `http://localhost:4180`

## Configuration

Set these environment variables for the API server:

- `PAPERT_ADMIN_PORT` (default `4180`)
- `PAPERT_ADMIN_STORE_PATH` (default `./data/admin-controls.json`)
- `PAPERT_ADMIN_ALLOWLIST` (comma-separated admin user IDs)
- `PAPERT_ADMIN_HEADER` (default `x-admin-user-id`)
- `PAPERT_ADMIN_JWT_SECRET` (JWT signing secret)
- `PAPERT_ADMIN_ENC_KEY` (encryption key for provider API keys)
- `PAPERT_ADMIN_BOOTSTRAP_EMAIL` / `PAPERT_ADMIN_BOOTSTRAP_PASSWORD` (creates first admin)

If `PAPERT_ADMIN_ALLOWLIST` is empty, admin endpoints are open (use only for local demos).
In production (`NODE_ENV=production`), `PAPERT_ADMIN_ALLOWLIST` is required and startup fails if it is empty.

To bootstrap the first admin user:

```bash
export PAPERT_ADMIN_BOOTSTRAP_EMAIL="admin@company.com"
export PAPERT_ADMIN_BOOTSTRAP_PASSWORD="change-me-please"
```

## API endpoints (v1)

- `GET /api/v1/admin-controls?userId=...` — effective controls for a user (JWT required; non-admins can only request their own user ID)
- `POST /api/v1/auth/login` — user/admin login, returns JWT + provider config
- `GET /api/v1/user/config` — user config + permissions (JWT required)
- `POST /api/v1/user/usage` — report token usage (JWT required)
- `POST /api/v1/user/sessions` — upload session transcript (JWT required)
- `POST /api/v1/user/quota-requests` — request quota increase (JWT required)
- `GET /api/v1/admin/users` — list overrides (admin only)
- `POST /api/v1/admin/users` — create user (admin only)
- `PUT /api/v1/admin/users/:id` — update user (admin only)
- `DELETE /api/v1/admin/users/:id` — remove user (admin only)
- `GET /api/v1/admin/groups` — list groups (admin only)
- `POST /api/v1/admin/groups` — create group (admin only)
- `PUT /api/v1/admin/groups/:id` — update group (admin only)
- `DELETE /api/v1/admin/groups/:id` — remove group (admin only)
- `GET /api/v1/admin/usage/:userId` — usage by user (admin only)
- `GET /api/v1/admin/quota-requests` — list quota requests (admin only)
- `POST /api/v1/admin/quota-requests/:id/approve` — approve request
- `POST /api/v1/admin/quota-requests/:id/reject` — reject request
- `GET /api/v1/admin/sessions` — list sessions (admin only)
- `GET /api/v1/admin/sessions/:id` — fetch transcript (admin only)

## How the CLI can consume this

The admin API uses the same schema as `FetchAdminControlsResponse` in core. A CLI or service can request:

```
GET /api/v1/admin-controls?userId=<USER_ID>
Authorization: Bearer <token>
```

and apply the returned JSON as admin settings. This mirrors the `fetchAdminControls` behavior of the Code Assist server.

For local or self-hosted deployments, set these environment variables in the CLI runtime:

- `PAPERT_ADMIN_URL` — base URL of the admin API (e.g., `http://localhost:4180`)
- `PAPERT_ADMIN_EMAIL` / `PAPERT_ADMIN_PASSWORD` — user login credentials
- `PAPERT_ADMIN_TOKEN` — pre-issued JWT for direct admin-controls fetches (recommended for non-interactive overrides)

## Authentication model

- Users (including admins) authenticate via `POST /api/v1/auth/login`.
- The API returns a JWT which must be supplied in `Authorization: Bearer <token>`.
- Admin endpoints additionally require the logged-in user to have role `admin` and be present in `PAPERT_ADMIN_ALLOWLIST` (if configured).

## Future-proofing recommendations

- Replace allowlist gating with SSO/JWT claims tied to your identity provider.
- Move storage to Postgres and add audit logs + retention policies.
- Add organization + group policy layers (org defaults → team policy → user overrides).

## Quotas and usage

Groups can define monthly and daily token limits. The CLI reports token usage after each session; if a user exceeds their quota, the CLI will block further runs and submit a quota increase request.

Users marked as **self-managed** (OpenAI-compatible API users) bypass quota enforcement and receive full access, but usage is still recorded for monitoring.

## Sessions

Each CLI run uploads its JSONL session transcript to the admin API. The admin UI lists sessions and allows viewing full transcripts for audit and troubleshooting.

## Test cases (manual + automated)

Automated tests live in `packages/admin-web/server/*.test.ts` and cover:

- Quota windows and exceeded logic.
- Group/user creation with provider configs.

Manual test checklist:

1. Bootstrap admin user with `PAPERT_ADMIN_BOOTSTRAP_EMAIL` / `PAPERT_ADMIN_BOOTSTRAP_PASSWORD`.
2. Log into the admin UI and create a group with a low token quota.
3. Create a managed user in that group with API key + base URL.
4. Run `papert` with `PAPERT_ADMIN_URL`, `PAPERT_ADMIN_EMAIL`, `PAPERT_ADMIN_PASSWORD`.
5. Verify CLI uses the admin-provided model/base URL and permissions.
6. Exceed token quota and confirm CLI blocks and creates a quota request.
7. Approve the quota request in admin UI and verify CLI runs again.
8. Confirm session transcript appears in the Sessions panel.
