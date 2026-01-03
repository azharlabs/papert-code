import os
from typing import AsyncIterable, Dict, Any, Union, Optional, Iterable

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
    cleaned = [p.strip() for p in paths if p and str(p).strip()]
    if not cleaned:
        return None
    return os.pathsep.join(dict.fromkeys(cleaned))

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
    
    env = dict(options.get("env") or {})
    skills_path = options.get("skillsPath") or options.get("skillsPaths")
    normalized_skills = _normalize_skills_paths(skills_path)
    if normalized_skills:
        existing = env.get(SKILLS_PATHS_ENV)
        if existing:
            normalized_skills = _normalize_skills_paths(
                [existing, normalized_skills]
            )
        env[SKILLS_PATHS_ENV] = normalized_skills

    transport = ProcessTransport(
        path_to_papert_executable=options.get("pathToPapertExecutable"),
        cwd=options.get("cwd"),
        env=env,
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
