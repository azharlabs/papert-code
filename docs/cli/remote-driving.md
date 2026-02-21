# Remote Driving

Papert Code can run in a **remote driving** mode where your local CLI connects to a remote Papert Code daemon over HTTP.

This is useful when:

- you want to run Papert Code inside a container/VM,
- you want the code execution environment to live on another machine, or
- you want a long-running daemon that multiple clients can connect to (with workspace locking).

> Note: This feature is new and currently has limitations. See [Limitations](#limitations).

## Start a daemon (`papert server` / `papert serve`)

Run a daemon that exposes Papert Code over HTTP:

```bash
papert server --port 41242
```

### Web UI quick profile (local)

If you want to use the web UI locally, you can use this env profile:

```bash
export PAPERT_REMOTE_ENABLED=1
export PAPERT_REMOTE_SERVER_TOKEN=hi
export PAPERT_REMOTE_SESSION_TTL_MS=300000
export CODER_AGENT_PORT=41242
export PAPERT_REMOTE_DOCS_ENABLED=1
export PAPERT_SHARE_PUBLIC_URL_BASE=http://localhost:41242
papert server --host 127.0.0.1 --port 41242 --docs
```

Then open:

- `http://localhost:41242`

By default, `papert server`:

- enables remote driving (`PAPERT_REMOTE_ENABLED=1`)
- generates a random server token (unless you pass `--token`)
- sets the session TTL (lease duration) (default: 60 seconds)

### Options

- `--host <host>`: Host interface to bind to (default: `127.0.0.1`).
- `--port <port>`: Port to bind to (default: `41242`).
- `--token <token>`: Server token required by clients to create a remote session.
- `--allow-empty-token`: Allow session creation without a server token (insecure/local-only).
- `--session-ttl-ms <ms>`: Remote session lease duration in milliseconds.
- `--docs`: Enable Swagger/OpenAPI docs (default: disabled). When enabled:
  - Docs UI is served at `/docs`
  - OpenAPI spec is served at `/openapi.json`

### API docs (Swagger/OpenAPI)

Docs are **disabled by default**. Enable them with either:

- CLI flag: `papert server --docs`
- Environment variable: `PAPERT_REMOTE_DOCS_ENABLED=1`

When enabled, the docs endpoints (`/docs`, `/openapi.json`, and `/docs/*`) are **public** and do **not** require the remote server token or session token.

## Connect from a client (`papert connect`)

On another machine (or another terminal), connect your CLI to the daemon:

```bash
papert connect http://HOST:41242 --token <serverToken>
```

This starts a CLI session that runs against the remote daemon.

For security, `connect` refuses plain HTTP to non-local hosts unless you pass
`--allow-insecure-http`.

## Attach to an existing/new remote session (`papert attach`)

Attach using an existing session:

```bash
papert attach http://HOST:41242 --session-id <sessionId> --session-token <sessionToken>
```

Or create a new session during attach:

```bash
papert attach http://HOST:41242 --server-token <serverToken>
```

For security, `attach` refuses plain HTTP to non-local hosts unless you pass
`--allow-insecure-http`.

## Authentication model (high level)

Remote driving uses two tokens:

- **Server token**: configured on the daemon (`--token` or `PAPERT_REMOTE_SERVER_TOKEN`). Used to create sessions.
- **Session token**: issued by the daemon when the client creates a session. Used for the rest of the requests.

You typically only need to handle the server token directly; the CLI manages the session token for you.

## Session TTL (what `PAPERT_REMOTE_SESSION_TTL_MS` means)

The daemon enforces a **lease** on remote sessions.

`PAPERT_REMOTE_SESSION_TTL_MS` is the lease duration in milliseconds. The important detail is that it is a **sliding TTL**:

- Each time the client makes an authenticated request to the daemon, the daemon renews (“touches”) the session lease.
- If the client makes no authenticated requests for longer than the TTL, the session expires and the daemon releases its workspace lock.

This means the TTL is effectively the maximum idle time allowed between client requests.

## Scheduler control (remote protocol)

The control protocol also supports scheduler requests for non-TTY clients. Useful subtypes:

- `scheduler_list`, `scheduler_status`
- `scheduler_add`, `scheduler_update`, `scheduler_remove`
- `scheduler_run`, `scheduler_runs`
- `scheduler_start`, `scheduler_stop`

Each request can include an optional `cwd` to target a specific project store.

See `packages/sdk-typescript/src/types/protocol.ts` for the request schema.

## MCP control (remote protocol)

Remote control clients can also use MCP control subtypes:

- `mcp_message` to route JSON-RPC traffic to configured MCP servers
- `mcp_server_status` to inspect currently connected/available servers

These routes are advertised through the initialize capabilities response with
`can_handle_mcp_message: true`.

### Control-plane sample client

This example sends a scheduler request over the control protocol using the SDK transport.

```ts
import { createClient } from '@papert-code/sdk-typescript';

async function run() {
  const client = await createClient({
    url: 'http://HOST:41242',
    token: process.env.PAPERT_REMOTE_SERVER_TOKEN,
  });

  // List scheduled jobs
  const list = await client.control({
    subtype: 'scheduler_list',
    cwd: '/path/to/project',
    include_disabled: true,
  });

  console.log(list);

  await client.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

## Limitations

Current limitations (as of this implementation):

- **Single-writer workspace:** the daemon enforces an exclusive lock per `workspaceRoot`. A second client trying to use the same workspace will get a lock conflict.
- **In-memory locks/sessions:** daemon restart clears all sessions and locks.
- **No multi-daemon coordination:** locks are not shared across multiple daemon instances.
- **Idle timeout:** if the client is idle longer than the configured TTL, it must create a new session.

## Troubleshooting

- If you see a workspace lock error, ensure no other session is connected to the same workspace, or wait for the TTL to expire.
- If you see `Unauthorized`, ensure you passed the correct `--token` value to `papert connect`.
