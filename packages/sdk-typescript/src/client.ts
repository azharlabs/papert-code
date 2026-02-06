import { randomUUID } from 'node:crypto';
import type { SDKMessage, SDKUserMessage } from './types/protocol.js';
import type { QueryOptions } from './types/types.js';
import { query } from './query/createQuery.js';
import type { Query } from './query/Query.js';

export interface CreateSessionOptions {
  sessionId?: string;
  options?: QueryOptions;
}

export class PapertClient {
  private readonly options: QueryOptions;
  private readonly sessions = new Map<string, PapertClientSession>();

  constructor(options: QueryOptions = {}) {
    this.options = options;
  }

  createSession({
    sessionId = randomUUID(),
    options = {},
  }: CreateSessionOptions = {}): PapertClientSession {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      return existing;
    }

    const session = new PapertClientSession(sessionId, this, options);
    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): PapertClientSession | undefined {
    return this.sessions.get(sessionId);
  }

  getDefaultOptions(): QueryOptions {
    return this.options;
  }

  unregisterSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  async close(): Promise<void> {
    const sessions = Array.from(this.sessions.values());
    this.sessions.clear();
    await Promise.allSettled(sessions.map((session) => session.close()));
  }
}

export class PapertClientSession {
  private readonly activeQueries = new Set<Query>();
  private closed = false;

  constructor(
    private readonly sessionId: string,
    private readonly client: PapertClient,
    private readonly options: QueryOptions = {},
  ) {}

  getSessionId(): string {
    return this.sessionId;
  }

  isClosed(): boolean {
    return this.closed;
  }

  stream(prompt: string, options: QueryOptions = {}): Query {
    if (this.closed) {
      throw new Error('Session is closed');
    }

    const mergedOptions = {
      ...this.client.getDefaultOptions(),
      ...this.options,
      ...options,
    };

    const promptStream = this.createPromptStream(prompt);
    const q = query({
      prompt: promptStream,
      options: mergedOptions,
    });

    this.activeQueries.add(q);
    return q;
  }

  async send(prompt: string, options: QueryOptions = {}): Promise<SDKMessage[]> {
    const q = this.stream(prompt, options);
    const messages: SDKMessage[] = [];

    try {
      for await (const message of q) {
        messages.push(message);
      }
    } finally {
      await q.close();
      this.activeQueries.delete(q);
    }

    return messages;
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;

    const queries = Array.from(this.activeQueries.values());
    this.activeQueries.clear();

    await Promise.allSettled(queries.map((q) => q.close()));
    this.client.unregisterSession(this.sessionId);
  }

  private async *createPromptStream(
    prompt: string,
  ): AsyncIterable<SDKUserMessage> {
    yield {
      type: 'user',
      session_id: this.sessionId,
      message: {
        role: 'user',
        content: prompt,
      },
      parent_tool_use_id: null,
    };
  }
}

export function createClient(options: QueryOptions = {}): PapertClient {
  return new PapertClient(options);
}
