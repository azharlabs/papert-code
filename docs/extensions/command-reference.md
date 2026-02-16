# Extension Command Reference

This document covers the extension command surface added for parity with Qwen-style extension workflows.

## Command Surfaces

Papert now supports extension management in two places:

- Non-interactive CLI: `papert extensions ...`
- Interactive slash commands: `/extensions ...`

Most lifecycle commands are available in both surfaces.

## Non-interactive CLI Commands

### List installed extensions

```bash
papert extensions list
```

### Install extension

```bash
papert extensions install <source>
```

Supported install source formats:

- Git URL
- GitHub shorthand: `owner/repo`
- Local path
- Marketplace plugin source: `<source>:<plugin-name>`

Examples:

```bash
papert extensions install wshobson/agents:reverse-engineering
papert extensions install https://github.com/acme/my-ext.git
papert extensions install ./local-extension
```

### Explore marketplace plugins

```bash
papert extensions explore [source] [keyword]
```

- Default source is `wshobson/agents` if omitted.
- `keyword` filters plugin names.

Examples:

```bash
papert extensions explore
papert extensions explore wshobson/agents reverse
```

### Show extension details

```bash
papert extensions detail <name>
```

Shows:

- Extension name/version
- Install source/type/ref/release tag (when present)
- User/workspace enabled state
- Context files
- MCP server keys
- Excluded tools

### Uninstall extension

```bash
papert extensions uninstall <name-or-source>
```

### Enable/disable extension

```bash
papert extensions enable <name> [--scope user|workspace]
papert extensions disable <name> [--scope user|workspace]
```

### Update extension(s)

```bash
papert extensions update --all
papert extensions update <name> [<name> ...]
```

### Link local extension (dev workflow)

```bash
papert extensions link <path>
```

### Create and validate

```bash
papert extensions new <name> <template>
papert extensions validate <path>
```

## Extension Settings Commands

Papert now supports per-extension settings via:

```bash
papert extensions settings <subcommand>
```

Subcommands:

- `set <extension> <key> <value>`
- `list <extension>`
- `show <extension> <key>`
- `unset <extension> <key>`

Examples:

```bash
papert extensions settings set reverse-engineering API_KEY abc123
papert extensions settings list reverse-engineering
papert extensions settings show reverse-engineering API_KEY
papert extensions settings unset reverse-engineering API_KEY
```

Implementation note:

- Settings are currently stored in each installed extension directory as:
  - `.papert-extension-settings.json`

## Interactive Slash Commands

Inside interactive `papert` sessions:

- `/extensions list`
- `/extensions install <source>`
- `/extensions uninstall <name>`
- `/extensions enable <name> [--scope user|workspace]`
- `/extensions disable <name> [--scope user|workspace]`
- `/extensions detail <name>`
- `/extensions explore [source] [keyword]`
- `/extensions update <name...>|--all`

## Marketplace Behavior

### Multi-plugin marketplace sources

If the source has multiple plugins and no plugin name is specified:

- Install fails with a plugin list and usage hint.
- Use:
  - `... install <source>:<plugin-name>`

### Single-plugin marketplace sources

- Plugin name is auto-selected if only one plugin exists.

### Release/Git fallback

For remote marketplace plugin sources:

- Papert attempts GitHub release download first.
- Falls back to git clone if no release asset path is available.

## Notes and Differences

- Slash command `/extensions list` now reflects installed extensions in-session (without restart).
- Interactive install uses the same marketplace-aware parser as non-interactive install.
- Marketplace installs are copied into the destination extension directory before enablement.

## Quick Troubleshooting

If an extension installs but does not appear:

1. Run `/extensions list` again in the same session.
2. Verify install details with `/extensions detail <name>`.
3. Rebuild and reinstall CLI if needed:

```bash
npm run build
npm install -g .
```
