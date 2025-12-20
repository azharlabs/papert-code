from papert_code_sdk.protocol import (
    SDKUserMessage, 
    SDKAssistantMessage, 
    APIUserMessage,
    APIAssistantMessage,
    TextBlock,
    Usage
)

def test_user_message_serialization():
    msg = SDKUserMessage(
        session_id="test-session",
        message=APIUserMessage(content="Hello")
    )
    json_data = msg.model_dump_json()
    assert "test-session" in json_data
    assert "user" in json_data
    assert "Hello" in json_data

def test_assistant_message_deserialization():
    data = {
        "type": "assistant",
        "uuid": "msg-123",
        "session_id": "sess-123",
        "message": {
            "id": "msg-123",
            "type": "message",
            "role": "assistant",
            "model": "claude",
            "content": [
                {"type": "text", "text": "Hi there"}
            ],
            "usage": {
                "input_tokens": 10,
                "output_tokens": 5
            }
        }
    }
    
    msg = SDKAssistantMessage(**data)
    assert msg.uuid == "msg-123"
    assert msg.message.content[0].text == "Hi there"
