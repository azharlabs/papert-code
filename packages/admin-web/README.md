# Papert Admin Controls

This package provides a lightweight admin control plane for Papert Code. It ships with:

- A React + Vite admin UI.
- A Node/Express API server that stores user policy overrides.
- A dedicated user metrics page (date-wise sessions + input/output/total token usage).

## Quick start

```bash
# From repo root
npm install

# Start the API server + UI
npm run dev --workspace=packages/admin-web
```

The UI defaults to `http://localhost:4173` and proxies `/api` requests to the API server on `http://localhost:4180`.

## Environment variables

- `PAPERT_ADMIN_PORT` (default `4180`): API server port.
- `PAPERT_ADMIN_STORE_PATH` (default `./data/admin-controls.sqlite`): SQLite database file.
- `PAPERT_ADMIN_SESSIONS_DIR` (default `./data/sessions`): directory used to store uploaded session transcripts.
- `PAPERT_ADMIN_ALLOWLIST` (comma-separated): admin user IDs that can access admin endpoints.
- `PAPERT_ADMIN_HEADER` (default `x-admin-user-id`): header used to identify admin user.
- `PAPERT_ADMIN_CORS_ORIGINS` (comma-separated): allowed browser origins for CORS (required in production).
- `PAPERT_ADMIN_JWT_SECRET`: JWT signing secret for user/admin login.
- `PAPERT_ADMIN_ENC_KEY`: 32-byte encryption key for storing provider API keys.
- `PAPERT_ADMIN_BOOTSTRAP_EMAIL` / `PAPERT_ADMIN_BOOTSTRAP_PASSWORD`: create the first admin user if no users exist.

See `.env.example` for a full starter configuration. Copy it to `.env` and restart the server to bootstrap an admin.

If `PAPERT_ADMIN_ALLOWLIST` is empty, admin endpoints are open (use only for local demos).
If `PAPERT_ADMIN_CORS_ORIGINS` is empty, CORS accepts all origins (use only for local demos).

Bootstrap the first admin user:

```bash
export PAPERT_ADMIN_BOOTSTRAP_EMAIL="admin@company.com"
export PAPERT_ADMIN_BOOTSTRAP_PASSWORD="change-me-please"
```

## API endpoints (v1)

- `GET /api/v1/admin-controls?userId=...` → returns effective controls for a user.
- `POST /api/v1/auth/login` → login to receive JWT.
- `GET /api/v1/user/config` → fetch user config + permissions (JWT).
- `POST /api/v1/user/usage` → report token usage (JWT).
- `POST /api/v1/user/sessions` → upload session transcript (JWT).
- `POST /api/v1/user/quota-requests` → request quota increase (JWT).
- `GET /api/v1/admin/users` → list overrides (admin only, supports `q`, `limit`, `offset`).
- `POST /api/v1/admin/users` → create user (admin only).
- `PUT /api/v1/admin/users/:id` → update user (admin only).
- `DELETE /api/v1/admin/users/:id` → remove user (admin only).
- `GET /api/v1/admin/groups` → list groups (admin only).
- `POST /api/v1/admin/groups` → create group (admin only).
- `PUT /api/v1/admin/groups/:id` → update group (admin only).
- `DELETE /api/v1/admin/groups/:id` → remove group (admin only).
- `GET /api/v1/admin/usage/:userId` → usage by user (admin only).
- `GET /api/v1/admin/quota-requests` → list quota requests (admin only, supports `status`, `limit`, `offset`).
- `POST /api/v1/admin/quota-requests/:id/approve` → approve request.
- `POST /api/v1/admin/quota-requests/:id/reject` → reject request.
- `GET /api/v1/admin/sessions` → list sessions (admin only, supports `userId`, `limit`, `offset`).
- `GET /api/v1/admin/sessions/:id` → fetch transcript (admin only).

List endpoints that support `limit`/`offset` also return:
`page: { limit, offset, total, hasMore }`.

## Data model

The stored data uses SQLite with the following logical shape:

```
groups:  name, controls_json, provider_json, quota_monthly, quota_daily
users:   email, password_hash, role, group_id, self_managed, provider_json, controls_json
usage:   user_id, period, period_start, tokens_used, prompt_tokens, completion_tokens
sessions: user_id, session_id, usage_json, transcript_path
quota_requests: user_id, requested_monthly, status
```

`POST /api/v1/user/usage` accepts:

- `totalTokens` (required)
- `promptTokens` (optional; defaults to `0`)
- `completionTokens` (optional; defaults to `0`)

## UI flow: user metrics page

1. Open the `Users` tab.
2. Click any user row.
3. The app navigates to `User metrics` for that user.
4. Review:
   - total tokens so far
   - input/output token totals
   - date-wise rows with session counts and token totals
5. Click `Back to users` to return to policy editing.

## CLI integration (override URL)

To have Papert Code fetch policies from this admin server, set:

```bash
export PAPERT_ADMIN_URL="http://localhost:4180"
export PAPERT_ADMIN_EMAIL="developer@company.com"
export PAPERT_ADMIN_PASSWORD="your-password"
```

## Tests

```bash
npm run test --workspace=packages/admin-web
npm run typecheck --workspace=packages/admin-web
npm run lint --workspace=packages/admin-web
npm run check --workspace=packages/admin-web
```

## Operational notes

See [hardening-and-maintenance.md](./docs/hardening-and-maintenance.md) for
security, reliability, pagination, and cross-package compatibility notes.

## Future-proofing hooks

- The API is versioned at `/api/v1/...` to allow evolution.
- Storage uses SQLite today; swap `AdminRepo` to Postgres for production scale.
- Admin access is protected by JWT + allowlist; replace with SSO/JWT claims later.
