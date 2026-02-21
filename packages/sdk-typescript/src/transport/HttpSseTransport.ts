/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Transport } from './Transport.js';
import {
  RemoteControlApiClient,
  type CreateRemoteSessionResponse,
} from '../generated/remoteControlApiClient.js';

export type HttpSseTransportOptions = {
  baseUrl: string;
  /** Token required to create a session (server token). */
  serverToken: string;
  /** Optional override; defaults to process.cwd() on the server. */
  workspaceRoot?: string;
};

type SessionResponse = {
  sessionId: string;
  token: string;
  expiresAtMs: number;
  workspaceRoot: string;
};

export class HttpSseTransport implements Transport {
  private readonly options: HttpSseTransportOptions;
  private readonly remoteApiClient: RemoteControlApiClient;
  private _exitError: Error | null = null;
  private _isReady = false;

  private session: SessionResponse | null = null;
  private pendingWrites: string[] = [];

  constructor(options: HttpSseTransportOptions) {
    this.options = options;
    this.remoteApiClient = new RemoteControlApiClient({
      baseUrl: options.baseUrl,
    });
    this._isReady = true;
  }

  get isReady(): boolean {
    return this._isReady;
  }

  get exitError(): Error | null {
    return this._exitError;
  }

  async close(): Promise<void> {
    if (!this.session) return;

    try {
      await this.remoteApiClient.releaseRemoteSession({
        sessionId: this.session.sessionId,
        sessionToken: this.session.token,
      });
    } catch {
      // Best-effort.
    } finally {
      this.session = null;
    }
  }

  async waitForExit(): Promise<void> {
    // Network transport doesn't have a process lifecycle.
    return;
  }

  write(message: string): void {
    // Query writes before readMessages() starts; buffer until we start streaming.
    this.pendingWrites.push(message);
  }

  async *readMessages(): AsyncGenerator<unknown, void, unknown> {
    if (!this.session) {
      this.session = await this.createSession();
    }

    // For now we support a single request/response stream per transport instance.
    const first = this.pendingWrites.shift();
    if (!first) {
      return;
    }

    const res = await fetch(new URL('/', this.options.baseUrl), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.session.token}`,
        'x-papert-session-id': this.session.sessionId,
      },
      body: first,
    });

    if (!res.ok || !res.body) {
      throw new Error(`Remote request failed: ${res.status} ${res.statusText}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by a blank line.
      while (true) {
        const idx = buffer.indexOf('\n\n');
        if (idx === -1) break;
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);

        const dataLine = chunk
          .split('\n')
          .find((line) => line.startsWith('data: '));
        if (!dataLine) continue;

        const json = dataLine.slice('data: '.length);
        yield JSON.parse(json) as unknown;
      }
    }
  }

  private async createSession(): Promise<SessionResponse> {
    const response: CreateRemoteSessionResponse =
      await this.remoteApiClient.createRemoteSession(this.options.serverToken);
    return response;
  }
}
