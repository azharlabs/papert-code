# Eval CI Matrix

Terminal-bench evaluations now have a dedicated CI matrix workflow:

- Workflow: `.github/workflows/terminal-bench-evals.yml`
- Matrix subsets:
  - `fast` (quick deterministic tasks)
  - `full` (includes heavier benchmark task)

## What the workflow does

1. Installs dependencies and builds workspace.
2. Runs `npm run test:terminal-bench:oracle` with subset-specific `TB_TASK_IDS`.
3. Summarizes historical run outputs with:
   - `integration-tests/terminal-bench/scripts/summarize-results.mjs`
4. Uploads artifacts:
   - `terminal-bench-summary-<subset>.json`
   - `terminal-bench-summary-<subset>.md`

## Historical pass-rate output

The summary script aggregates by task:

- runs
- resolved/total
- pass rate
- average accuracy

## Local usage

```bash
node integration-tests/terminal-bench/scripts/summarize-results.mjs \
  --base .integration-tests \
  --out-json .integration-tests/terminal-bench-summary.json \
  --out-md .integration-tests/terminal-bench-summary.md
```
