# Eval Suite Expansion

The terminal-bench evaluation suite has been expanded with additional deterministic tasks and a central task catalog.

## New capabilities

- Added `taskCatalog.ts` for a single source of truth for eval task IDs.
- Added task-selection helper with validation for `TB_TASK_ID` and `TB_TASK_IDS`.
- Added catalog unit tests to prevent task-selection regressions.
- Added two new deterministic terminal-bench tasks:
  - `json-profile-update`
  - `markdown-release-notes`

## Why this helps

- Easier to grow eval coverage without editing core test logic.
- Better confidence on structured-output/file-authoring scenarios.
- Cleaner CI filtering for single-task or subset runs.

## How to run

```bash
# Oracle only
npm run test:terminal-bench:oracle

# Single task
TB_TASK_ID=json-profile-update npm run test:terminal-bench:oracle

# Multiple tasks
TB_TASK_IDS=hello-world,markdown-release-notes npm run test:terminal-bench:oracle
```

For full agent runs, provide `OPENAI_API_KEY` and use `npm run test:terminal-bench:papert`.
