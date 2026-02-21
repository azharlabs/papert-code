import asyncio
import json

from papert_code_sdk.abort import AbortController
from papert_code_sdk.errors import AbortError
from papert_code_sdk.protocol import ControlCancelRequest, ControlRequestType
from papert_code_sdk.query import Query


class FakeTransport:
    def __init__(self):
        self.written_messages = []

    async def initialize(self):
        return None

    async def write(self, message: str):
        self.written_messages.append(json.loads(message))
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
        assert options["suggestions"][0]["type"] == "allow"
        assert options["suggestions"][0]["label"] == "Allow once"
        return {"behavior": "allow", "updatedInput": tool_input}

    q = Query(
        transport=FakeTransport(),
        prompt="hello",
        options={"canUseTool": can_use_tool},
    )

    result = asyncio.run(
        q._handle_permission_request(
            "read_file",
            {"path": "a.txt"},
            [{"type": "allow", "label": "Allow once"}],
        )
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


def test_start_sends_initialize_with_agents_and_mcp_servers():
    async def run_case():
        transport = FakeTransport()
        q = Query(
            transport=transport,
            prompt="hello",
            options={
                "agents": [
                    {
                        "name": "reviewer",
                        "description": "Reviews code quality",
                        "systemPrompt": "Find risks first.",
                        "level": "session",
                    }
                ],
                "mcpServers": {"docs": {"command": "node", "args": ["server.js"]}},
            },
        )

        calls = []

        async def fake_send(subtype, data=None):
            calls.append((subtype, data or {}))
            return {}

        q.send_control_request = fake_send  # type: ignore[method-assign]

        await q._start()
        assert calls[0][0] == ControlRequestType.INITIALIZE
        assert calls[0][1]["agents"][0]["name"] == "reviewer"
        assert calls[0][1]["mcpServers"]["docs"]["command"] == "node"
        await q.close()

    asyncio.run(run_case())


def test_control_cancel_request_rejects_pending_request():
    async def run_case():
        q = Query(transport=FakeTransport(), prompt="hello", options={})
        loop = asyncio.get_running_loop()
        pending = loop.create_future()
        q.pending_control_requests["req-cancel"] = pending

        q._handle_control_cancel_request(
            ControlCancelRequest(type="control_cancel_request", request_id="req-cancel")
        )

        try:
            await pending
            assert False, "Expected pending request to be cancelled"
        except AbortError as err:
            assert "cancelled" in str(err).lower()

        await q.close()

    asyncio.run(run_case())


def test_abort_signal_rejects_pending_control_requests():
    async def run_case():
        controller = AbortController()
        q = Query(
            transport=FakeTransport(),
            prompt="hello",
            options={"abortController": controller},
        )
        loop = asyncio.get_running_loop()
        pending = loop.create_future()
        q.pending_control_requests["req-abort"] = pending

        controller.abort()
        await asyncio.sleep(0)

        try:
            await pending
            assert False, "Expected abort to reject pending request"
        except AbortError as err:
            assert "query closed" in str(err).lower()

        await q.close()
        assert q.is_closed()

    asyncio.run(run_case())
