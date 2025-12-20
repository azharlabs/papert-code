import asyncio
import json
import logging
import uuid
from typing import AsyncIterable, Optional, Dict, Any, Union, List, Callable, Awaitable

from .protocol import (
    SDKMessage, SDKUserMessage, SDKAssistantMessage, SDKSystemMessage, 
    SDKResultMessage, SDKPartialAssistantMessage, 
    CLIControlRequest, CLIControlResponse, ControlCancelRequest,
    ControlRequestType, ContentBlock
)
from .transport import ProcessTransport

logger = logging.getLogger(__name__)

PermissionCallback = Callable[[str, Dict[str, Any]], Awaitable[Dict[str, Any]]]

class Query:
    def __init__(
        self,
        transport: ProcessTransport,
        prompt: Union[str, AsyncIterable[SDKUserMessage]],
        options: Dict[str, Any] = None,
    ):
        self.transport = transport
        self.prompt = prompt
        self.options = options or {}
        self.session_id = str(uuid.uuid4())
        
        self.input_queue: asyncio.Queue[SDKMessage] = asyncio.Queue()
        self.pending_control_requests: Dict[str, asyncio.Future] = {}
        self.closed = False
        self.is_single_turn = isinstance(prompt, str)
        
        self.can_use_tool: Optional[PermissionCallback] = self.options.get("can_use_tool")
        
        self._router_task: Optional[asyncio.Task] = None
        self._stream_task: Optional[asyncio.Task] = None
        self._initialization_event = asyncio.Event()

    def __aiter__(self):
        return self

    async def __anext__(self) -> SDKMessage:
        if self._router_task is None:
            await self._start()
            
        try:
            # Check if queue has items or if we are done
            if self.closed and self.input_queue.empty():
                raise StopAsyncIteration
                
            # Wait for next message or router completion
            # Simple implementation: get from queue
            # Better implementation needs to handle task failures/completions
            
            # Using wait_for to allow checking router status periodically isn't strictly necessary 
            # if we correctly put specific sentinel or error in queue.
            # Here we just rely on queue.get()
            
            item = await self.input_queue.get()
            if isinstance(item, Exception):
                raise item
            if item is None: # Sentinel for end of stream
                raise StopAsyncIteration
                
            return item
            
        except asyncio.CancelledError:
            await self.close()
            raise StopAsyncIteration

    async def _start(self):
        """Starts the transport and message routing."""
        await self.transport.initialize()
        self._router_task = asyncio.create_task(self._route_messages())
        
        # Initialize session
        try:
            await self.send_control_request(ControlRequestType.INITIALIZE, {
                "mcpServers": self.options.get("mcpServers"),
                # Add other initialization options here
            })
            self._initialization_event.set()
        except Exception as e:
            logger.error(f"Initialization failed: {e}")
            await self.close()
            raise

        # Start streaming input prompt
        if self.is_single_turn:
            await self._send_single_turn_prompt()
        else:
            self._stream_task = asyncio.create_task(self._stream_input())

    async def _send_single_turn_prompt(self):
        msg = SDKUserMessage(
            type="user",
            session_id=self.session_id,
            message={
                "role": "user",
                "content": self.prompt
            }
        )
        await self.transport.write(msg.model_dump_json())

    async def _stream_input(self):
        try:
            await self._initialization_event.wait()
            async for msg in self.prompt:
                if self.closed: 
                    break
                await self.transport.write(msg.model_dump_json())
            
            # End input not strictly needed for JSON-RPC over stdio but 
            # might be needed if transport supports it.
            # For now we just stop writing.
        except Exception as e:
             logger.error(f"Error streaming input: {e}")

    async def _route_messages(self):
        try:
            async for raw_msg in self.transport.read_messages():
                if self.closed:
                    break
                
                await self._handle_message(raw_msg)
        except Exception as e:
            logger.error(f"Router error: {e}")
            await self.input_queue.put(e)
        finally:
            await self.input_queue.put(None) # Signal end

    async def _handle_message(self, raw_msg: Dict[str, Any]):
        msg_type = raw_msg.get("type")
        
        if msg_type == "control_request":
            await self._handle_control_request(CLIControlRequest(**raw_msg))
            return
            
        if msg_type == "control_response":
            await self._handle_control_response(CLIControlResponse(**raw_msg))
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
            await self.input_queue.put(SDKResultMessage(**raw_msg))
            return

        if msg_type == "stream_event":
            await self.input_queue.put(SDKPartialAssistantMessage(**raw_msg))
            return

        logger.warning(f"Unknown message type: {msg_type}")

    async def _handle_control_request(self, req: CLIControlRequest):
        payload = req.request
        subtype = payload.get("subtype") # Using .get() because it's a dict in Pydantic model dump if not careful, but here req.request is Dict
        
        response_data = None
        success = True
        error_msg = None
        
        try:
            if subtype == "can_use_tool":
                response_data = await self._handle_permission_request(
                    payload.get("tool_name"),
                    payload.get("input"),
                )
            else:
                success = False
                error_msg = f"Unknown control request subtype: {subtype}"
                logger.warning(error_msg)
                
        except Exception as e:
            success = False
            error_msg = str(e)
            logger.error(f"Error handling control request {subtype}: {e}")
            
        await self._send_control_response(req.request_id, success, response_data, error_msg)

    async def _handle_permission_request(self, tool_name: str, tool_input: Any) -> Dict[str, Any]:
        if not self.can_use_tool:
            return {"behavior": "deny", "message": "No permission callback registered"}
            
        try:
            # We assume callback returns a dict matching the expected structure
            # In a real implementation we should validate the return value
            return await self.can_use_tool(tool_name, tool_input)
        except Exception as e:
            logger.error(f"Permission callback failed: {e}")
            return {"behavior": "deny", "message": f"Permission callback error: {e}"}

    async def _handle_control_response(self, resp: CLIControlResponse):
        payload = resp.response
        request_id = payload.request_id
        
        if request_id in self.pending_control_requests:
            future = self.pending_control_requests.pop(request_id)
            if not future.done():
                if payload.subtype == "success":
                    future.set_result(payload.response)
                else:
                    future.set_exception(Exception(payload.error))

    async def send_control_request(self, subtype: str, data: Dict[str, Any] = None) -> Any:
        request_id = str(uuid.uuid4())
        data = data or {}
        
        req = CLIControlRequest(
            request_id=request_id,
            request={"subtype": subtype, **data}
        )
        
        future = asyncio.Future()
        self.pending_control_requests[request_id] = future
        
        await self.transport.write(req.model_dump_json())
        
        # Wait for response with timeout
        try:
            return await asyncio.wait_for(future, timeout=30.0)
        except asyncio.TimeoutError:
            self.pending_control_requests.pop(request_id, None)
            raise TimeoutError(f"Control request {subtype} timed out")

    async def _send_control_response(self, request_id: str, success: bool, response: Any = None, error: Any = None):
        resp_payload = {
            "subtype": "success" if success else "error",
            "request_id": request_id,
        }
        
        if success:
            resp_payload["response"] = response
        else:
            resp_payload["error"] = error
            
        resp = CLIControlResponse(
            response=ControlResponsePayload(**resp_payload)
        )
        
        await self.transport.write(resp.model_dump_json())

    async def close(self):
        if self.closed:
            return
        self.closed = True
        
        if self._stream_task:
            self._stream_task.cancel()
            
        if self._router_task:
            self._router_task.cancel()
            
        await self.transport.close()
