# Scheduler

Papert Code includes a scheduler for recurring, cron, and one-shot jobs. Jobs live per project and can run in the **main session** or in an **isolated run**, with optional delivery targets (Slack/Discord/Telegram) and run history logging.

## Concepts

- **Jobs**: A named task with a schedule and payload (prompt or heartbeat).
- **Schedules**:
  - `every` - recurring interval (e.g. `10m`, `2h`, `1d`).
  - `at` - one-shot timestamp (ISO-8601).
  - `cron` - cron expression with optional timezone.
- **Heartbeat jobs**: lightweight check-ins that post reminders or status without running a full prompt.
- **Session targeting**:
  - `main` - run the prompt in the active chat session.
  - `isolated` - run in a clean session and post a summary back to main.
- **Run history**: each run is logged to JSONL for audit/debugging.

## Storage

Jobs are stored per project at:

```
~/.papert/projects/<project-id>/schedule/jobs.json
```

Run history lives alongside the store:

```
~/.papert/projects/<project-id>/schedule/runs/<job-id>.jsonl
```

`<project-id>` is derived from the project path (sanitized by Papert).

## Quick start

```bash
# Create a recurring prompt job
papert schedule add \
  --name "Daily summary" \
  --every 24h \
  --prompt "Summarize the open PRs and list next steps."

# Start the scheduler loop (runs continuously)
papert schedule start
```

## Cron + time zones

```bash
papert schedule add \
  --name "Weekday standup" \
  --cron "0 9 * * 1-5" \
  --tz "America/Los_Angeles" \
  --prompt "Summarize status, blockers, and next actions."
```

## Heartbeat mode

Heartbeat jobs do **not** run a full LLM prompt. They emit a lightweight check-in message.

```bash
papert schedule heartbeat \
  --name "Ping" \
  --text "Quick check-in: review critical alerts" \
  --every 15m
```

## Delivery targets (Slack/Discord/Telegram)

```bash
papert schedule add \
  --name "Nightly digest" \
  --every 24h \
  --prompt "Summarize key changes" \
  --deliver slack \
  --deliver-url "https://hooks.slack.com/..."
```

Telegram:

```bash
papert schedule add \
  --name "Build ping" \
  --every 30m \
  --prompt "Check CI status" \
  --deliver telegram \
  --telegram-token "..." \
  --telegram-chat-id "..."
```

## Isolated runs + summaries to main

Use isolated runs to keep long jobs out of the main session, then post the summary back:

```bash
papert schedule add \
  --name "Isolated report" \
  --every 6h \
  --prompt "Generate a report" \
  --session-target isolated \
  --post-to-main-prefix "Report" \
  --post-to-main-mode summary
```

## Concurrency controls

```bash
papert schedule start --max-concurrent 2 --queue-policy skip
```

- **max-concurrent** limits concurrent runs.
- **queue-policy** controls whether extra runs are queued or skipped.
- Use `--no-overlap` per job to prevent overlapping runs of the same job.

## Webhook triggers

Start the webhook server:

```bash
papert schedule webhook start --port 7111 --token "my-secret"
```

Trigger a job via HTTP POST:

```bash
curl -X POST \
  -H "Authorization: Bearer my-secret" \
  http://127.0.0.1:7111/webhook/<job-id>
```

Tip: you can trigger by name using `?by=name`:

```bash
curl -X POST "http://127.0.0.1:7111/webhook/Daily%20summary?by=name"
```

## GitHub webhook example

This example triggers a scheduler job when a GitHub webhook fires (push or PR events).

1) Start the webhook server with a shared secret token:

```bash
papert schedule webhook start --port 7111 --token "secret"
```

2) Add a scheduler job to run when the webhook is hit:

```bash
papert schedule add \
  --name "GitHub webhook job" \
  --every 1h \
  --prompt "Summarize the latest GitHub activity for this repo."
```

3) Create a GitHub webhook pointing to:

```
http://<public-host>:7111/webhook/GitHub%20webhook%20job?by=name&token=secret
```

4) Use this example payload (push event), sent by GitHub automatically:

```json
{
  "ref": "refs/heads/main",
  "repository": {"full_name": "org/repo"},
  "pusher": {"name": "octocat"},
  "commits": [
    {"id": "abc123", "message": "Fix build", "author": {"name": "octocat"}}
  ]
}
```

Note: the scheduler does not parse payloads today; it uses the webhook to trigger the job. If you want payload-aware prompts, tell me and I will add it.

## CI trigger example (GitHub Actions)

You can trigger jobs from CI using curl.

```yaml
name: Trigger Papert Scheduler
on:
  workflow_dispatch:
  schedule:
    - cron: '0 8 * * *'

jobs:
  trigger:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger scheduler job
        run: |
          curl -X POST \
            -H "Authorization: Bearer $PAPERT_WEBHOOK_TOKEN" \
            "http://<public-host>:7111/webhook/<job-id>"
        env:
          PAPERT_WEBHOOK_TOKEN: ${{ secrets.PAPERT_WEBHOOK_TOKEN }}
```

## Commands

### Add a job

```bash
papert schedule add \
  --name "Status ping" \
  --every 30m \
  --prompt "Summarize git status and failing tests."
```

One-shot job:

```bash
papert schedule add \
  --name "Release check" \
  --at "2026-02-01T09:00:00Z" \
  --prompt "Run the release checklist."
```

Options (subset):

- `--every <duration>`: Interval string (`ms`, `s`, `m`, `h`, `d`, `w`).
- `--cron <expr>`: Cron expression for schedules.
- `--tz <tz>`: Time zone for cron (e.g. `America/Los_Angeles`).
- `--preset <name>`: Prebuilt schedule (`hourly`, `daily`, `weekday-morning`, `heartbeat-5m`, `heartbeat-15m`).
- `--session-target <main|isolated>`: Execution target.
- `--post-to-main-*`: Configure isolated summaries posted to main.
- `--deliver ...`: Delivery targets.
- `--no-overlap`: Prevent overlapping runs for this job.

### List jobs

```bash
papert schedule list
papert schedule list --all
papert schedule list --json
```

### Run history

```bash
papert schedule runs <job-id> --limit 20
```

### Run a job now

```bash
papert schedule run <job-id>
papert schedule run <job-id> --force
```

### Enable / disable jobs

```bash
papert schedule disable <job-id>
papert schedule enable <job-id>
```

### Update a job

```bash
papert schedule update <job-id> --prompt "Updated prompt" --cron "0 8 * * *" --tz "UTC"
```

### Remove a job

```bash
papert schedule remove <job-id>
```

### Start the scheduler loop

```bash
papert schedule start
```

### Show scheduler status

```bash
papert schedule status
```

### Guidance

```bash
papert schedule guide
```

## UI panel

In the terminal UI, use:

```
/schedule panel
```

This shows a list of jobs, next/last run, status, delivery target, and session target.

## Notes

- The scheduler does not run unless `papert schedule start` is running.
- One-shot jobs (`--at`) stay due until they succeed; on success they are disabled (or deleted with `--delete-after-run`).
- Environment variables and settings are inherited from the scheduler process.

## Troubleshooting

- **Nothing runs:** Ensure you started the loop with `papert schedule start`.
- **Wrong project:** Use `--cwd <path>` to target the correct project schedule file.
- **Auth errors:** The scheduler uses your existing Papert/OpenAI credentials. Make sure they are configured in environment variables or settings files.
