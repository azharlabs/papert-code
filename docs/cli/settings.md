# Papert Code settings (`/settings` command)

The `/settings` command opens a dialog to view and edit Papert Code settings
(UI, keybindings, accessibility, tools, and more).

Settings are stored in JSON files. You can also edit them directly:

- **User settings:** `~/.papert/settings.json`
- **Workspace settings:** `your-project/.papert/settings.json`

Workspace settings override user settings.

---

## Plugins

Papert Code includes a plugin system that lets you run JavaScript at specific lifecycle events (hooks). Plugins can be loaded from:

- **Files** (`.js`, `.mjs`, `.cjs`, `.ts`) stored in your project or in your home directory
- **npm packages** (optional)

### Enabling flags

Plugin loading is **off by default**.

To enable plugins:

- `enablePlugins: true`

To allow loading plugins from npm packages:

- `enableNpmPlugins: true`

To allow Papert Code to automatically install missing npm plugins:

- `autoInstallNpmPlugins: true`

> Security: enabling plugins (especially npm plugins) allows executing arbitrary code on your machine. Read **Security warnings** below.

### Where to place plugins

#### Local project plugins (file-based)

Put local plugin files here:

- `your-project/.papert/plugins/`

Then reference them from the `plugins` array with a relative path, e.g.:

- `./.papert/plugins/log-tools.mjs`

#### Global plugins (file-based)

Put global plugin files here:

- `~/.papert/plugins/`

Then reference them from the `plugins` array using an **absolute path**.

> Note: JSON does not expand `~`. Use a full path like `/Users/alice/.papert/plugins/my-plugin.mjs`.

### npm plugins: configuration and resolution order

To configure npm plugins, add their package names (optionally with a version) to `plugins`.

Examples:

- `papert-plugin-tool-logger`
- `papert-plugin-tool-logger@0.1.0`
- `@scope/papert-plugin-guard@1.2.3`

When a plugin entry is an npm package specifier, Papert Code resolves it in this order:

1. **Project** `node_modules` (local install for the current workspace)
2. **Global plugin directory** `~/.papert/plugins` (used as an install location and fallback resolver)

### Auto-install behavior (npm plugins) and trust gating

If `autoInstallNpmPlugins` is enabled, Papert Code will attempt to install missing npm plugins into:

- `~/.papert/plugins`

Auto-install is gated by trust:

- Auto-install only runs when the current workspace is a **trusted folder**.
- In **untrusted** folders, Papert Code will not auto-install npm plugins.

See: [Trusted folders](./trusted-folders.md)

### Listing loaded plugins

In the interactive CLI, run:

- `/plugins`

This lists the plugins loaded for the current session.

### Plugin module format

A plugin module must default-export a **factory function** that returns an object with:

- `name: string`
- `hooks: Record<string, (payload) => void | Promise<void>>`

Example:

```js
export default function pluginFactory() {
  return {
    name: 'my-plugin',
    hooks: {
      'tool.execute.before': (payload) => {
        // ...
      }
    }
  };
}
```

### Supported hook events

Papert Code currently supports (at least) these events:

- `tool.execute.before`
- `tool.execute.after`

Both hooks receive a payload that describes the tool execution.

### Complete examples

#### Example 1: Local plugin file (project)

Create `your-project/.papert/plugins/log-tools.mjs`:

```js
/**
 * Logs every tool call before and after execution.
 *
 * WARNING: tool inputs/outputs may include secrets.
 */
export default function logToolsPlugin() {
  return {
    name: 'log-tools',
    hooks: {
      'tool.execute.before': ({ toolName, input }) => {
        console.log(`[papert][tool.before] ${toolName}`);
        console.log(input);
      },

      'tool.execute.after': ({ toolName, output, error }) => {
        if (error) {
          console.log(`[papert][tool.after] ${toolName} (error)`);
          console.log(error);
          return;
        }

        console.log(`[papert][tool.after] ${toolName}`);
        console.log(output);
      }
    }
  };
}
```

Enable it in `your-project/.papert/settings.json`:

```json
{
  "enablePlugins": true,
  "plugins": ["./.papert/plugins/log-tools.mjs"]
}
```

#### Example 2: npm plugin package skeleton

`package.json`:

```json
{
  "name": "papert-plugin-tool-logger",
  "version": "0.1.0",
  "type": "module",
  "main": "./index.mjs",
  "exports": "./index.mjs"
}
```

`index.mjs`:

```js
export default function toolLoggerPlugin() {
  return {
    name: 'papert-plugin-tool-logger',
    hooks: {
      'tool.execute.before': ({ toolName }) => {
        console.log(`[tool] ${toolName}`);
      }
    }
  };
}
```

Install and enable:

```sh
npm i papert-plugin-tool-logger
```

```json
{
  "enablePlugins": true,
  "enableNpmPlugins": true,
  "plugins": ["papert-plugin-tool-logger"]
}
```

#### Example 3: Settings snippet with auto-install (trusted folders only)

```json
{
  "enablePlugins": true,
  "enableNpmPlugins": true,
  "autoInstallNpmPlugins": true,
  "plugins": ["papert-plugin-tool-logger@0.1.0"]
}
```

### Security warnings

Plugins run arbitrary JavaScript in the Papert Code process and can:

- Read/write files
- Execute shell commands
- Access environment variables and credentials
- Send network requests

Recommendations:

- Prefer **file-based plugins** committed to your repo (reviewable code).
- Only use npm plugins from authors you trust.
- Avoid logging tool inputs/outputs if they may contain secrets.
- Keep `autoInstallNpmPlugins` disabled unless you understand the risk.

See
[Configuration](./configuration.md) for the full schema and precedence.

Need to replace the system prompt? See
[System Prompt Override](./system-prompt.md) for `PAPERT_SYSTEM_MD`.
