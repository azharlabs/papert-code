import os
import re
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import List, Mapping, Optional, Tuple

_RUNTIME_PREFIX_RE = re.compile(r"^([^:]+):(.+)$")
_JS_EXTENSIONS = (".js", ".mjs", ".cjs")
_TS_EXTENSIONS = (".ts", ".tsx")


@dataclass(frozen=True)
class SpawnInfo:
    command: str
    args: List[str]
    original_input: str


def find_bundled_cli_path(package_dir: Optional[Path] = None) -> Optional[str]:
    base_dir = package_dir or Path(__file__).resolve().parent
    candidate = base_dir / "cli" / "cli.js"
    if candidate.exists():
        return str(candidate)
    return None


def find_native_cli_path(
    env: Optional[Mapping[str, str]] = None,
    package_dir: Optional[Path] = None,
) -> str:
    installed = shutil.which("papert")
    if installed:
        return os.path.abspath(installed)

    raise FileNotFoundError(
        "papert CLI not found. Please:\n"
        "  1. Install papert globally: npm install -g papert\n"
        "\n"
        "For development/testing, you can also use:\n"
        "  • Node.js bundle: query({\"pathToPapertExecutable\": \"/path/to/cli.js\"})\n"
        "  • Force specific runtime: query({\"pathToPapertExecutable\": \"node:/path/to/cli.js\"})"
    )


def parse_executable_spec(executable_spec: Optional[str], env: Optional[Mapping[str, str]] = None) -> Tuple[Optional[str], str, bool]:
    if executable_spec is not None and executable_spec.strip() == "":
        raise ValueError("Command name cannot be empty")

    if not executable_spec:
        return None, find_native_cli_path(env=env), False

    match = _RUNTIME_PREFIX_RE.match(executable_spec)
    if match:
        runtime, file_path = match.group(1), match.group(2)
        if not runtime or not file_path:
            raise ValueError(f"Invalid runtime specification: '{executable_spec}'")
        return runtime, file_path, True

    return None, executable_spec, False


def _ensure_command_available(command: str) -> None:
    if os.path.isabs(command) or os.path.exists(command):
        return
    if shutil.which(command):
        return
    raise FileNotFoundError(f"Command not found: {command}")


def resolve_spawn_info(executable_spec: Optional[str], env: Optional[Mapping[str, str]] = None) -> SpawnInfo:
    runtime, executable_path, _ = parse_executable_spec(executable_spec, env=env)
    executable_path = os.path.expanduser(executable_path)

    if runtime:
        command = runtime
        args = [executable_path]
        if not os.path.exists(executable_path):
            raise FileNotFoundError(f"CLI path not found: {executable_path}")
    else:
        ext = os.path.splitext(executable_path)[1].lower()
        if ext in _JS_EXTENSIONS:
            command = "node"
            args = [executable_path]
            if not os.path.exists(executable_path):
                raise FileNotFoundError(f"CLI path not found: {executable_path}")
        elif ext in _TS_EXTENSIONS:
            command = "tsx"
            args = [executable_path]
            if not os.path.exists(executable_path):
                raise FileNotFoundError(f"CLI path not found: {executable_path}")
        else:
            command = executable_path
            args = []

    _ensure_command_available(command)

    original = executable_spec or executable_path
    return SpawnInfo(command=command, args=args, original_input=original)
