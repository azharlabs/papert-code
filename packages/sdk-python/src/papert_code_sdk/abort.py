from __future__ import annotations

from typing import Callable, List


class AbortSignal:
    def __init__(self) -> None:
        self._aborted = False
        self._listeners: List[Callable[[], None]] = []

    @property
    def aborted(self) -> bool:
        return self._aborted

    def add_listener(self, listener: Callable[[], None]) -> None:
        self._listeners.append(listener)

    def remove_listener(self, listener: Callable[[], None]) -> None:
        try:
            self._listeners.remove(listener)
        except ValueError:
            return

    def _abort(self) -> None:
        if self._aborted:
            return
        self._aborted = True
        for listener in list(self._listeners):
            try:
                listener()
            except Exception:
                # Best effort listener dispatch.
                pass


class AbortController:
    def __init__(self) -> None:
        self.signal = AbortSignal()

    def abort(self) -> None:
        self.signal._abort()

