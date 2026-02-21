# Web Rewind Panel

The Web UI now includes a dedicated **Rewind** view for checkpoint restore workflows.

## Location

- Open the Web UI menu bar and select `Rewind`.

## What you can do

- View available rewind points from `.gemini/checkpoints`.
- Inspect each checkpoint’s:
  - checkpoint id
  - source tool name
  - restore type (`chat-only` or `file+chat`)
  - last updated timestamp
- Click **Use** to prefill `/rewind <checkpoint-id>` in chat input.

## Execution model

- The panel does not bypass safety.
- Rewind execution still happens through the CLI command flow.
- `/rewind` continues to require explicit confirmation before restore.

## Data source

- Endpoint: `GET /api/v1/webui/catalog`
- Added payload: `rewindPoints[]`
- Checkpoint lookup path: `<workspace>/.gemini/checkpoints/*.json`
- Catalog entries include only valid checkpoints that pass parse + integrity checks.

## Troubleshooting

- No entries shown:
  - ensure a session is connected
  - run tool activity that creates checkpoints
  - click **Refresh**
- Entries show `chat-only`:
  - checkpoint did not include a git `commitHash`
  - file rollback is unavailable for that checkpoint
