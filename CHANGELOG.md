# Changelog

## 0.3.97

- Fixed A2A Web UI rewind checkpoint discovery to use Papert checkpoint storage instead of legacy `.gemini/checkpoints`.
- Hardened A2A share storage/auth by hashing share secrets at rest and using timing-safe token/secret verification.
- Added strict request-body validation (including unknown-field rejection) for high-risk Web UI mutating endpoints.
- Switched JSON-backed A2A state/settings/schedule writes to serialized atomic updates to reduce concurrent write loss.
- Expanded A2A regression coverage for share security and web-ui validation paths.
- Promoted `GET/PUT /api/v1/webui/state` into stable OpenAPI contract coverage and regenerated both TypeScript/Python remote API SDK clients.
- Promoted share endpoints (`POST /api/v1/share`, `GET/DELETE /api/v1/share/{id}`) into OpenAPI contract and SDK clients.
- Refactored A2A Web UI mutation handlers into `webUiMutations.ts` to reduce `app.ts` complexity while preserving existing API behavior.
- Added A2A hardening notes in `packages/a2a-server/docs/a2a-hardening-2026-03.md` and clarified OpenAPI stable-contract scope in docs.

## 0.3.96

- Fixed `core` non-interactive tool executor test expectations to include current error `reason` payloads.
- Fixed `core` task tool tests to await async subagent refresh before asserting dynamic description/schema.
- Fixed `cli` extension list tests by mocking `loadUserExtensions` (the actual extension source used by the component).
- Updated `cli` subcommand tests for current server/connect execution behavior in test runtime.
- Updated remote-driving integration tests for non-local insecure HTTP gating and normalized daemon URL (`/`) expectations.
- Verified full workspace tests are green: `packages/core` and `packages/cli`.

## 0.3.95

- Added dynamic web command catalog loading from `listCommands`.
- Added web rewind panel with checkpoint catalog support.
- Added richer MCP diagnostics with transport probing.
- Fixed non-interactive control-plane MCP routing by enabling `mcp_message` and `mcp_server_status` dispatch and advertising `can_handle_mcp_message`.
- Exposed MCP operations on `ControlService` (`getMcpClient`, `listServers`) and added non-interactive control service coverage.
- Canonicalized `PAPERT_*` environment variables for sandboxing, telemetry, and relaunch controls while keeping `GEMINI_*` aliases with deprecation warnings.
- Added `papert migrate --from-gemini` to rewrite legacy `GEMINI_*` env variable names in project config files.
- Added a provider-agnostic model availability state machine with explicit `terminal`, `transient`, and `sticky_retry` transitions.
- Tightened model policy-chain validation coverage to enforce exactly one `isLastResort` model in resolved chains.
- Standardized policy/tool deny reason surfacing across TUI tool status, web event handling, SDK stream control replies, and headless JSON `permission_denials`.
- Hardened checkpoint restore/rewind by adding checkpoint integrity envelopes and verification before applying state rollback.
- Improved `/rewind` UX with richer metadata previews and a legacy-checkpoint safety gate (`--allow-legacy`) before confirmation.
- Added `/sandbox` self-diagnostics for profiles, mounts, network/proxy status, UID/GID identity, and tool availability checks.
- Enforced release-channel promotion gates (`nightly -> preview -> stable`) with configurable soak windows before promotion.
- Added CI deflake workflow for integration suites with automatic flaky-signature extraction, warnings, and artifacted reports.
- Split CI into dedicated lanes for CLI, SDK, and sandbox integration suites.
- Published a cleaned architecture boundary guide across `core`, `cli`, `sdk`, `web` (`a2a-server`), and `desktop`.
- Added `papert config explain` to inspect effective config values with per-key precedence/source attribution.
- Added `papert auth diagnose` and `papert auth use <oauth|api-key|enterprise>` for faster auth diagnostics and switching.
- Expanded TypeScript SDK integration coverage for multi-agent + MCP + permission/abort behavior and wired `sdkMcpServers` into Query initialization and MCP request routing.
- Stabilized TypeScript SDK builds by adding DOM libs to `tsconfig.build.json`, eliminating `HeadersInit` d.ts bundle fallback errors.
- Hardened headless session restore reliability for `--continue`/`--resume` by tolerating recoverable load failures on `--continue` and returning explicit actionable errors for `--resume`.
- Hardened remote multi-client flow by adding secure-HTTP defaults for `papert connect` (non-local HTTP now requires `--allow-insecure-http`) and enforcing the same policy in remote session bootstrap.
- Added release channel selector and status surfacing in the web UI.
- Hardened A2A OpenAPI contracts for web UI authentication paths.
- Added terminal benchmark evaluation matrix and summary artifacts in CI.
- Added CI bundle budget guardrails and performance artifact publishing.
- Extended GitHub run command support with ref inputs and run status output.
- Added end-to-end operations documentation for feature usage and testing.
- Hardened web UI rendering against XSS by sanitizing markdown/HTML and escaping dynamic list content.
- Hardened admin session upload handling with strict `sessionId` validation and a defensive path traversal guard.
- Hardened admin auth/crypto defaults by replacing static fallback secrets with ephemeral dev-only values and requiring explicit secrets in production.
- Secured `GET /api/v1/admin-controls` behind JWT auth and enforced self-only access for non-admin users.
- Enforced bearer-token authentication for all VS Code IDE companion HTTP requests (removed unauthenticated compatibility path).
- Secured share creation routes by defaulting share auth to `PAPERT_REMOTE_SERVER_TOKEN` when `PAPERT_SHARE_TOKEN` is not configured.
- Hardened CLI auto-update execution by removing `shell: true`, parsing update commands safely, and validating release tags.
- Added a production startup guard that requires `PAPERT_ADMIN_ALLOWLIST` for admin-web deployments.
- Updated placeholder agent tools to return explicit `EXECUTION_FAILED` results instead of misleading success messages.
- Replaced placeholder audio token counting with a bounded mime-aware heuristic and added tokenizer coverage for audio inputs.
- Fixed `cli` and `core` test regressions (config mock compatibility, auth dialog defaults, settings snapshots, scrolling assertions) and stabilized `cli` coverage output by creating `coverage/.tmp` in test setup.
