# LSP Tool (`lsp`)

This document describes the `lsp` tool for Papert Code.

The `lsp` tool integrates with **Language Server Protocol (LSP)** servers to provide:

- **Diagnostics** (errors/warnings) for files
- **Code navigation** (go to definition, references, symbols, etc.)
- **Call hierarchy** (prepare + incoming/outgoing calls)

> The `lsp` tool is a *core tool* (built-in) and is configured via `tools.lsp` in your Papert Code settings.

---

## Quick start

1. Add an LSP server configuration to your settings file:

- Project settings: `.papert/settings.json` (recommended)
- User settings: `~/.papert/settings.json`

2. Ensure the LSP server executable is installed and available in your environment.

3. Ask Papert Code to use the `lsp` tool (e.g. “use lsp hover on …”).

---

## Configuration

### Settings location

Papert Code looks for settings in:

- `.papert/settings.json` in the current project directory
- `~/.papert/settings.json` for user defaults

---

## Recommended servers + installation

This section lists recommended LSP servers for common languages and how to install them.

> Papert Code starts LSP servers as external processes. The `command[0]` executable must be available in the environment where Papert Code runs (and **inside the sandbox**, if sandboxing is enabled).

### TypeScript / JavaScript (recommended: `typescript-language-server`)

**Why:** widely used, good navigation + diagnostics, works for TS/JS/TSX/JSX.

**Install (npm):**

```bash
npm install -g typescript typescript-language-server
```

**Verify:**

```bash
typescript-language-server --version
```

**Settings example:**

```jsonc
{
  "tools": {
    "lsp": {
      "enabled": true,
      "servers": {
        "tsserver": {
          "command": ["typescript-language-server", "--stdio"],
          "extensions": ["ts", "tsx", "js", "jsx"]
        }
      }
    }
  }
}
```

**Alternative:** If you prefer project-local installs, you can install as dev dependencies and point `command` to the local binary (example path):

```jsonc
{
  "command": ["./node_modules/.bin/typescript-language-server", "--stdio"]
}
```

### Python (recommended: `pyright-langserver`)

**Why:** fast, good type-checking diagnostics, solid navigation.

**Install (npm):**

```bash
npm install -g pyright
```

This provides `pyright-langserver`.

**Verify:**

```bash
pyright-langserver --version
```

**Settings example:**

```jsonc
{
  "tools": {
    "lsp": {
      "enabled": true,
      "servers": {
        "pyright": {
          "command": ["pyright-langserver", "--stdio"],
          "extensions": ["py"]
        }
      }
    }
  }
}
```

**Alternative (Python-based server):** `python-lsp-server` (pylsp) can be installed via pip and run as `pylsp`.

---

### `tools.lsp` settings

```jsonc
{
  "tools": {
    "lsp": {
      "enabled": true,
      "servers": {
        "tsserver": {
          "disabled": false,
          "command": ["typescript-language-server", "--stdio"],
          "extensions": ["ts", "tsx", "js", "jsx"],
          "env": {
            "NODE_OPTIONS": "--max-old-space-size=4096"
          },
          "initialization": {
            "initializationOptions": {},
            "settings": {}
          }
        }
      }
    }
  }
}
```

#### Fields

- `tools.lsp.enabled` (boolean)
  - Enables/disables the `lsp` tool globally.
- `tools.lsp.servers` (object map)
  - A map of server profiles. The key is an arbitrary name (e.g. `tsserver`, `pyright`).

Each server profile supports:

- `disabled` (boolean, optional)
  - If `true`, this server profile is ignored.
- `command` (string[], required)
  - The command + args to start the LSP server in **stdio** mode.
- `extensions` (string[], required)
  - File extensions that should use this server.
  - Use **no dot** (recommended): `["ts", "tsx"]`.
  - If you already have dots in your config (e.g. `[".ts", ".tsx"]`), remove them.
- `env` (record<string,string>, optional)
  - Extra environment variables for the LSP server process.
- `initialization` (object, optional)
  - Extra initialization payload merged into the LSP `initialize` request.
  - Use this for server-specific `initializationOptions` or `settings`.

---

## How server selection works

When you call the `lsp` tool with a `path`, Papert Code:

1. Extracts the file extension from `path`.
2. Finds the first configured server whose `extensions` contains that extension.
3. Starts (or reuses) that server process.

If no server matches the extension, the tool will fail with an error indicating no server is configured for that file type.

---

## Supported operations

All operations are invoked via the `lsp` tool with an `operation` field.

### Position format

Most navigation operations require a `position`:

```jsonc
{ "line": 10, "character": 5 }
```

- `line` is **0-based**
- `character` is **0-based**

### `hover`

Returns hover information at a position.

```jsonc
{
  "tool": "lsp",
  "operation": "hover",
  "path": "src/index.ts",
  "position": { "line": 10, "character": 5 }
}
```

### `goToDefinition`

Returns the definition location(s) for the symbol at a position.

```jsonc
{
  "tool": "lsp",
  "operation": "goToDefinition",
  "path": "src/index.ts",
  "position": { "line": 10, "character": 5 }
}
```

### `goToImplementation`

Returns implementation location(s) for the symbol at a position.

```jsonc
{
  "tool": "lsp",
  "operation": "goToImplementation",
  "path": "src/index.ts",
  "position": { "line": 10, "character": 5 }
}
```

### `findReferences`

Returns references for the symbol at a position.

```jsonc
{
  "tool": "lsp",
  "operation": "findReferences",
  "path": "src/index.ts",
  "position": { "line": 10, "character": 5 }
}
```

### `documentSymbol`

Returns symbols (outline) for a single document.

```jsonc
{
  "tool": "lsp",
  "operation": "documentSymbol",
  "path": "src/index.ts"
}
```

### `workspaceSymbol`

Searches symbols across the workspace.

```jsonc
{
  "tool": "lsp",
  "operation": "workspaceSymbol",
  "query": "MyClass"
}
```

### `prepareCallHierarchy`

Prepares call hierarchy items at a position.

```jsonc
{
  "tool": "lsp",
  "operation": "prepareCallHierarchy",
  "path": "src/index.ts",
  "position": { "line": 10, "character": 5 }
}
```

### `incomingCalls`

Returns incoming calls for a call hierarchy item.

```jsonc
{
  "tool": "lsp",
  "operation": "incomingCalls",
  "item": {
    "name": "myFn",
    "kind": 12,
    "uri": "file:///...",
    "range": { "start": { "line": 0, "character": 0 }, "end": { "line": 0, "character": 1 } },
    "selectionRange": { "start": { "line": 0, "character": 0 }, "end": { "line": 0, "character": 1 } }
  }
}
```

### `outgoingCalls`

Returns outgoing calls for a call hierarchy item.

```jsonc
{
  "tool": "lsp",
  "operation": "outgoingCalls",
  "item": {
    "name": "myFn",
    "kind": 12,
    "uri": "file:///...",
    "range": { "start": { "line": 0, "character": 0 }, "end": { "line": 0, "character": 1 } },
    "selectionRange": { "start": { "line": 0, "character": 0 }, "end": { "line": 0, "character": 1 } }
  }
}
```

### `diagnostics`

Returns the most recently received diagnostics for a file.

```jsonc
{
  "tool": "lsp",
  "operation": "diagnostics",
  "path": "src/index.ts"
}
```

> Diagnostics are currently **push-based**: the server must send `textDocument/publishDiagnostics`.

---

## Example server configurations

### TypeScript / JavaScript (typescript-language-server)

```jsonc
{
  "tools": {
    "lsp": {
      "enabled": true,
      "servers": {
        "tsserver": {
          "command": ["typescript-language-server", "--stdio"],
          "extensions": ["ts", "tsx", "js", "jsx"]
        }
      }
    }
  }
}
```

### Python (pyright-langserver)

```jsonc
{
  "tools": {
    "lsp": {
      "enabled": true,
      "servers": {
        "pyright": {
          "command": ["pyright-langserver", "--stdio"],
          "extensions": ["py"]
        }
      }
    }
  }
}
```

### Go (gopls)

```jsonc
{
  "tools": {
    "lsp": {
      "enabled": true,
      "servers": {
        "gopls": {
          "command": ["gopls"],
          "extensions": ["go"]
        }
      }
    }
  }
}
```

---

## Troubleshooting

### “No LSP server configured for extension …”

- Add a server profile whose `extensions` includes that file extension.
- Ensure `tools.lsp.enabled` is `true`.

### “Command not found” / server fails to start

- Verify the `command[0]` executable exists on your `PATH`.
- If you run Papert Code in a sandbox, the executable must exist **inside** the sandbox.

### Diagnostics are empty

- Some servers only publish diagnostics after receiving file contents.
- Current implementation sends `didOpen` with **empty text**, so diagnostics may be missing or incomplete.

### Workspace symbol search returns nothing

- Some servers require workspace root configuration or indexing time.
- Try opening a file first (any operation with `path` will open it).

---

## Security notes

- LSP servers are external processes. Only configure servers you trust.
- Prefer project-local binaries (or pinned versions) to avoid unexpected behavior.
- If you enable sandboxing, ensure the sandbox policy matches your expectations for what the LSP server can read.

---

## Current limitations

This is an initial integration intended to match OpenCode-style operations.

Known limitations include:

- `didOpen` currently sends **empty text** (some servers may behave poorly).
- Diagnostics are **push-based** only.
- LSP process lifecycle is minimal (shutdown/exit handling may be improved).
