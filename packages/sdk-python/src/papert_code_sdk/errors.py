class AbortError(RuntimeError):
    """Raised when a query is aborted by user signal."""


def is_abort_error(error: BaseException) -> bool:
    return isinstance(error, AbortError)

