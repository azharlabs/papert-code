from __future__ import annotations

import os
import uuid
from typing import Any, AsyncIterable, Dict, Iterable, List, Optional, Set, Union

from .abort import AbortController
from .protocol import SDKUserMessage
from .query import Query
from .transport import ProcessTransport

SKILLS_PATHS_ENV = "PAPERT_CODE_SKILLS_PATHS"


def _normalize_skills_paths(value: Optional[Union[str, Iterable[str]]]) -> Optional[str]:
    if not value:
        return None
    if isinstance(value, str):
        paths = [value]
    else:
        paths = [p for p in value if p]
    cleaned = [str(p).strip() for p in paths if p and str(p).strip()]
    if not cleaned:
        return None
    return os.pathsep.join(dict.fromkeys(cleaned))


def query(
    prompt: Union[str, AsyncIterable[SDKUserMessage]],
    options: Optional[Dict[str, Any]] = None,
) -> Query:
    options = options or {}

    env = dict(options.get("env") or {})
    skills_path = (
        options.get("skillsPath")
        or options.get("skillsPaths")
        or options.get("skills_path")
    )
    normalized_skills = _normalize_skills_paths(skills_path)
    if normalized_skills:
        existing = env.get(SKILLS_PATHS_ENV)
        if existing:
            normalized_skills = _normalize_skills_paths([existing, normalized_skills])
        env[SKILLS_PATHS_ENV] = normalized_skills

    abort_controller = (
        options.get("abortController")
        or options.get("abort_controller")
        or AbortController()
    )

    transport = ProcessTransport(
        path_to_papert_executable=options.get("pathToPapertExecutable")
        or options.get("path_to_papert_executable"),
        cwd=options.get("cwd"),
        env=env,
        debug=bool(options.get("debug", False)),
        model=options.get("model"),
        permission_mode=options.get("permissionMode") or options.get("permission_mode"),
        abort_controller=abort_controller,
        max_session_turns=options.get("maxSessionTurns")
        or options.get("max_session_turns"),
        core_tools=options.get("coreTools") or options.get("core_tools"),
        exclude_tools=options.get("excludeTools") or options.get("exclude_tools"),
        allowed_tools=options.get("allowedTools") or options.get("allowed_tools"),
        auth_type=options.get("authType") or options.get("auth_type"),
        include_partial_messages=bool(
            options.get("includePartialMessages")
            or options.get("include_partial_messages", False)
        ),
    )

    query_options = dict(options)
    query_options["abortController"] = abort_controller
    return Query(transport, prompt, query_options)


def create_papert_agent(config: Dict[str, Any]) -> "PapertAgent":
    return PapertAgent(config=config)

def create_client(options: Optional[Dict[str, Any]] = None) -> "Client":
    return Client(options=options)


class PapertAgent:
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}

    def run_prompt(
        self,
        prompt: Union[str, AsyncIterable[SDKUserMessage]],
        options: Optional[Dict[str, Any]] = None,
    ) -> Query:
        merged_options = dict(self.config.get("options") or {})
        if options:
            merged_options.update(options)
        return query(prompt=prompt, options=merged_options)


class Client:
    """High-level SDK client that manages reusable sessions."""

    def __init__(self, options: Optional[Dict[str, Any]] = None):
        self.options = dict(options or {})
        self._sessions: Dict[str, "ClientSession"] = {}

    def create_session(
        self,
        *,
        session_id: Optional[str] = None,
        options: Optional[Dict[str, Any]] = None,
    ) -> "ClientSession":
        sid = session_id or str(uuid.uuid4())
        if sid in self._sessions:
            return self._sessions[sid]
        session = ClientSession(
            session_id=sid,
            client=self,
            options=options,
        )
        self._sessions[sid] = session
        return session

    def get_session(self, session_id: str) -> Optional["ClientSession"]:
        return self._sessions.get(session_id)

    async def close(self) -> None:
        sessions = list(self._sessions.values())
        self._sessions.clear()
        for session in sessions:
            await session.close()


class ClientSession:
    """Reusable conversation session API on top of query()."""

    def __init__(
        self,
        *,
        session_id: str,
        client: Client,
        options: Optional[Dict[str, Any]] = None,
    ):
        self.session_id = session_id
        self._client = client
        self._options = dict(options or {})
        self._active_queries: Set[Query] = set()
        self._closed = False

    def is_closed(self) -> bool:
        return self._closed

    def _merged_options(self, options: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        merged = dict(self._client.options)
        merged.update(self._options)
        if options:
            merged.update(options)
        return merged

    async def _single_message_prompt(self, prompt: str) -> AsyncIterable[SDKUserMessage]:
        yield SDKUserMessage(
            type="user",
            session_id=self.session_id,
            message={"role": "user", "content": prompt},
            parent_tool_use_id=None,
        )

    def stream(self, prompt: str, options: Optional[Dict[str, Any]] = None) -> Query:
        if self._closed:
            raise RuntimeError("Session is closed")
        q = query(
            prompt=self._single_message_prompt(prompt),
            options=self._merged_options(options),
        )
        self._active_queries.add(q)
        return q

    async def send(
        self, prompt: str, options: Optional[Dict[str, Any]] = None
    ) -> List[Any]:
        q = self.stream(prompt, options=options)
        messages: List[Any] = []
        try:
            async for message in q:
                messages.append(message)
        finally:
            await q.close()
            self._active_queries.discard(q)
        return messages

    async def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        queries = list(self._active_queries)
        self._active_queries.clear()
        for q in queries:
            try:
                await q.close()
            except Exception:
                continue
