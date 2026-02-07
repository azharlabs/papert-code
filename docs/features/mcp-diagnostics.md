# MCP Diagnostics

Papert Code now includes `/mcp diagnose` to quickly identify MCP connectivity, OAuth, and policy issues.

## What it checks

- Server runtime status (`connected`, `connecting`, `disconnected`)
- Transport type (`stdio`, `sse`, `streamable-http`, `tcp`)
- OAuth enablement and token state
- Policy/extension blocking state
- Suggested next actions

## Usage

```bash
# Diagnose all configured MCP servers
/mcp diagnose

# Diagnose a single server
/mcp diagnose my-server
```

## Output format

`/mcp diagnose` returns one block per server:

- `Server`: configured server name
- `Status`: current MCP status
- `Transport`: detected transport type
- `OAuth`: enabled/disabled
- `Blocked`: yes/no
- `Issues`: detected configuration/runtime problems
- `Next steps`: concrete remediation actions

## Typical fixes

- `OAuth enabled but no stored credentials`: run `/mcp auth <server>`
- `OAuth token is expired`: run `/mcp auth <server>` to refresh tokens
- `Status disconnected`: run `/mcp refresh` to restart MCP servers
- `Server blocked by policy`: review `mcp.allowed`, `mcp.excluded`, and extension trust settings

## Notes for agents and maintainers

- This command is read-only and safe to run in all approval modes.
- Diagnostics are derived from in-memory runtime state plus stored OAuth credentials.
- The command supports shell completion for known MCP server names.
