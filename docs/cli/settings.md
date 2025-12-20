# Papert Code settings (`/settings` command)

The `/settings` command opens a dialog to view and edit Papert Code settings
(UI, keybindings, accessibility, tools, and more).

Settings are stored in JSON files. You can also edit them directly:

- **User settings:** `~/.papert/settings.json`
- **Workspace settings:** `your-project/.papert/settings.json`

Workspace settings override user settings. See
[Configuration](./configuration.md) for the full schema and precedence.

Need to replace the system prompt? See
[System Prompt Override](./system-prompt.md) for `PAPERT_SYSTEM_MD`.
