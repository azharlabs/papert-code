/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type express from 'express';
import { type IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { Readable } from 'node:stream';

type RequestOptions = {
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
};

export type RequestResult = {
  status: number;
  text: string;
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
};

type ExpressHandle = (
  req: IncomingMessage,
  res: ServerResponse,
  next: (err?: unknown) => void,
) => void;

export async function requestApp(
  app: express.Express,
  { method, path, headers = {}, body }: RequestOptions,
): Promise<RequestResult> {
  const socket = new Socket();
  (socket as unknown as { readable: boolean }).readable = true;
  (socket as unknown as { writable: boolean }).writable = true;
  socket.write = ((chunk: unknown, _encoding?: unknown, callback?: () => void) => {
    if (typeof _encoding === 'function') {
      _encoding();
      return true;
    }
    if (callback) {
      callback();
    }
    return true;
  }) as typeof socket.write;

  const req = new Readable({ read() {} }) as IncomingMessage & { body?: unknown };
  req.method = method.toUpperCase();
  req.url = path;
  req.headers = { ...headers };
  req.socket = socket;
  req.connection = socket;
  req.httpVersion = '1.1';

  if (body !== undefined) {
    req.body = body;
  }

  req.readable = true;

  const res = new ServerResponse(req);
  res.assignSocket(socket);

  const chunks: Buffer[] = [];
  const originalWrite = res.write.bind(res);
  res.write = ((chunk: unknown, ...args: unknown[]) => {
    if (chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    }
    return originalWrite(chunk as never, ...(args as []));
  }) as typeof res.write;

  const originalEnd = res.end.bind(res);
  res.end = ((chunk?: unknown, ...args: unknown[]) => {
    if (chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    }
    return originalEnd(chunk as never, ...(args as []));
  }) as typeof res.end;

  await new Promise<void>((resolve, reject) => {
    res.on('finish', () => resolve());
    (app as unknown as { handle: ExpressHandle }).handle(
      req,
      res,
      (err: unknown) => {
        if (err) {
          reject(err);
        }
      },
    );
    process.nextTick(() => {
      req.push(null);
    });
  });

  const text = Buffer.concat(chunks).toString('utf8');
  const contentTypeHeader = res.getHeader('content-type');
  const contentType = Array.isArray(contentTypeHeader)
    ? contentTypeHeader.join(';')
    : contentTypeHeader?.toString() ?? '';

  let parsedBody: unknown = text;
  if (contentType.includes('application/json')) {
    try {
      parsedBody = text ? JSON.parse(text) : null;
    } catch {
      parsedBody = text;
    }
  }

  return {
    status: res.statusCode,
    text,
    body: parsedBody,
    headers: res.getHeaders() as Record<string, string | string[] | undefined>,
  };
}
