# papert-code-sdk

A minimum experimental Python SDK for programmatic access to Papert Code.

## Installation

```bash
pip install papert-code-sdk
```

## Requirements

- Python >= 3.8
- A system `papert` install in PATH (the SDK checks `papert` first).
- Node.js >= 18 (needed by the CLI runtime).

If `papert` is not installed, the SDK raises an error with next steps. You can
override the executable path explicitly via `pathToPapertExecutable`.

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
from papert_code_sdk import query

pkg_path = Path(pkgutil.get_loader("papert_code_sdk").get_filename()).parent
cli_path = pkg_path / "cli" / "cli.js"
result = query(
    prompt="Hello",
    options={"pathToPapertExecutable": f"node:{cli_path}"},
)
```

## Quick Start

```python
import asyncio
from papert_code_sdk import query

async def main():
    q = query(prompt="What files are in the current directory?", options={"cwd": "."})
    
    async for message in q:
        if message.type == "assistant":
            print(f"Assistant: {message.message.content}")
        elif message.type == "result":
            print(f"Result: {message.result}")

if __name__ == "__main__":
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
