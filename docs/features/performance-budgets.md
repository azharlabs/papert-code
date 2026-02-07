# Performance Budgets

Papert Code now enforces file-size performance budgets for critical hot-path modules.

## Guardrail design

- Budget source: `scripts/perf-budgets.json`
- Checker: `scripts/perf-budgets.mjs`
- Shared logic: `scripts/lib/perfBudgets.mjs`
- Unit tests: `scripts/tests/perf-budgets.test.js`

## CI integration

`lint:ci` now includes `npm run perf:check`.

This means pull requests fail early when a critical module grows past its budget.

## Running locally

```bash
npm run perf:check
```

Output includes:

- pass/fail per budget
- actual bytes
- max bytes
- delta to budget

## Updating budgets

Edit `scripts/perf-budgets.json` when a growth is intentional and justified.

Recommended process:

1. Keep budgets tight to preserve responsiveness in hot paths.
2. Include code-level refactors before raising limits.
3. Raise only the specific budget that needs adjustment.
