import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { adminErrorHandler, asyncHandler } from './http.js';

function createResponseMock() {
  let statusCode = 200;
  let jsonPayload: unknown;

  const response = {
    headersSent: false,
    status: vi.fn((code: number) => {
      statusCode = code;
      return response;
    }),
    json: vi.fn((payload: unknown) => {
      jsonPayload = payload;
      return response;
    }),
  } as unknown as Response;

  return {
    response,
    get statusCode() {
      return statusCode;
    },
    get jsonPayload() {
      return jsonPayload;
    },
  };
}

describe('asyncHandler', () => {
  it('forwards async rejections to next', async () => {
    const error = new Error('boom');
    const next = vi.fn() as unknown as NextFunction;

    const handler = asyncHandler(async () => {
      throw error;
    });
    (handler as RequestHandler)(
      {} as Request,
      {} as Response,
      next,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(next).toHaveBeenCalledWith(error);
  });
});

describe('adminErrorHandler', () => {
  it('returns a 403 payload for CORS origin failures', () => {
    const res = createResponseMock();
    adminErrorHandler(
      new Error('Origin not allowed by PAPERT_ADMIN_CORS_ORIGINS'),
      {} as Request,
      res.response,
      vi.fn() as unknown as NextFunction,
    );

    expect(res.statusCode).toBe(403);
    expect(res.jsonPayload).toEqual({
      error: 'cors_forbidden',
      message: 'Origin not allowed by PAPERT_ADMIN_CORS_ORIGINS',
    });
  });

  it('returns a generic 500 payload for unexpected failures', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = createResponseMock();
    try {
      adminErrorHandler(
        new Error('db offline'),
        {} as Request,
        res.response,
        vi.fn() as unknown as NextFunction,
      );

      expect(res.statusCode).toBe(500);
      expect(res.jsonPayload).toEqual({
        error: 'internal_error',
        message: 'Internal server error.',
      });
      expect(consoleSpy).toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('returns custom payloads for explicit client errors', () => {
    const res = createResponseMock();
    adminErrorHandler(
      { status: 401, message: 'Unauthorized' },
      {} as Request,
      res.response,
      vi.fn() as unknown as NextFunction,
    );

    expect(res.statusCode).toBe(401);
    expect(res.jsonPayload).toEqual({
      error: 'request_failed',
      message: 'Unauthorized',
    });
  });
});
