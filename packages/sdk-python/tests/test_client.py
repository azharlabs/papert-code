import asyncio

import papert_code_sdk.client as client_module
from papert_code_sdk import create_client


class FakeQuery:
    def __init__(self, prompt, options):
        self.prompt = prompt
        self.options = options
        self._closed = False
        self._messages = [{"type": "assistant"}, {"type": "result"}]

    def __aiter__(self):
        return self

    async def __anext__(self):
        if not self._messages:
            raise StopAsyncIteration
        return self._messages.pop(0)

    async def close(self):
        self._closed = True


def test_client_session_stream_uses_reusable_session_id(monkeypatch):
    captured = {}

    def fake_query(prompt, options=None):
        captured["query"] = FakeQuery(prompt, options or {})
        return captured["query"]

    monkeypatch.setattr(client_module, "query", fake_query)

    client = create_client({"cwd": "/repo"})
    session = client.create_session(session_id="session-123")
    q = session.stream("hello", options={"model": "gpt-4o-mini"})

    first_message = asyncio.run(q.prompt.__anext__())
    assert first_message.session_id == "session-123"
    assert first_message.message.content == "hello"
    assert captured["query"].options["cwd"] == "/repo"
    assert captured["query"].options["model"] == "gpt-4o-mini"


def test_client_session_send_collects_messages_and_closes(monkeypatch):
    created = {}

    def fake_query(prompt, options=None):
        fq = FakeQuery(prompt, options or {})
        created["query"] = fq
        return fq

    monkeypatch.setattr(client_module, "query", fake_query)

    client = create_client()
    session = client.create_session(session_id="session-send")
    messages = asyncio.run(session.send("run"))

    assert len(messages) == 2
    assert created["query"]._closed is True


def test_client_close_closes_sessions(monkeypatch):
    def fake_query(prompt, options=None):
        return FakeQuery(prompt, options or {})

    monkeypatch.setattr(client_module, "query", fake_query)

    client = create_client()
    session = client.create_session(session_id="session-close")
    session.stream("a")
    asyncio.run(client.close())

    assert session.is_closed() is True

