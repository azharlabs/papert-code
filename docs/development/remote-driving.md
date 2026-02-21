# Remote Driving (daemon/client architecture)

Papert Code can run in a **remote driving** topology where a long-running daemon exposes the normal Papert Code HTTP API, and a CLI instance connects to it from another machine.

This document is written for contributors and integrators who need protocol-level details.

- **CLI usage:** see `docs/cli/remote-driving.md`
- **Implementation:** `packages/a2a-server/src/http/*` and `packages/cli/src/remote/*`

## Overview

In remote driving mode:

- The daemon (server) runs `packages/a2a-server` and listens on a host/port.
- A client runs the Papert Code CLI and connects to the daemon.
- The client creates a **remote session** (with an exclusive workspace lock) via a control-plane endpoint.
- For all subsequent requests, the client attaches:
  - a session identifier header, and
  - a per-session bearer token.

Remote sessions are **leased** and **renewed** automatically on each authenticated request.

## Enabling remote driving

Remote driving endpoints are disabled by default.

To enable them on the daemon process, set:

- `PAPERT_REMOTE_ENABLED=1`
- `PAPERT_REMOTE_SERVER_TOKEN=<server-token>`
- `PAPERT_REMOTE_SESSION_TTL_MS=<milliseconds>` (optional; default: `60000`)

For local web UI development, commonly used values are:

```bash
export PAPERT_REMOTE_ENABLED=1
export PAPERT_REMOTE_SERVER_TOKEN=hi
export PAPERT_REMOTE_SESSION_TTL_MS=300000
export CODER_AGENT_PORT=41242
export PAPERT_REMOTE_DOCS_ENABLED=1
export PAPERT_SHARE_PUBLIC_URL_BASE=http://localhost:41242
papert server --host 127.0.0.1 --port 41242 --docs
```

## Swagger/OpenAPI docs

The daemon can optionally serve API documentation:

- **Docs UI:** `GET /docs`
- **OpenAPI spec:** `GET /openapi.json`

Docs are **disabled by default**.

### Enabling docs

Enable docs with either:

- CLI flag: `papert server --docs`
- Environment variable: `PAPERT_REMOTE_DOCS_ENABLED=1`

### Interaction with remote auth

Remote driving uses bearer tokens for the control plane and API requests.

When `PAPERT_REMOTE_DOCS_ENABLED=1`, the docs endpoints (`/docs`, `/openapi.json`, and `/docs/*`) are **allowlisted** and do **not** require remote auth headers.

This makes the docs effectively **public**, so only enable them on trusted networks or behind an authenticating proxy.

## HTTP endpoints

Remote driving introduces a small **control plane** under `/api/v1/*`.

### `GET /api/v1/health`

Health check for remote driving.

- **Auth:** none
- **Response:** `{ "ok": true }`

### `POST /api/v1/sessions`

Creates a remote session and attempts to acquire an **exclusive workspace lock** for the requested workspace root.

#### Request

- **Headers**
  - `Authorization: Bearer <serverToken>`
- **Body**

```json
{
  "workspaceRoot": "/absolute/path/on-daemon"
}
```

#### Response

- `200 OK` on success:

```json
{
  "sessionId": "<id>",
  "sessionToken": "<token>",
  "workspaceRoot": "/absolute/path/on-daemon"
}
```

- `401 Unauthorized` if the `serverToken` is missing/invalid.
- `409 Conflict` if the workspace is already locked:

```json
{
  "error": "Workspace is locked by another session",
  "code": "WORKSPACE_LOCKED"
}
```

### `POST /api/v1/sessions/:sessionId/release`

Releases a remote session and frees its workspace lock.

#### Request

- **Headers**
  - `Authorization: Bearer <sessionToken>`

#### Response

- `200 OK` on success
- `401 Unauthorized` if the session token is missing/invalid

## Auth model and required headers

Remote driving uses two bearer-token tiers:

1. **Server token** (`PAPERT_REMOTE_SERVER_TOKEN`)
   - Used only for control-plane operations.
   - Currently required only for `POST /api/v1/sessions`.

2. **Session token** (returned by `POST /api/v1/sessions`)
   - Used for all subsequent daemon requests.

Once a session is established, every request that should run “inside” the remote session must include:

- `x-papert-session-id: <sessionId>`
- `Authorization: Bearer <sessionToken>`

The daemon rejects requests without both values.

## Workspace lock semantics

Remote driving enforces **exclusive** access to a daemon workspace root:

- A session is created for a specific `workspaceRoot`.
- On session creation, the daemon attempts to acquire a lock for that `workspaceRoot`.
- While the lock is held:
  - Only the lock-owning session can make authenticated requests that target that workspace.
  - Other sessions attempting to create a session for the same `workspaceRoot`, or make requests against it, will receive `409 WORKSPACE_LOCKED`.
- The lock is released when:
  - the client explicitly calls `POST /api/v1/sessions/:sessionId/release`, or
  - the session expires (see TTL / leases below).

**Important:** The lock is per daemon process memory. If the daemon restarts, all locks/sessions are lost.

## Session TTL and lease renewal

`PAPERT_REMOTE_SESSION_TTL_MS` defines the **lease duration** for a remote session.

More precisely:

- When a session is created, the daemon sets an internal `expiresAtMs = now + PAPERT_REMOTE_SESSION_TTL_MS`.
- On **every authenticated request** that includes a valid session id and session token, the daemon **touches** the session and renews the lease:

  `expiresAtMs = now + PAPERT_REMOTE_SESSION_TTL_MS`

- If the daemon observes `now > expiresAtMs` when validating the session, it treats the session as expired:
  - the session is released, and
  - its workspace lock is freed.

This is a *sliding* TTL. It is not “time since creation”; it is “time since last authenticated request”.

Practical implications:

- Set the TTL long enough to cover expected client idle times.
- If a client pauses for longer than the TTL, it must create a new session.

## Streaming (SSE)

Some daemon endpoints stream results using **Server-Sent Events (SSE)**.

- **Request header:** `Accept: text/event-stream`
- **Response header:** `Content-Type: text/event-stream`

SSE is used when a command/task supports incremental output.

Notes:

- SSE responses are one-way (server → client). The client keeps the connection open to receive updates.
- Remote auth headers (`x-papert-session-id` + `Authorization`) still apply to streaming requests.

## CLI commands and current limitations

Remote driving is currently surfaced via two terminal commands:

- `papert server` / `papert serve`
- `papert web`
- `papert connect <url> --token <serverToken>`
- `papert attach <url> --server-token <serverToken>`

See `docs/cli/remote-driving.md` for user-facing details.

Current limitations (implementation-defined; may change):

- Workspace locks are **in-memory** and are not shared between multiple daemon instances.
- If the daemon process dies or restarts, clients must reconnect and create new sessions.
- Session renewal is request-driven; if the client is idle longer than `PAPERT_REMOTE_SESSION_TTL_MS`, the session will expire.
