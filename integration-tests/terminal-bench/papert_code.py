import json
import os
import shlex
from pathlib import Path
from typing import Any

from terminal_bench.agents.installed_agents.abstract_installed_agent import (
    AbstractInstalledAgent,
)
from terminal_bench.terminal.models import TerminalCommand


def _normalize(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    if not stripped:
        return None
    if stripped.startswith("$") and len(stripped) > 1:
        return os.environ.get(stripped[1:])
    return stripped


def _load_settings() -> dict[str, Any]:
    merged: dict[str, Any] = {}
    candidates = [
        Path.home() / ".papert" / "settings.json",
        Path.cwd() / ".papert" / "settings.json",
    ]
    for settings_path in candidates:
        if not settings_path.exists():
            continue
        try:
            with settings_path.open("r", encoding="utf-8") as handle:
                parsed = json.load(handle)
            if isinstance(parsed, dict):
                merged.update(parsed)
        except Exception:
            continue
    return merged


def _resolve_setting(settings: dict[str, Any], *path_parts: str) -> str | None:
    current: Any = settings
    for part in path_parts:
        if not isinstance(current, dict):
            return None
        current = current.get(part)
    return _normalize(current)


class PapertCodeAgent(AbstractInstalledAgent):
    @staticmethod
    def name() -> str:
        return "Papert Code"

    def __init__(self, model_name: str | None = None, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._model_name = model_name
        self._version = kwargs.get("version", "latest")

        # Configurable API settings through agent_kwargs
        self._api_key = kwargs.get("api_key")
        self._base_url = kwargs.get("base_url")
        self._settings = _load_settings()

    @property
    def _env(self) -> dict[str, str]:
        env: dict[str, str] = {}

        # API key precedence: agent kwargs > environment > papert settings
        api_key = self._api_key
        if not api_key:
            api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            api_key = _resolve_setting(self._settings, "security", "auth", "apiKey")
        if not api_key:
            raise ValueError(
                "OPENAI_API_KEY must be provided via environment, --agent-kwarg api_key=..., "
                "or .papert/settings.json security.auth.apiKey",
            )
        env["OPENAI_API_KEY"] = api_key

        # Model precedence: explicit model_name > environment > papert settings > default
        model = self._model_name
        if not model:
            model = os.environ.get("OPENAI_MODEL")
        if not model:
            model = _resolve_setting(self._settings, "model", "name")
        if not model:
            model = "papert3-coder-plus"
        env["OPENAI_MODEL"] = model

        # Base URL precedence: agent kwargs > environment > papert settings > default
        base_url = self._base_url
        if not base_url:
            base_url = os.environ.get("OPENAI_BASE_URL")
        if not base_url:
            base_url = _resolve_setting(self._settings, "security", "auth", "baseUrl")
        if not base_url:
            base_url = "https://dashscope.aliyuncs.com/compatible-mode/v1"
        env["OPENAI_BASE_URL"] = base_url

        return env

    @property
    def _install_agent_script_path(self) -> os.PathLike:
        return self._get_templated_script_path("papert-code-setup.sh.j2")

    def _run_agent_commands(self, task_description: str) -> list[TerminalCommand]:
        escaped_description = shlex.quote(task_description)
        return [
            TerminalCommand(
                command=f"papert -y --prompt {escaped_description}",
                max_timeout_sec=float("inf"),
                block=True,
                append_enter=True,
            )
        ]

