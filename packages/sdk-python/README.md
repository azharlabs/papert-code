# papert-code-sdk

Python SDK for programmatic access to the Papert Code CLI with streaming,
control messages, permission callbacks, abort support, and MCP integration.

## Installation

```bash
pip install papert-code-sdk
```

## Requirements

- Python >= 3.8
- A `papert` CLI available in `PATH`, or set `pathToPapertExecutable`
- Node.js >= 18 when running JS CLI bundles

## Quick Start

```python
import asyncio
from papert_code_sdk import query

async def main():
    q = query(
        prompt="List top-level files in this repository",
        options={"cwd": "/path/to/repo"},
    )

    async for message in q:
        if message.type == "assistant":
            print(message.message.content)

asyncio.run(main())
```

## Query Options

The `query(prompt, options=...)` API supports:

- `cwd`
- `model`
- `permissionMode` / `permission_mode`
- `pathToPapertExecutable` / `path_to_papert_executable`
- `env`
- `skillsPath` / `skillsPaths` / `skills_path`
- `canUseTool` / `can_use_tool`
- `mcpServers` / `mcp_servers`
- `abortController` / `abort_controller`
- `debug`
- `maxSessionTurns` / `max_session_turns`
- `coreTools` / `core_tools`
- `excludeTools` / `exclude_tools`
- `allowedTools` / `allowed_tools`
- `authType` / `auth_type`
- `includePartialMessages` / `include_partial_messages`
- `agents`

## Query Controls

The returned `Query` object supports:

- `get_session_id()`
- `is_closed()`
- `interrupt()`
- `set_permission_mode(mode)`
- `set_model(model)`
- `supported_commands()`
- `mcp_server_status()`
- `end_input()`
- `close()`

## Permission Callback

```python
import asyncio
from papert_code_sdk import query

async def can_use_tool(tool_name, tool_input, options):
    if tool_name and tool_name.startswith("read_"):
        return {"behavior": "allow", "updatedInput": tool_input}
    return {"behavior": "deny", "message": "Denied by app policy"}

async def main():
    q = query(
        prompt="Create a file and then read it",
        options={"canUseTool": can_use_tool},
    )
    async for msg in q:
        print(msg.type)

asyncio.run(main())
```

## Abort Support

```python
import asyncio
from papert_code_sdk import AbortController, is_abort_error, query

async def main():
    controller = AbortController()
    q = query(
        prompt="Run a long task",
        options={"abortController": controller},
    )

    async def cancel_soon():
        await asyncio.sleep(2)
        controller.abort()

    asyncio.create_task(cancel_soon())

    try:
        async for msg in q:
            print(msg.type)
    except Exception as exc:
        if is_abort_error(exc):
            print("Aborted")
        else:
            raise

asyncio.run(main())
```

## Multi-turn Streaming

```python
import asyncio
from papert_code_sdk import query, SDKUserMessage

async def prompt_stream(session_id):
    yield SDKUserMessage(
        type="user",
        session_id=session_id,
        message={"role": "user", "content": "Create hello.txt"},
        parent_tool_use_id=None,
    )
    yield SDKUserMessage(
        type="user",
        session_id=session_id,
        message={"role": "user", "content": "Read hello.txt"},
        parent_tool_use_id=None,
    )

async def main():
    first = query(prompt="Start a session")
    session_id = first.get_session_id()
    await first.close()

    q = query(
        prompt=prompt_stream(session_id),
        options={"permissionMode": "auto-edit"},
    )
    async for msg in q:
        print(msg.type)

asyncio.run(main())
```

## Agent Wrapper

```python
from papert_code_sdk import create_papert_agent

agent = create_papert_agent(
    {
        "options": {
            "cwd": "/path/to/repo",
            "permissionMode": "auto-edit",
        }
    }
)

query_handle = agent.run_prompt("Summarize TODOs")
```

## High-level Client (Reusable Sessions)

```python
import asyncio
from papert_code_sdk import create_client

async def main():
    client = create_client({"cwd": "/path/to/repo", "permissionMode": "auto-edit"})
    session = client.create_session(session_id="todo-session")

    first = await session.send("Create TODO.md with 3 items")
    second = await session.send("Now summarize what you wrote")

    print(len(first), len(second))
    await client.close()

asyncio.run(main())
```

`ClientSession` helpers:

- `stream(prompt, options=None)` -> returns a streaming `Query`
- `send(prompt, options=None)` -> collects all messages and returns a list
- `close()` and `is_closed()`

## Multi-agent, Skills, and `.papert` setup

Detailed guide with complete project layout and end-to-end sample code:

- `/Users/azhar/code/coding-agent/papert-code/docs/cli/sdk-python-multi-agent-skills.md`

## MCP Servers

```python
from papert_code_sdk import query

q = query(
    prompt="Use tool from external MCP server",
    options={
        "mcpServers": {
            "my-server": {
                "command": "node",
                "args": ["server.js"],
                "env": {"PORT": "3000"},
            }
        }
    },
)
```
