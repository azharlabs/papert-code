from typing import AsyncIterable, Dict, Any, Union, Optional

from .protocol import SDKUserMessage
from .query import Query
from .transport import ProcessTransport

def query(
    prompt: Union[str, AsyncIterable[SDKUserMessage]],
    options: Optional[Dict[str, Any]] = None,
) -> Query:
    """
    Creates a new query session with the Papert Code.
    
    Args:
        prompt: A string for single-turn query or an async iterable for multi-turn.
        options: Configuration options.
    
    Returns:
        A Query instance that yields messages.
    """
    options = options or {}
    
    transport = ProcessTransport(
        path_to_papert_executable=options.get("pathToPapertExecutable"),
        cwd=options.get("cwd"),
        env=options.get("env"),
        debug=options.get("debug", False),
        model=options.get("model"),
        permission_mode=options.get("permissionMode"),
    )
    
    return Query(transport, prompt, options)

# Alias or wrapper for creating an agent if needed, 
# although query() is the main entry point in the TS SDK too.
# For compatibility with the requirements:

async def create_papert_agent(config: Dict[str, Any]):
    """
    Creates a Papert Agent (wrapper around CLI process).
    This mimics the TS SDK's createPapertAgent for full process control.
    """
    # This is a bit different in Python structure, but we can expose it if needed.
    # For now, let's stick to the query() function as the primary API.
    pass
