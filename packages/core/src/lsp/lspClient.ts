/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { LspStdioMessageReader, encodeLspMessage, type JsonRpcMessage } from './jsonRpc.js';
import { safeJsonStringify } from '../utils/safeJsonStringify.js';

export type LspNotificationHandler = (method: string, params: unknown) => void;

export interface LspClientOptions {
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
  rootUri: string;
  workspaceFolders?: Array<{ name: string; uri: string }>;
  initializationOptions?: unknown;
  clientName?: string;
}

export class LspClient {
  private readonly proc: ChildProcessWithoutNullStreams;
  private readonly reader = new LspStdioMessageReader();
  private nextId = 1;
  private readonly pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (err: Error) => void;
    }
  >();

  private initialized = false;
  private notificationHandler: LspNotificationHandler | undefined;

  constructor(private readonly options: LspClientOptions) {
    this.proc = spawn(options.command, options.args, {
      cwd: options.cwd,
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: 'pipe',
      windowsHide: true,
    });

    this.proc.stdout.on('data', (chunk) => this.reader.push(chunk));
    this.proc.stdout.on('end', () => this.reader.end());

    this.proc.stderr.on('data', (chunk) => {
      // LSP servers often log to stderr; keep it quiet unless debugging is needed.
      // eslint-disable-next-line no-console
      console.debug(`[LSP:${options.command}] ${chunk.toString()}`);
    });

    this.proc.on('exit', (code, signal) => {
      const err = new Error(
        `LSP server exited (code=${code ?? 'none'}, signal=${signal ?? 'none'})`,
      );
      for (const { reject } of this.pending.values()) {
        reject(err);
      }
      this.pending.clear();
    });

    this.reader.onMessage((msg) => this.onMessage(msg));
  }

  async initialize(signal?: AbortSignal): Promise<void> {
    if (this.initialized) return;

    const initParams = {
      processId: process.pid,
      clientInfo: {
        name: this.options.clientName ?? 'papert-code',
        version: '0.0.0',
      },
      rootUri: this.options.rootUri,
      workspaceFolders: this.options.workspaceFolders,
      capabilities: {
        textDocument: {
          hover: { dynamicRegistration: false },
          definition: { dynamicRegistration: false },
          references: { dynamicRegistration: false },
          documentSymbol: { dynamicRegistration: false },
          implementation: { dynamicRegistration: false },
          callHierarchy: { dynamicRegistration: false },
          publishDiagnostics: { relatedInformation: true },
        },
        workspace: {
          symbol: { dynamicRegistration: false },
        },
      },
      initializationOptions: this.options.initializationOptions,
    };

    await this.request('initialize', initParams, signal);
    this.notify('initialized', {});
    this.initialized = true;
  }

  onNotification(handler: LspNotificationHandler): void {
    this.notificationHandler = handler;
  }

  dispose(): void {
    try {
      this.notify('exit', {});
    } catch {
      // ignore
    }
    this.proc.kill();
  }

  async request(method: string, params: unknown, signal?: AbortSignal): Promise<unknown> {
    const id = this.nextId++;

    if (signal?.aborted) {
      throw new Error('LSP request aborted before sending');
    }

    const msg: JsonRpcMessage = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    const payload = encodeLspMessage(msg);

    const resultPromise = new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, {
        resolve,
        reject,
      });
    });

    this.proc.stdin.write(payload);

    if (signal) {
      const onAbort = () => {
        this.pending.delete(id);
        try {
          this.notify('$/cancelRequest', { id });
        } catch {
          // ignore
        }
      };
      if (signal.aborted) {
        onAbort();
      } else {
        signal.addEventListener('abort', onAbort, { once: true });
      }
    }

    return resultPromise;
  }

  notify(method: string, params: unknown): void {
    const msg: JsonRpcMessage = {
      jsonrpc: '2.0',
      method,
      params,
    };
    this.proc.stdin.write(encodeLspMessage(msg));
  }

  private onMessage(msg: JsonRpcMessage): void {
    if (msg.id !== undefined) {
      const pending = this.pending.get(Number(msg.id));
      if (!pending) return;
      this.pending.delete(Number(msg.id));

      if (msg.error) {
        pending.reject(new Error(safeJsonStringify(msg.error)));
      } else {
        pending.resolve(msg.result);
      }
      return;
    }

    if (msg.method) {
      this.notificationHandler?.(msg.method, msg.params);
    }
  }

  static filePathToUri(filePath: string): string {
    return pathToFileURL(path.resolve(filePath)).href;
  }
}
