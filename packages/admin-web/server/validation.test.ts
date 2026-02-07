import { describe, expect, it } from 'vitest';
import { SessionUploadSchema } from './validation.js';

describe('SessionUploadSchema', () => {
  it('accepts safe session ids', () => {
    const result = SessionUploadSchema.safeParse({
      sessionId: 'session-123_alpha.v1',
      transcript: 'hello',
    });
    expect(result.success).toBe(true);
  });

  it('rejects path traversal session ids', () => {
    const result = SessionUploadSchema.safeParse({
      sessionId: '../escape',
      transcript: 'hello',
    });
    expect(result.success).toBe(false);
  });
});
