import type { ErrorRequestHandler, RequestHandler } from 'express';

type AsyncRequestHandler = (
  ...args: Parameters<RequestHandler>
) => Promise<unknown>;

function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  if (!('status' in error)) return undefined;
  const status = (error as { status?: unknown }).status;
  if (typeof status !== 'number' || !Number.isInteger(status)) return undefined;
  return status;
}

function getErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  if (!('message' in error)) return undefined;
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : undefined;
}

export function asyncHandler(handler: AsyncRequestHandler): RequestHandler {
  return (req, res, next) => {
    void handler(req, res, next).catch(next);
  };
}

export const adminErrorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (res.headersSent) return;

  const message = getErrorMessage(error);
  if (message === 'Origin not allowed by PAPERT_ADMIN_CORS_ORIGINS') {
    res.status(403).json({
      error: 'cors_forbidden',
      message,
    });
    return;
  }

  const status = getErrorStatus(error) ?? 500;
  if (status >= 500) {
    console.error('[admin-web] Unhandled request failure', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Internal server error.',
    });
    return;
  }

  res.status(status).json({
    error: 'request_failed',
    message: message || 'Request failed.',
  });
};
