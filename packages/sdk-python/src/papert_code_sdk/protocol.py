from __future__ import annotations
from typing import List, Optional, Union, Dict, Any, Literal
from pydantic import BaseModel, Field

class Annotation(BaseModel):
    type: str
    value: str

class Usage(BaseModel):
    input_tokens: int
    output_tokens: int
    cache_creation_input_tokens: Optional[int] = None
    cache_read_input_tokens: Optional[int] = None
    total_tokens: Optional[int] = None

class ExtendedUsage(Usage):
    server_tool_use: Optional[Dict[str, int]] = None
    service_tier: Optional[str] = None
    cache_creation: Optional[Dict[str, int]] = None

class CLIPermissionDenial(BaseModel):
    tool_name: str
    tool_use_id: str
    tool_input: Any

class TextBlock(BaseModel):
    type: Literal['text'] = 'text'
    text: str
    annotations: Optional[List[Annotation]] = None

class ThinkingBlock(BaseModel):
    type: Literal['thinking'] = 'thinking'
    thinking: str
    signature: Optional[str] = None
    annotations: Optional[List[Annotation]] = None

class ToolUseBlock(BaseModel):
    type: Literal['tool_use'] = 'tool_use'
    id: str
    name: str
    input: Any
    annotations: Optional[List[Annotation]] = None

class ToolResultBlock(BaseModel):
    type: Literal['tool_result'] = 'tool_result'
    tool_use_id: str
    content: Optional[Union[str, List['ContentBlock']]] = None
    is_error: Optional[bool] = None
    annotations: Optional[List[Annotation]] = None

ContentBlock = Union[TextBlock, ThinkingBlock, ToolUseBlock, ToolResultBlock]
ToolResultBlock.model_rebuild()

class APIUserMessage(BaseModel):
    role: Literal['user'] = 'user'
    content: Union[str, List[ContentBlock]]

class APIAssistantMessage(BaseModel):
    id: str
    type: Literal['message'] = 'message'
    role: Literal['assistant'] = 'assistant'
    model: str
    content: List[ContentBlock]
    stop_reason: Optional[str] = None
    usage: Usage

class SDKUserMessage(BaseModel):
    type: Literal['user'] = 'user'
    uuid: Optional[str] = None
    session_id: str
    message: APIUserMessage
    parent_tool_use_id: Optional[str] = None
    options: Optional[Dict[str, Any]] = None

class SDKAssistantMessage(BaseModel):
    type: Literal['assistant'] = 'assistant'
    uuid: str
    session_id: str
    message: APIAssistantMessage
    parent_tool_use_id: Optional[str] = None

class SDKSystemMessage(BaseModel):
    type: Literal['system'] = 'system'
    subtype: str
    uuid: str
    session_id: str
    data: Optional[Any] = None
    cwd: Optional[str] = None
    tools: Optional[List[str]] = None
    model: Optional[str] = None
    permission_mode: Optional[str] = None
    
    # Allow extra fields for system messages as they may evolve
    class Config:
        extra = 'allow'

class SDKResultMessage(BaseModel):
    type: Literal['result'] = 'result'
    subtype: str
    uuid: str
    session_id: str
    is_error: bool
    duration_ms: int
    duration_api_ms: int
    num_turns: int
    usage: Optional[ExtendedUsage] = None
    permission_denials: Optional[List[CLIPermissionDenial]] = None
    
    # Subtype-specific fields
    result: Optional[str] = None
    error: Optional[Dict[str, Any]] = None

    class Config:
        extra = 'allow'

class MessageStartStreamEvent(BaseModel):
    type: Literal['message_start'] = 'message_start'
    message: Dict[str, Any]

class ContentBlockStartEvent(BaseModel):
    type: Literal['content_block_start'] = 'content_block_start'
    index: int
    content_block: ContentBlock

class ContentBlockDelta(BaseModel):
    type: str # text_delta, thinking_delta, input_json_delta
    text: Optional[str] = None
    thinking: Optional[str] = None
    partial_json: Optional[str] = None

class ContentBlockDeltaEvent(BaseModel):
    type: Literal['content_block_delta'] = 'content_block_delta'
    index: int
    delta: ContentBlockDelta

class ContentBlockStopEvent(BaseModel):
    type: Literal['content_block_stop'] = 'content_block_stop'
    index: int

class MessageStopStreamEvent(BaseModel):
    type: Literal['message_stop'] = 'message_stop'

StreamEvent = Union[
    MessageStartStreamEvent,
    ContentBlockStartEvent,
    ContentBlockDeltaEvent,
    ContentBlockStopEvent,
    MessageStopStreamEvent
]

class SDKPartialAssistantMessage(BaseModel):
    type: Literal['stream_event'] = 'stream_event'
    uuid: str
    session_id: str
    event: StreamEvent
    parent_tool_use_id: Optional[str] = None

SDKMessage = Union[
    SDKUserMessage,
    SDKAssistantMessage,
    SDKSystemMessage,
    SDKResultMessage,
    SDKPartialAssistantMessage
]

# Control messages

class ControlRequestType:
    # SystemController requests
    INITIALIZE = 'initialize'
    INTERRUPT = 'interrupt'
    SET_MODEL = 'set_model'
    SUPPORTED_COMMANDS = 'supported_commands'

    # PermissionController requests
    CAN_USE_TOOL = 'can_use_tool'
    SET_PERMISSION_MODE = 'set_permission_mode'

    # MCPController requests
    MCP_MESSAGE = 'mcp_message'
    MCP_SERVER_STATUS = 'mcp_server_status'

    # HookController requests
    HOOK_CALLBACK = 'hook_callback'

class CLIControlRequest(BaseModel):

    type: Literal['control_request'] = 'control_request'
    request_id: str
    request: Dict[str, Any]

class ControlResponsePayload(BaseModel):
    subtype: str
    request_id: str
    response: Optional[Any] = None
    error: Optional[Union[str, Dict[str, Any]]] = None

class CLIControlResponse(BaseModel):
    type: Literal['control_response'] = 'control_response'
    response: ControlResponsePayload

class ControlCancelRequest(BaseModel):
    type: Literal['control_cancel_request']
    request_id: Optional[str] = None
