import asyncio

from papert_code_sdk.query import Query


class FakeTransport:
    async def initialize(self):
        return None

    async def write(self, _message: str):
        return None

    async def close(self):
        return None

    async def read_messages(self):
        if False:
            yield None

    def end_input(self):
        return None


def test_permission_callback_allow():
    async def can_use_tool(tool_name, tool_input, options):
        assert tool_name == "read_file"
        assert options["signal"] is not None
        return {"behavior": "allow", "updatedInput": tool_input}

    q = Query(
        transport=FakeTransport(),
        prompt="hello",
        options={"canUseTool": can_use_tool},
    )

    result = asyncio.run(
        q._handle_permission_request("read_file", {"path": "a.txt"}, None)
    )
    assert result["behavior"] == "allow"
    assert result["updatedInput"] == {"path": "a.txt"}


def test_permission_callback_failure_defaults_to_deny():
    async def can_use_tool(_tool_name, _tool_input):
        raise RuntimeError("boom")

    q = Query(
        transport=FakeTransport(),
        prompt="hello",
        options={"canUseTool": can_use_tool},
    )

    result = asyncio.run(
        q._handle_permission_request("write_file", {"path": "a.txt"}, None)
    )
    assert result["behavior"] == "deny"
    assert "Permission check failed" in result["message"]


def test_control_helpers_send_expected_subtypes():
    q = Query(transport=FakeTransport(), prompt="hello", options={})

    calls = []

    async def fake_send(subtype, data=None):
        calls.append((subtype, data or {}))
        return {}

    q.send_control_request = fake_send  # type: ignore[method-assign]

    asyncio.run(q.interrupt())
    asyncio.run(q.set_permission_mode("auto-edit"))
    asyncio.run(q.set_model("gpt-4o-mini"))
    asyncio.run(q.supported_commands())
    asyncio.run(q.mcp_server_status())

    assert calls[0] == ("interrupt", {})
    assert calls[1] == ("set_permission_mode", {"mode": "auto-edit"})
    assert calls[2] == ("set_model", {"model": "gpt-4o-mini"})
    assert calls[3] == ("supported_commands", {})
    assert calls[4] == ("mcp_server_status", {})
