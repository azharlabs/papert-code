# Changelog

## 0.3.94

- Added dynamic web command catalog loading from `listCommands`.
- Added web rewind panel with checkpoint catalog support.
- Added richer MCP diagnostics with transport probing.
- Added policy deny reason surfacing in the web event stream.
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
