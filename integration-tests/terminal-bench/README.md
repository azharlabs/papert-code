# Terminal-Bench Eval Suite

This directory contains terminal-bench tasks used to evaluate Papert Code behavior on realistic shell/file tasks.

## Task catalog

Tasks are defined in `taskCatalog.ts`:

- `hello-world`
- `json-profile-update`
- `markdown-release-notes`
- `swe-bench-astropy-1`

## How task selection works

By default, all catalog tasks are eligible.

You can scope runs with:

- `TB_TASK_ID=<task-id>`
- `TB_TASK_IDS=<comma-separated-task-ids>`

Examples:

```bash
# Run one task
TB_TASK_ID=hello-world npm run test:terminal-bench:oracle

# Run a subset
TB_TASK_IDS=hello-world,json-profile-update npm run test:terminal-bench:oracle
```

Unknown task IDs fail fast with a clear error.

## Running evals

Oracle-only run:

```bash
npm run test:terminal-bench:oracle
```

Papert-agent run:

```bash
OPENAI_API_KEY=<key> npm run test:terminal-bench:papert
```

Both:

```bash
npm run test:terminal-bench
```

## Authoring a new task

Create a folder under `ci-tasks/<task-id>/` with:

- `task.yaml`
- `Dockerfile`
- `docker-compose.yaml`
- `run-tests.sh`
- `tests/test_outputs.py`
- optional `solution.sh` (for local validation)

Keep tasks deterministic and testable with simple assertions.

## CI and local expectations

- Oracle runs should resolve each task at `accuracy = 1.0`.
- Papert-agent runs require network/API credentials.
- Timeout can be tuned via `TB_TIMEOUT_MINUTES`.
