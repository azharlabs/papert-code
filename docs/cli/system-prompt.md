# System Prompt Override (PAPERT_SYSTEM_MD)

Papert Code’s core system instructions can be replaced with your own Markdown
file by setting the `PAPERT_SYSTEM_MD` environment variable.

## Overview

The `PAPERT_SYSTEM_MD` variable tells the CLI to load an external Markdown file
for its system prompt, completely overriding the built-in default. This is a
full replacement, not a merge. If you use a custom file, none of the original
core instructions apply unless you include them yourself.

This is for advanced users who need project-specific rules or a custom persona.

> Tip: Export the current default system prompt first, review it, then edit (see
> [“Export the default prompt”](#export-the-default-prompt-recommended)).

## How to enable

Set the environment variable in your shell or via a `.papert/.env` file (see
[Persisting Environment Variables](../get-started/authentication.md#persisting-environment-variables)).

- Use the project default path (`.papert/system.md`):
  - `PAPERT_SYSTEM_MD=true` or `PAPERT_SYSTEM_MD=1`
  - The CLI reads `./.papert/system.md` (relative to your current project).

- Use a custom file path:
  - `PAPERT_SYSTEM_MD=/absolute/path/to/my-system.md`
  - Relative paths are resolved from the current working directory.
  - Tilde expansion is supported (e.g., `~/my-system.md`).

- Disable the override (use built‑in prompt):
  - `PAPERT_SYSTEM_MD=false` or `PAPERT_SYSTEM_MD=0` or unset the variable.

If the override is enabled but the target file does not exist, the CLI errors
with: `missing system prompt file '<path>'`.

## Quick examples

- One‑off session using a project file:
  - `PAPERT_SYSTEM_MD=1 papert`
- Persist for a project using `.papert/.env`:
  - Create `.papert/system.md`, then add to `.papert/.env`:
    - `PAPERT_SYSTEM_MD=1`
- Use a custom file under your home directory:
  - `PAPERT_SYSTEM_MD=~/prompts/SYSTEM.md papert`

## UI indicator

When `PAPERT_SYSTEM_MD` is active, the CLI shows a `|⌐■_■|` indicator to signal
custom system‑prompt mode.

## Export the default prompt (recommended)

Before overriding, export the current default prompt so you can review required
safety and workflow rules.

- Write the built‑in prompt to the project default path:
  - `PAPERT_WRITE_SYSTEM_MD=1 papert`
- Or write to a custom path:
  - `PAPERT_WRITE_SYSTEM_MD=~/prompts/DEFAULT_SYSTEM.md papert`

This creates the file and writes the current built‑in system prompt to it.

## Best practices: SYSTEM.md vs GEMINI.md

- SYSTEM.md (firmware):
  - Non‑negotiable operational rules: safety, tool‑use protocols, approvals, and
    mechanics that keep the CLI reliable.
  - Stable across tasks and projects (or per project when needed).
- GEMINI.md (strategy):
  - Persona, goals, methodologies, and project/domain context.
  - Evolves per task; relies on SYSTEM.md for safe execution.

Keep SYSTEM.md minimal but complete for safety and tool operation. Keep
GEMINI.md focused on high‑level guidance and project specifics.

## Troubleshooting

- Error: `missing system prompt file '…'`
  - Ensure the referenced path exists and is readable.
  - For `PAPERT_SYSTEM_MD=1|true`, create `.papert/system.md` in your project.
- Override not taking effect
  - Confirm the variable is loaded (use `.papert/.env` or export in your shell).
  - Paths are resolved from the current working directory; try an absolute path.
- Restore defaults
  - Unset `PAPERT_SYSTEM_MD` or set it to `0`/`false`.
