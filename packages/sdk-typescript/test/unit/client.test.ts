import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SDKMessage } from '../../src/types/protocol.js';

const queryMock = vi.fn();

vi.mock('../../src/query/createQuery.js', () => ({
  query: (args: {
    prompt: string;
    options?: Record<string, unknown>;
  }) => queryMock(args),
}));

import { createClient } from '../../src/client.js';

class FakeQuery implements AsyncIterable<SDKMessage> {
  private idx = 0;
  private readonly messages: SDKMessage[];
  public closed = false;

  constructor(messages: SDKMessage[]) {
    this.messages = messages;
  }

  [Symbol.asyncIterator](): AsyncIterator<SDKMessage> {
    return {
      next: async (): Promise<IteratorResult<SDKMessage>> => {
        if (this.idx >= this.messages.length) {
          return {
            done: true,
            value: undefined,
          };
        }

        const value = this.messages[this.idx];
        this.idx += 1;
        return { done: false, value };
      },
    };
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

describe('PapertClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reuses session id via options and sends string prompt', async () => {
    const fakeQuery = new FakeQuery([]);
    queryMock.mockReturnValue(fakeQuery);

    const client = createClient({ cwd: '/repo' });
    const session = client.createSession({ sessionId: 'session-123' });
    session.stream('hello', { model: 'gpt-4o-mini' });

    const firstCall = queryMock.mock.calls[0][0] as {
      prompt: string;
      options: Record<string, unknown>;
    };
    expect(firstCall.options.cwd).toBe('/repo');
    expect(firstCall.options.model).toBe('gpt-4o-mini');
    expect(firstCall.options.sessionId).toBe('session-123');
    expect(firstCall.prompt).toBe('hello');
  });

  it('send() collects all messages and closes query', async () => {
    const messages: SDKMessage[] = [
      {
        type: 'assistant',
        uuid: 'a1',
        session_id: 's1',
        message: {
          id: 'm1',
          type: 'message',
          role: 'assistant',
          model: 'gpt-4o-mini',
          content: [{ type: 'text', text: 'hi' }],
          usage: { input_tokens: 1, output_tokens: 1 },
        },
        parent_tool_use_id: null,
      },
      {
        type: 'result',
        subtype: 'success',
        uuid: 'r1',
        session_id: 's1',
        is_error: false,
        duration_ms: 1,
        duration_api_ms: 1,
        num_turns: 1,
        result: 'ok',
        usage: { input_tokens: 1, output_tokens: 1 },
        permission_denials: [],
      },
    ];

    const fakeQuery = new FakeQuery(messages);
    queryMock.mockReturnValue(fakeQuery);

    const client = createClient();
    const session = client.createSession({ sessionId: 'session-send' });
    const result = await session.send('run');

    expect(result.length).toBe(2);
    expect(fakeQuery.closed).toBe(true);
  });

  it('close() closes active sessions', async () => {
    const fakeQuery = new FakeQuery([]);
    queryMock.mockReturnValue(fakeQuery);

    const client = createClient();
    const session = client.createSession({ sessionId: 'session-close' });
    session.stream('run');
    await client.close();

    expect(session.isClosed()).toBe(true);
    expect(fakeQuery.closed).toBe(true);
  });

  it('returns same session for existing id', () => {
    const client = createClient();
    const a = client.createSession({ sessionId: 'same-id' });
    const b = client.createSession({ sessionId: 'same-id' });
    expect(a).toBe(b);
  });
});
