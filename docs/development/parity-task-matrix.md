# Gemini, Qwen, and OpenCode Parity Matrix

This matrix tracks the 30 requested parity tasks and where each one landed in `papert-code`.

Status summary:

- Completed: 30 / 30
- Last audited: 2026-02-21

## Task Matrix

1. `[Gemini]` Canonical `PAPERT_*` env vars with deprecated `GEMINI_*` aliases and warnings.  
   Commit: `38e0681`
2. `[Gemini]` Migration command to rewrite Gemini naming to Papert naming.  
   Commit: `db5abc6`
3. `[Gemini]` Provider-agnostic model availability state machine.  
   Commit: `58d7311`
4. `[Gemini]` Strict policy-chain validation (exactly one last-resort model).  
   Commit: `84dfbbb`
5. `[Gemini]` Consistent deny reasons in TUI, web events, SDK streams, and JSON output.  
   Commit: `a8efb31`
6. `[Gemini]` Checkpoint integrity checks before restore/rewind.  
   Commit: `32833e2`
7. `[Gemini]` Rewind UX hardening (preview metadata and confirmation safeguards).  
   Commit: `15b9da9`
8. `[Gemini]` Sandbox self-diagnostics command.  
   Commit: `80d2b8f`
9. `[Gemini]` Release-channel promotion gates (`nightly -> preview -> stable`) with soak criteria.  
   Commit: `4523f34`
10. `[Gemini]` CI deflake workflow and flaky signature reporting.  
    Commit: `7296240`
11. `[Qwen]` CI lanes split for CLI, SDK, and sandbox integration.  
    Commit: `575fa7d`
12. `[Qwen]` Clean architecture doc for core/cli/sdk/web/desktop boundaries.  
    Commit: `47a7fe4`
13. `[Qwen]` `papert config explain` with effective config and precedence source.  
    Commit: `a9ed622`
14. `[Qwen]` Auth diagnostics and easy auth switching.  
    Commit: `b86b8b2`
15. `[Qwen]` SDK integration tests for multi-agent, MCP, permission hooks, and abort.  
    Commits: `25240b2`, `41a5868`
16. `[Qwen]` Headless reliability tests for `--continue` and `--resume` edge cases.  
    Commits: `91cf675`, `40e7d18`
17. `[Qwen]` IDE integration parity roadmap for VS Code, Zed, and JetBrains adapters.  
    Commit: `cf1f166`
18. `[Qwen]` Command-catalog parity checker for CLI commands vs docs.  
    Commit: `01890ad`
19. `[Qwen]` Installer improvements with post-install health checks and platform guidance.  
    Commit: `c2262ad`
20. `[Qwen]` `/bug` command with sanitized diagnostics and repro bundle.  
    Commit: `94ed8cc`
21. `[OpenCode]` Permission DSL (`allow/ask/deny`, wildcard patterns, last-match wins).  
    Commit: `3074d49`
22. `[OpenCode]` Granular bash permission rules with command-prefix matching.  
    Commit: `ad000f2`
23. `[OpenCode]` `external_directory` permission class for out-of-workspace controls.  
    Commit: `f8361bf`
24. `[OpenCode]` `doom_loop` protection for repeated identical tool calls.  
    Commit: `faead09`
25. `[OpenCode]` Per-agent permission overrides merged over global policy.  
    Commit: `30c01ac`
26. `[OpenCode]` Explicit mode profiles (`build`, `plan`, `review`) with tool gating and hot switching.  
    Commit: `d35c0b2`
27. `[OpenCode]` Markdown-defined custom modes/agents from project/global folders.  
    Commit: `f91188c`
28. `[OpenCode]` First-class server mode with stable OpenAPI contract and generated typed SDK clients.  
    Commit: `6d6e15a`
29. `[OpenCode]` Multi-client flow hardening (`serve`, `web`, `attach`, `connect`) with secure defaults.  
    Commits: `1934f88`, `8ff41fe`
30. `[OpenCode]` Structured output mode (JSON schema, retries, typed errors).  
    Commit: `2f0f805`

## Quick Use and Validation

Migration and config:

```bash
papert migrate --from-gemini --dry-run
papert migrate --from-gemini
papert config explain
papert config explain tools.permissions --json
```

Interactive meta commands:

```text
/migrate --from-gemini
/config explain
/auth diagnose
/sandbox diagnose
/mode build
/bug "Short title for repro"
```

Headless structured output:

```bash
papert -p "Return project metadata as JSON" \
  --output-format json \
  --structured-output-schema '{"type":"object","properties":{"name":{"type":"string"}},"required":["name"]}' \
  --structured-output-retries 2
```

Remote security flow:

```bash
papert attach --url https://host:port
papert connect --url https://host:port
```

Targeted regression tests:

```bash
npm run test --workspace packages/cli -- src/config/config.test.ts
npm run test --workspace packages/cli -- src/commands/migrate.test.ts src/ui/commands/migrateCommand.test.ts src/ui/commands/configCommand.test.ts
npm run test --workspace packages/cli -- src/commands/connect.test.ts src/commands/attach.test.ts src/remote/remoteControlService.test.ts
npm run test --workspace packages/core -- src/routing/policyChainValidation.test.ts src/permissions/*.test.ts
npm run build
```

