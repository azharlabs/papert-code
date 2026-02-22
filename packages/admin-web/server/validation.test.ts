import { describe, expect, it } from 'vitest';
import { SessionUploadSchema, UsageReportSchema } from './validation.js';

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

describe('UsageReportSchema', () => {
  it('accepts optional prompt/completion token fields', () => {
    const result = UsageReportSchema.safeParse({
      sessionId: 'session-1',
      totalTokens: 120,
      promptTokens: 70,
      completionTokens: 50,
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative token values', () => {
    const result = UsageReportSchema.safeParse({
      sessionId: 'session-1',
      totalTokens: 120,
      promptTokens: -1,
    });
    expect(result.success).toBe(false);
  });
});
