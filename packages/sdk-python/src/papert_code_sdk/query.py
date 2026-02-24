from __future__ import annotations

import asyncio
import inspect
import logging
import uuid
from typing import Any, AsyncIterable, Awaitable, Callable, Dict, Optional, Union

from .abort import AbortController
from .errors import AbortError
from .protocol import (
    CLIControlRequest,
    CLIControlResponse,
    ContentBlock,
    ControlCancelRequest,
    ControlRequestType,
    ControlResponsePayload,
    PermissionSuggestion,
    SDKAssistantMessage,
    SDKMessage,
    SDKPartialAssistantMessage,
    SDKResultMessage,
    SDKSystemMessage,
    SDKUserMessage,
)
from .transport import ProcessTransport

logger = logging.getLogger(__name__)

PERMISSION_CALLBACK_TIMEOUT = 30.0
CONTROL_REQUEST_TIMEOUT = 30.0
MCP_STREAM_CLOSE_TIMEOUT = 10.0

PermissionCallback = Callable[..., Awaitable[Dict[str, Any]]]


class Query:
    def __init__(
        self,
        transport: ProcessTransport,
        prompt: Union[str, AsyncIterable[SDKUserMessage]],
        options: Optional[Dict[str, Any]] = None,
    ):
        self.transport = transport
        self.prompt = prompt
        self.options = options or {}
        self.session_id = str(
            self.options.get("sessionId")
            or self.options.get("session_id")
            or self.options.get("resume")
            or uuid.uuid4()
        )

        self.input_queue: asyncio.Queue = asyncio.Queue()
        self.pending_control_requests: Dict[str, asyncio.Future] = {}
        self.closed = False
        self.is_single_turn = isinstance(prompt, str)
        self.message_router_started = False

        self.can_use_tool: Optional[PermissionCallback] = (
            self.options.get("canUseTool") or self.options.get("can_use_tool")
        )
        self.abort_controller: AbortController = (
            self.options.get("abortController")
            or self.options.get("abort_controller")
            or AbortController()
        )

        self._router_task: Optional[asyncio.Task] = None
        self._stream_task: Optional[asyncio.Task] = None
        self._initialized = asyncio.Event()
        self._first_result_received = asyncio.Event()

        if self.abort_controller.signal.aborted:
            self.input_queue.put_nowait(AbortError("Query aborted by user"))
            self.closed = True
        else:
            self.abort_controller.signal.add_listener(self._on_abort)

    def _on_abort(self) -> None:
        if self.closed:
            return
        self.input_queue.put_nowait(AbortError("Query aborted by user"))
        if self._router_task and not self._router_task.done():
            self._router_task.cancel()
        if self._stream_task and not self._stream_task.done():
            self._stream_task.cancel()
        asyncio.create_task(self.close())

    def __aiter__(self):
        return self

    async def __anext__(self) -> SDKMessage:
        if self._router_task is None:
            await self._start()

        if self.closed and self.input_queue.empty():
            raise StopAsyncIteration

        item = await self.input_queue.get()
        if isinstance(item, Exception):
            raise item
        if item is None:
            raise StopAsyncIteration
        return item

    async def _start(self) -> None:
        await self.transport.initialize()
        self._router_task = asyncio.create_task(self._route_messages())

        await self.send_control_request(
            ControlRequestType.INITIALIZE,
            {
                "hooks": None,
                "mcpServers": self.options.get("mcpServers") or self.options.get("mcp_servers"),
                "agents": self.options.get("agents"),
            },
        )
        self._initialized.set()

        if self.is_single_turn:
            await self._send_single_turn_prompt()
        else:
            self._stream_task = asyncio.create_task(
                self.stream_input(self.prompt)  # type: ignore[arg-type]
            )

    async def _send_single_turn_prompt(self) -> None:
        msg = SDKUserMessage(
            type="user",
            session_id=self.session_id,
            message={"role": "user", "content": self.prompt},
            parent_tool_use_id=None,
        )
        await self.transport.write(msg.model_dump_json())

    async def stream_input(self, messages: AsyncIterable[SDKUserMessage]) -> None:
        await self._initialized.wait()
        try:
            async for msg in messages:
                if self.closed or self.abort_controller.signal.aborted:
                    break
                await self.transport.write(msg.model_dump_json())

            if (
                not self.is_single_turn
                and self.options.get("mcpServers")
                and not self._first_result_received.is_set()
            ):
                try:
                    await asyncio.wait_for(
                        self._first_result_received.wait(),
                        timeout=MCP_STREAM_CLOSE_TIMEOUT,
                    )
                except asyncio.TimeoutError:
                    pass

            self.end_input()
        except asyncio.CancelledError:
            return

    async def _route_messages(self) -> None:
        try:
            async for raw_msg in self.transport.read_messages():
                if self.closed:
                    break
                await self._handle_message(raw_msg)
        except Exception as e:
            await self.input_queue.put(e)
        finally:
            await self.input_queue.put(None)

    async def _handle_message(self, raw_msg: Dict[str, Any]) -> None:
        msg_type = raw_msg.get("type")

        if msg_type == "control_request":
            await self._handle_control_request(CLIControlRequest(**raw_msg))
            return

        if msg_type == "control_response":
            self._handle_control_response(CLIControlResponse(**raw_msg))
            return

        if msg_type == "control_cancel_request":
            self._handle_control_cancel_request(ControlCancelRequest(**raw_msg))
            return

        if msg_type == "user":
            await self.input_queue.put(SDKUserMessage(**raw_msg))
            return

        if msg_type == "assistant":
            await self.input_queue.put(SDKAssistantMessage(**raw_msg))
            return

        if msg_type == "system":
            await self.input_queue.put(SDKSystemMessage(**raw_msg))
            return

        if msg_type == "result":
            self._first_result_received.set()
            await self.input_queue.put(SDKResultMessage(**raw_msg))
            if self.is_single_turn:
                self.end_input()
            return

        if msg_type == "stream_event":
            await self.input_queue.put(SDKPartialAssistantMessage(**raw_msg))
            return

        logger.warning("Unknown message type: %s", msg_type)

    async def _handle_control_request(self, req: CLIControlRequest) -> None:
        payload = req.request
        subtype = payload.get("subtype")
        request_id = req.request_id

        try:
            if subtype == ControlRequestType.CAN_USE_TOOL:
                response_data = await self._handle_permission_request(
                    payload.get("tool_name"),
                    payload.get("input"),
                    payload.get("permission_suggestions"),
                )
                await self._send_control_response(
                    request_id=request_id,
                    success=True,
                    response=response_data,
                )
                return

            await self._send_control_response(
                request_id=request_id,
                success=False,
                error=f"Unknown control request subtype: {subtype}",
            )
        except Exception as e:
            await self._send_control_response(
                request_id=request_id,
                success=False,
                error=str(e),
            )

    async def _handle_permission_request(
        self,
        tool_name: Optional[str],
        tool_input: Any,
        permission_suggestions: Optional[Any],
    ) -> Dict[str, Any]:
        if not self.can_use_tool:
            return {"behavior": "deny", "message": "Denied"}

        suggestions = None
        if isinstance(permission_suggestions, list):
            parsed = []
            for entry in permission_suggestions:
                try:
                    parsed.append(PermissionSuggestion(**entry).model_dump())
                except Exception:
                    continue
            suggestions = parsed or None

        callback_options = {
            "signal": self.abort_controller.signal,
            "suggestions": suggestions,
        }

        try:
            callback = self.can_use_tool
            if callback is None:
                return {"behavior": "deny", "message": "Denied"}

            parameters = inspect.signature(callback).parameters
            if len(parameters) >= 3:
                callback_result = callback(tool_name, tool_input, callback_options)
            else:
                callback_result = callback(tool_name, tool_input)

            result = await asyncio.wait_for(
                callback_result,
                timeout=PERMISSION_CALLBACK_TIMEOUT,
            )
            behavior = result.get("behavior")
            if behavior == "allow":
                return {
                    "behavior": "allow",
                    "updatedInput": result.get("updatedInput", tool_input),
                }
            return {
                "behavior": "deny",
                "message": result.get("message", "Denied"),
                **(
                    {"interrupt": result.get("interrupt")}
                    if "interrupt" in result
                    else {}
                ),
            }
        except Exception as e:
            logger.warning("Permission callback error (denying by default): %s", e)
            return {
                "behavior": "deny",
                "message": f"Permission check failed: {e}",
            }

    def _handle_control_response(self, resp: CLIControlResponse) -> None:
        payload = resp.response
        request_id = payload.request_id

        future = self.pending_control_requests.pop(request_id, None)
        if not future or future.done():
            return

        if payload.subtype == "success":
            future.set_result(payload.response)
            return

        error = payload.error if isinstance(payload.error, str) else str(payload.error)
        future.set_exception(Exception(error))

    def _handle_control_cancel_request(self, req: ControlCancelRequest) -> None:
        request_id = req.request_id
        if not request_id:
            return
        future = self.pending_control_requests.pop(request_id, None)
        if future and not future.done():
            future.set_exception(AbortError("Request cancelled"))

    async def send_control_request(
        self, subtype: str, data: Optional[Dict[str, Any]] = None
    ) -> Any:
        if self.closed:
            raise RuntimeError("Query is closed")

        request_id = str(uuid.uuid4())
        req = CLIControlRequest(
            type="control_request",
            request_id=request_id,
            request={"subtype": subtype, **(data or {})},
        )

        loop = asyncio.get_running_loop()
        future = loop.create_future()
        self.pending_control_requests[request_id] = future
        await self.transport.write(req.model_dump_json())

        try:
            return await asyncio.wait_for(future, timeout=CONTROL_REQUEST_TIMEOUT)
        except asyncio.TimeoutError as e:
            self.pending_control_requests.pop(request_id, None)
            raise TimeoutError(f"Control request {subtype} timed out") from e

    async def _send_control_response(
        self,
        request_id: str,
        success: bool,
        response: Any = None,
        error: Any = None,
    ) -> None:
        payload = ControlResponsePayload(
            subtype="success" if success else "error",
            request_id=request_id,
            response=response if success else None,
            error=error if not success else None,
        )
        resp = CLIControlResponse(type="control_response", response=payload)
        await self.transport.write(resp.model_dump_json())

    async def interrupt(self) -> None:
        await self.send_control_request(ControlRequestType.INTERRUPT)

    async def set_permission_mode(self, mode: str) -> None:
        await self.send_control_request(ControlRequestType.SET_PERMISSION_MODE, {"mode": mode})

    async def set_model(self, model: str) -> None:
        await self.send_control_request(ControlRequestType.SET_MODEL, {"model": model})

    async def supported_commands(self) -> Any:
        return await self.send_control_request(ControlRequestType.SUPPORTED_COMMANDS)

    async def mcp_server_status(self) -> Any:
        return await self.send_control_request(ControlRequestType.MCP_SERVER_STATUS)

    def get_session_id(self) -> str:
        return self.session_id

    def is_closed(self) -> bool:
        return self.closed

    def end_input(self) -> None:
        if self.closed:
            return
        try:
            self.transport.end_input()
        except Exception:
            return

    async def close(self) -> None:
        if self.closed:
            return
        self.closed = True

        for future in self.pending_control_requests.values():
            if not future.done():
                future.set_exception(AbortError("Query closed"))
        self.pending_control_requests.clear()

        if self._stream_task and not self._stream_task.done():
            self._stream_task.cancel()
        if self._router_task and not self._router_task.done():
            self._router_task.cancel()

        self.abort_controller.signal.remove_listener(self._on_abort)
        await self.transport.close()
