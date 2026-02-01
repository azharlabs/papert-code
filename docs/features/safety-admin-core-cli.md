# Safety, Admin Controls, and Core/CLI Enhancements

This document describes the safety, governance, and platform improvements recently added to Papert Code. It is intended for contributors and integrators who want to configure or extend these capabilities.

## Overview

The new improvements cover five areas:

1. Safety checks and policy gating before tool execution.
2. Admin-controls polling and dynamic feature gating.
3. A core-level skills system to support headless usage.
4. A model registry with capability metadata and auth scoping.
5. Deferred CLI command execution so admin policy applies before commands run.

Each section below includes architecture, configuration, and extension notes.

## 1) Safety checks and policy gating

### What changed

Papert Code now runs safety checkers before tool execution. This is a preflight layer that can allow, deny, or ask the user before a tool runs.

Key locations:

- `packages/core/src/safety/registry.ts`
- `packages/core/src/safety/checker-runner.ts`
- `packages/core/src/safety/built-in.ts`
- `packages/core/src/safety/protocol.ts`
- `packages/core/src/core/coreToolHookTriggers.ts` (safety preflight integration)
- `packages/core/src/policy/toml-loader.ts` (policy parsing)

### Flow

1. Policies are loaded from TOML (`[[safety_checker]]` entries).
2. Safety checker rules are collected and sorted by priority.
3. For each tool call, the checker runner is invoked before tool execution.
4. Each checker returns `allow`, `deny`, or `ask_user`.
5. Deny results block tool execution immediately.

### Policy configuration

Add safety checker rules in policy TOML files. Example:

```toml
[[safety_checker]]
# Optional: apply to a specific tool name or leave blank for all
toolName = "WriteFileTool"
priority = 1
modes = ["default", "plan"]
# Optional: only apply when args match
argsPattern = "\.env"

[safety_checker.checker]
type = "in-process"
name = "allowed-path"

[safety_checker.checker.config]
# Optional: include or exclude specific argument paths
included_args = ["path", "filePath"]
excluded_args = ["patch"]
```

Supported fields:

- `toolName`: Optional tool name filter.
- `priority`: Higher values win (tier + priority sorting).
- `modes`: Optional approval modes this checker applies to.
- `argsPattern`: Optional regex to filter calls by args stringification.
- `checker`: Required checker config block.

### Checker types

#### In-process checkers

Configured via:

```toml
[safety_checker.checker]
type = "in-process"
name = "allowed-path"
```

Built-in checker:

- `allowed-path`: validates file paths in tool arguments are inside allowed workspace directories. It scans argument fields named like `path`, `file`, `directory`, `source`, `destination`, plus any explicitly included or excluded keys.

Implementation: `packages/core/src/safety/built-in.ts`

#### External checkers

Configured via:

```toml
[safety_checker.checker]
type = "external"
name = "my-checker"
```

External checkers are invoked as subprocesses. The runner sends JSON to stdin and expects a JSON response.

Protocol:

- Input: `SafetyCheckInput` from `packages/core/src/safety/protocol.ts`
- Output: `SafetyCheckResult` (`allow`, `deny`, or `ask_user`)

The runner validates output using Zod and will deny the action if a checker crashes or returns malformed output.

### Config knobs

The checker runner is configured in core `Config` via constructor params:

- `safetyCheckersPath`: Base path to resolve external checker binaries.
- `safetyCheckTimeoutMs`: Timeout for each checker process or in-process check.

Defaults:

- `safetyCheckersPath`: project root (target dir)
- `safetyCheckTimeoutMs`: 5000ms

### Extension points

- Add new in-process checkers by extending `CheckerRegistry.BUILT_IN_IN_PROCESS_CHECKERS`.
- Add external checker binaries to a known directory and reference by name in policy TOML.

## 2) Admin-controls polling and gating

### What changed

Papert Code now polls server-side admin controls and applies feature gates at runtime. This allows administrators to disable MCP, extensions, skills, and similar capabilities without shipping a new client.

Key locations:

- `packages/core/src/code_assist/admin/admin_controls.ts`
- `packages/core/src/code_assist/types.ts`
- `packages/cli/src/core/initializer.ts`
- `packages/core/src/config/config.ts`

### Flow

1. Core fetches admin controls from the Code Assist server after auth.
2. Settings are stored in `Config` via `setRemoteAdminSettings`.
3. A polling loop refreshes admin controls every 5 minutes.
4. Core config getters enforce gating (returning empty lists or disabling features).

### Gated features

- MCP servers: `getMcpServers()` and `getMcpServerCommand()` return undefined if MCP is disabled.
- Extensions: `getExtensions()` returns empty array when extensions are disabled.
- Skills: `getSkills()` returns empty array when skills are disabled.
- Plugins: `getEnablePlugins()` and `getEnableNpmPlugins()` return false when extensions are disabled.

### Admin error messaging

Use `getAdminErrorMessage(feature, config)` to construct a user-friendly message that includes the admin console path.

## 3) Core skills system

### What changed

Skills now exist in core, not just in the CLI. This makes headless usage consistent across SDK and CLI and centralizes discovery rules.

Key locations:

- `packages/core/src/skills/skillLoader.ts`
- `packages/core/src/skills/skillManager.ts`
- `packages/core/src/config/storage.ts`

### Skill discovery

Skills are discovered from three locations, in precedence order:

1. Built-in core skills (`packages/core/src/skills/builtin/`)
2. User skills (`Storage.getUserSkillsDir()`)
3. Project skills (`Storage.getProjectSkillsDir()`)

If a skill name is duplicated, the later location overrides the earlier one. Conflicts are logged for clarity.

### Skill format

Each skill is defined by `SKILL.md` with frontmatter:

```md
---
name: MySkill
description: Short description of the skill.
---

Skill body content...
```

The loader uses a minimal frontmatter parser (no YAML dependency). The description supports multi-line continuation with indentation.

### Admin integration

The `SkillManager` tracks whether skills are enabled by admin policy. When admin disables skills, they can be filtered at the core layer.

## 4) Model registry and validation

### What changed

A central model registry now defines available models per auth type, including capabilities (vision, tools, etc.) and defaults. This mirrors the more structured registry approach from Qwen.

Key locations:

- `packages/core/src/models/modelRegistry.ts`
- `packages/core/src/models/defaultModels.ts`
- `packages/core/src/models/types.ts`
- `packages/cli/src/ui/models/availableModels.ts`

### Registry usage

The registry groups models by auth type (`AuthType`) and validates minimal fields:

- `id` (required)
- `name` (optional, defaults to id)
- `baseUrl` (optional, defaults by provider)
- `capabilities` (optional)
- `generationConfig` (optional)

The CLI queries this registry to present available models and descriptions in the UI.

### Defaults

Default providers and models are defined in `packages/core/src/models/defaultModels.ts`. This is the single place to update built-in model lists.

## 5) Deferred CLI command execution

### What changed

Commands like `papert mcp`, `papert extensions`, and `papert skills` are now deferred until admin settings are loaded. This avoids executing disallowed commands when admin policy disables a feature.

Key locations:

- `packages/cli/src/deferred.ts`
- `packages/cli/src/config/config.ts`
- `packages/cli/src/gemini.tsx`
- `packages/cli/src/commands/mcp.ts`
- `packages/cli/src/commands/extensions.tsx`
- `packages/cli/src/commands/skills.tsx`

### Flow

1. Command handlers are wrapped with `defer()`.
2. `parseArguments` registers the command but does not run it immediately.
3. CLI initialization loads admin settings.
4. `runDeferredCommand` executes the stored handler if allowed; otherwise it prints an admin error and exits.

### What gets gated

- MCP: `papert mcp ...`
- Extensions: `papert extensions ...`
- Skills: `papert skills ...`

This is intentionally minimal and focused on commands that can change configuration or invoke external tooling.

## Testing

Relevant tests:

- Safety checkers: `packages/core/src/safety/*.test.ts`
- Admin controls: `packages/core/src/code_assist/admin/admin_controls.test.ts`
- Deferred CLI: `packages/cli/src/deferred.test.ts`
- Model registry: `packages/core/src/models/modelRegistry.test.ts`

## Implementation references

Use these files as the authoritative references for behavior and expected interfaces:

- Safety: `packages/core/src/safety/*`
- Admin controls: `packages/core/src/code_assist/admin/admin_controls.ts`
- Skills: `packages/core/src/skills/*`
- Models: `packages/core/src/models/*`
- Deferred CLI: `packages/cli/src/deferred.ts`
