# Python SDK

The Papert Code Python SDK runs the CLI as a subprocess and streams SDK
messages. It now includes query controls, abort support, permission callback
timeouts, richer query options, and a lightweight agent wrapper.

## Install

```bash
pip install papert-code-sdk
```

## Requirements

- Python >= 3.8
- A system `papert` install in `PATH` or explicit `pathToPapertExecutable`
- Node.js >= 18 for JS bundle execution

## Quick Start

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

## Query Options

`query(prompt, options=...)` accepts:

- `cwd`
- `model`
- `permissionMode` / `permission_mode`
- `pathToPapertExecutable` / `path_to_papert_executable`
- `env`
- `debug`
- `skillsPath` / `skillsPaths` / `skills_path`
- `canUseTool` / `can_use_tool`
- `mcpServers` / `mcp_servers`
- `abortController` / `abort_controller`
- `maxSessionTurns` / `max_session_turns`
- `coreTools` / `core_tools`
- `excludeTools` / `exclude_tools`
- `allowedTools` / `allowed_tools`
- `authType` / `auth_type`
- `includePartialMessages` / `include_partial_messages`
- `agents`

## Query Controls

The `Query` object returned by `query()` supports:

- `get_session_id()`
- `is_closed()`
- `interrupt()`
- `set_permission_mode(mode)`
- `set_model(model)`
- `supported_commands()`
- `mcp_server_status()`
- `end_input()`
- `close()`

## Multi-agent, Skills, and `.papert` Full Guide

For detailed setup and complete examples (targeting a specific subagent, using
specific skill directories, runtime `agents` injection, and full `.papert`
project layout), see:

- [Python SDK Multi-agent & Skills](./sdk-python-multi-agent-skills.md)

Example:

```python
q = query(prompt="hello", options={"permissionMode": "default"})
session_id = q.get_session_id()
await q.set_permission_mode("auto-edit")
await q.set_model("gpt-4o-mini")
await q.interrupt()
await q.close()
```

## Abort Support

```python
import asyncio
from papert_code_sdk import AbortController, is_abort_error, query

async def main():
    abort_controller = AbortController()
    q = query(
        prompt="Long-running task",
        options={"abortController": abort_controller},
    )

    async def abort_soon():
        await asyncio.sleep(3)
        abort_controller.abort()

    asyncio.create_task(abort_soon())

    try:
        async for message in q:
            print(message.type)
    except Exception as error:
        if is_abort_error(error):
            print("Aborted")
        else:
            raise

asyncio.run(main())
```

## Custom Permission Handler

```python
from papert_code_sdk import query

async def can_use_tool(tool_name, tool_input, options):
    if tool_name and tool_name.startswith("read_"):
        return {"behavior": "allow", "updatedInput": tool_input}
    return {"behavior": "deny", "message": "User denied the operation"}

q = query(
    prompt="Create a new file",
    options={"canUseTool": can_use_tool},
)
```

The callback has a 30-second timeout. Timeout or callback error defaults to
`deny` for safety.

## Multi-turn Conversation

```python
import asyncio
from papert_code_sdk import query, SDKUserMessage

async def messages(session_id):
    yield SDKUserMessage(
        type="user",
        session_id=session_id,
        message={"role": "user", "content": "Create hello.txt"},
        parent_tool_use_id=None,
    )
    yield SDKUserMessage(
        type="user",
        session_id=session_id,
        message={"role": "user", "content": "Read it back"},
        parent_tool_use_id=None,
    )

async def main():
    q = query(prompt="Seed")
    session_id = q.get_session_id()
    await q.close()

    result = query(
        prompt=messages(session_id),
        options={"permissionMode": "auto-edit"},
    )

    async for message in result:
        print(message)

asyncio.run(main())
```

## Agent Wrapper

```python
from papert_code_sdk import create_papert_agent

agent = create_papert_agent(
    {"options": {"cwd": "/path/to/repo", "permissionMode": "auto-edit"}}
)

run = agent.run_prompt("Summarize TODOs")
```

## High-level Client

For reusable multi-call sessions without manually building `SDKUserMessage`
streams:

```python
import asyncio
from papert_code_sdk import create_client

async def main():
    client = create_client({"cwd": "/path/to/repo"})
    session = client.create_session(session_id="my-session")

    await session.send("Create notes.md")
    await session.send("Read notes.md and summarize")

    await client.close()

asyncio.run(main())
```

Client APIs:

- `create_client(options=None)`
- `Client.create_session(session_id=None, options=None)`
- `Client.get_session(session_id)`
- `Client.close()`
- `ClientSession.stream(prompt, options=None)`
- `ClientSession.send(prompt, options=None)`
- `ClientSession.close()`

## MCP Server Integration

```python
from papert_code_sdk import query

result = query(
    prompt="Use a tool from MCP",
    options={
        "mcpServers": {
            "my-server": {
                "command": "node",
                "args": ["path/to/mcp-server.js"],
                "env": {"PORT": "3000"},
            }
        }
    },
)
```

## Message Types

The iterator yields:

- `SDKUserMessage`
- `SDKAssistantMessage`
- `SDKSystemMessage`
- `SDKResultMessage`
- `SDKPartialAssistantMessage`

All protocol models are under `papert_code_sdk.protocol`.
