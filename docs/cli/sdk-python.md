# Python SDK

The Papert Code Python SDK runs the CLI as a subprocess and streams messages
programmatically.

## Install

```bash
pip install papert-code-sdk
```

## Requirements

- Python >= 3.8
- A system `papert` install in PATH (the SDK checks `papert` first)
- Node.js >= 18 (needed by the CLI runtime)

If `papert` is not installed, the SDK raises a helpful error. You can still
override the executable with an explicit path via `pathToPapertExecutable`.

## CLI resolution behavior

By default, the SDK resolves the executable using:

1. `papert` from PATH (via `shutil.which("papert")`)

If you want to override this:

- Pass `pathToPapertExecutable` in `query()`
- Use a JS bundle (e.g. `/path/to/cli.js`) or a runtime-prefixed path
  like `node:/path/to/cli.js`

## Using the bundled CLI assets

The SDK package can ship a bundled CLI at `papert_code_sdk/cli/cli.js`.
If you want to run that bundle explicitly, resolve its path like this:

```python
import pkgutil
from pathlib import Path

pkg_path = Path(pkgutil.get_loader("papert_code_sdk").get_filename()).parent
cli_path = pkg_path / "cli" / "cli.js"
result = query(
    prompt="Hello",
    options={"pathToPapertExecutable": f"node:{cli_path}"},
)
```

## Quick start: streaming query

```python
import asyncio
from papert_code_sdk import query

async def main():
    result = query(
        prompt="List the top-level folders in this repo",
        options={"cwd": "/path/to/repo"},
    )

    async for message in result:
        if message.type == "assistant":
            print(message.message.content)

asyncio.run(main())
```

## Local development install

From the repo root (`/Users/azhar/code/coding-agent/papert-code`):

```bash
npm run bundle
python3 packages/sdk-python/scripts/bundle_cli.py
python3 -m pip install -e packages/sdk-python
```

## Options

The `query()` call accepts `options` with these fields:

- `cwd`: working directory for the CLI process (default: current directory)
- `model`: override the model name
- `permissionMode`: permission mode (e.g. `default`, `plan`, `auto-edit`, `yolo`)
- `pathToPapertExecutable`: override the CLI executable path
- `env`: dict of environment variables to pass to the CLI process
- `debug`: enable CLI stderr logging (default: False)
- `skillsPath` or `skillsPaths`: path(s) to skills folders
- `can_use_tool`: async callback for tool-approval decisions
- `mcpServers`: MCP server configuration passed at initialization

Example:

```python
result = query(
    prompt="Summarize TODOs",
    options={
        "cwd": "/path/to/repo",
        "model": "gpt-4o-mini",
        "permissionMode": "auto-edit",
        "env": {"OPENAI_API_KEY": "..."},
    },
)
```

## Custom permission handler

```python
import asyncio
from papert_code_sdk import query

async def can_use_tool(tool_name, tool_input):
    if tool_name.startswith("read_"):
        return {"behavior": "allow", "updatedInput": tool_input}
    return {"behavior": "deny", "message": "User denied the operation"}

async def main():
    result = query(
        prompt="Create a new file",
        options={"can_use_tool": can_use_tool},
    )

    async for message in result:
        print(message)

asyncio.run(main())
```

## Multi-turn conversation

```python
import asyncio
from papert_code_sdk import query, SDKUserMessage

async def messages():
    yield SDKUserMessage(
        type="user",
        session_id="demo-session",
        message={"role": "user", "content": "Create hello.txt"},
        parent_tool_use_id=None,
    )
    yield SDKUserMessage(
        type="user",
        session_id="demo-session",
        message={"role": "user", "content": "Read it back"},
        parent_tool_use_id=None,
    )

async def main():
    result = query(prompt=messages(), options={"permissionMode": "auto-edit"})
    async for message in result:
        print(message)

asyncio.run(main())
```

## MCP server integration

```python
from papert_code_sdk import query

async def main():
    result = query(
        prompt="Use the custom tool from my MCP server",
        options={
            "mcpServers": {
                "my-server": {
                    "command": "node",
                    "args": ["path/to/mcp-server.js"],
                    "env": {"PORT": "3000"},
                },
            },
        },
    )

    async for message in result:
        print(message)
```

## Message types

The iterator yields instances of:

- `SDKUserMessage`
- `SDKAssistantMessage`
- `SDKSystemMessage`
- `SDKResultMessage`
- `SDKPartialAssistantMessage` (stream events)

These types are defined in `papert_code_sdk.protocol`.
