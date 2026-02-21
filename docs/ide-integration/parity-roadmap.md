# IDE Parity Roadmap

This roadmap tracks feature parity for Papert Code IDE integrations across VS Code, Zed, and JetBrains adapters.

## Parity scope

All adapters target parity for these capabilities:

1. Workspace discovery and trust checks.
2. Live context feed (recent files, selection, cursor).
3. Native diff lifecycle (`open_diff`, `close_diff`, accept/reject actions).
4. Robust reconnect and stale-session cleanup.
5. Command launch and status APIs (`run`, `status`, `enable`, `disable`).
6. Install/update flows with editor-specific guidance.
7. Auth handoff and secure local IPC defaults.
8. Integration test suite coverage with adapter contract tests.

## Current status (February 21, 2026)

| Capability | VS Code Adapter | Zed Adapter | JetBrains Adapter |
| --- | --- | --- | --- |
| Discovery + trust | Stable | Planned | Planned |
| Context feed | Stable | In progress | Planned |
| Diff lifecycle | Stable | In progress | Planned |
| Reconnect + cleanup | Stable | Planned | Planned |
| Command launch/status | Stable | In progress | Planned |
| Installer/update flow | Stable | Planned | Planned |
| Auth + secure IPC defaults | Stable | In progress | Planned |
| Contract tests | Stable | Planned | Planned |

## Milestones

### M1: Protocol adapter contract freeze

- Freeze the `ide-companion-spec` transport + discovery schema for non-breaking adapter implementation.
- Add shared adapter conformance tests for discovery, trust, context payload validation, and diff RPC contracts.
- Publish a compatibility matrix in release notes for CLI + adapter versions.

### M2: Zed parity beta

- Deliver a Zed companion adapter that passes all M1 conformance tests.
- Match VS Code behavior for `/ide enable`, `/ide status`, and diff acceptance workflow.
- Add CI lane for Zed adapter integration tests and reconnect reliability tests.

### M3: JetBrains parity beta

- Deliver a JetBrains protocol adapter supporting IntelliJ family IDEs.
- Reach parity for context feed and diff lifecycle, including multi-project workspace detection.
- Add installer guidance and diagnostics for Toolbox/manual plugin installs.

### M4: Multi-IDE GA parity

- Mark Zed and JetBrains adapters as stable after soak period and flaky-test thresholds are met.
- Enforce adapter parity checks in CI before stable release-channel promotion.
- Maintain a single compatibility table and deprecation policy across all adapters.

## Acceptance gates

- No known P1/P2 reconnect regressions in 14-day soak window.
- Contract test pass rate >= 99.5% on main branch for each adapter.
- `/ide status` parity verified in headless and interactive CLI modes.
- Troubleshooting docs include adapter-specific recovery paths.
