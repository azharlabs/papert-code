# Scheduler

Papert Code includes a simple scheduler for recurring or one-shot prompts. It stores jobs per project and runs them on a configured interval.

## Concepts

- **Jobs**: A job is a named prompt with a schedule.
- **Schedules**:
  - `every` — recurring interval (e.g. `10m`, `2h`, `1d`).
  - `at` — one-shot timestamp (ISO-8601).
- **Storage**: Jobs are stored per project at:

```
~/.papert/projects/<project-id>/schedule/jobs.json
```

`<project-id>` is derived from the project path (sanitized by Papert).

## Quick start

```bash
# Create a recurring job
papert schedule add \
  --name "Daily summary" \
  --every 24h \
  --prompt "Summarize the open PRs and list next steps."

# Start the scheduler loop (runs continuously)
papert schedule start
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

Options:

- `--every <duration>`: Interval string (`ms`, `s`, `m`, `h`, `d`, `w`).
- `--at <iso>`: ISO-8601 timestamp for a one-shot run.
- `--model <id>`: Override model for this job.
- `--approval-mode <plan|default|auto-edit|yolo>`: Override approval mode for this job.
- `--output-format <text|json|stream-json>`: Output format for the run.
- `--max-session-turns <n>`: Cap the number of turns for the run.
- `--cwd <path>`: Project directory that owns the schedule file and default execution directory.
- `--delete-after-run`: Remove one-shot job after a successful run.

### List jobs

```bash
papert schedule list
papert schedule list --all
papert schedule list --json
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

### Remove a job

```bash
papert schedule remove <job-id>
```

### Start the scheduler loop

```bash
papert schedule start
```

The scheduler keeps running until you stop it with `Ctrl+C`. Jobs run sequentially to avoid overlapping output. Each run executes a fresh `papert` process with the stored prompt and options.

## Duration syntax

Use one or more segments with units:

- `ms`, `s`, `m`, `h`, `d`, `w`

Examples:

- `45s`
- `10m`
- `2h`
- `1d`
- `1h30m`

## Notes

- The scheduler does not run unless `papert schedule start` is running.
- One-shot jobs (`--at`) stay due until they succeed; on success they are disabled (or deleted with `--delete-after-run`).
- Environment variables and settings are inherited from the scheduler process.

## Troubleshooting

- **Nothing runs:** Ensure you started the loop with `papert schedule start`.
- **Wrong project:** Use `--cwd <path>` to target the correct project schedule file.
- **Auth errors:** The scheduler uses your existing Papert/OpenAI credentials. Make sure they are configured in environment variables or settings files.
