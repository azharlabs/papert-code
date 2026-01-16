# Remote Driving

Papert Code can run in a **remote driving** mode where your local CLI connects to a remote Papert Code daemon over HTTP.

This is useful when:

- you want to run Papert Code inside a container/VM,
- you want the code execution environment to live on another machine, or
- you want a long-running daemon that multiple clients can connect to (with workspace locking).

> Note: This feature is new and currently has limitations. See [Limitations](#limitations).

## Start a daemon (`papert server`)

Run a daemon that exposes Papert Code over HTTP:

```bash
papert server --host 0.0.0.0 --port 41242
```

By default, `papert server`:

- enables remote driving (`PAPERT_REMOTE_ENABLED=1`)
- generates a random server token (unless you pass `--token`)
- sets the session TTL (lease duration) (default: 60 seconds)

### Options

- `--host <host>`: Host interface to bind to (default: `0.0.0.0`).
- `--port <port>`: Port to bind to (default: `41242`).
- `--token <token>`: Server token required by clients to create a remote session.
- `--session-ttl-ms <ms>`: Remote session lease duration in milliseconds.

## Connect from a client (`papert connect`)

On another machine (or another terminal), connect your CLI to the daemon:

```bash
papert connect http://HOST:41242 --token <serverToken>
```

This starts a CLI session that runs against the remote daemon.

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

## Limitations

Current limitations (as of this implementation):

- **Single-writer workspace:** the daemon enforces an exclusive lock per `workspaceRoot`. A second client trying to use the same workspace will get a lock conflict.
- **In-memory locks/sessions:** daemon restart clears all sessions and locks.
- **No multi-daemon coordination:** locks are not shared across multiple daemon instances.
- **Idle timeout:** if the client is idle longer than the configured TTL, it must create a new session.

## Troubleshooting

- If you see a workspace lock error, ensure no other session is connected to the same workspace, or wait for the TTL to expire.
- If you see `Unauthorized`, ensure you passed the correct `--token` value to `papert connect`.
