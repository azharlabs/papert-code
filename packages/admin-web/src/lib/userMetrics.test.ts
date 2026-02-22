import { describe, expect, it } from 'vitest';
import type { SessionRecord, UsageRecord } from '../types';
import {
  buildDailyUserMetrics,
  buildUserTokenTotals,
  getSessionTokenSummary,
} from './userMetrics';

describe('userMetrics helpers', () => {
  it('derives total session tokens from input/output fields when needed', () => {
    const fromSplitOnly = getSessionTokenSummary({
      input_tokens: 20,
      output_tokens: 30,
    });
    const fromExplicitTotal = getSessionTokenSummary({
      total_tokens: 60,
      input_tokens: 20,
      output_tokens: 30,
    });

    expect(fromSplitOnly.totalTokens).toBe(50);
    expect(fromSplitOnly.inputTokens).toBe(20);
    expect(fromSplitOnly.outputTokens).toBe(30);
    expect(fromExplicitTotal.totalTokens).toBe(60);
  });

  it('builds user totals from monthly usage buckets when present', () => {
    const usage: UsageRecord[] = [
      {
        id: 'u-1',
        userId: 'user-1',
        period: 'daily',
        periodStart: '2026-02-03T00:00:00.000Z',
        tokensUsed: 30,
        promptTokens: 18,
        completionTokens: 12,
        updatedAt: '2026-02-03T10:00:00.000Z',
      },
      {
        id: 'u-2',
        userId: 'user-1',
        period: 'monthly',
        periodStart: '2026-01-01T00:00:00.000Z',
        tokensUsed: 100,
        promptTokens: 60,
        completionTokens: 40,
        updatedAt: '2026-01-31T23:00:00.000Z',
      },
      {
        id: 'u-3',
        userId: 'user-1',
        period: 'monthly',
        periodStart: '2026-02-01T00:00:00.000Z',
        tokensUsed: 200,
        promptTokens: 110,
        completionTokens: 90,
        updatedAt: '2026-02-28T23:00:00.000Z',
      },
    ];

    const totals = buildUserTokenTotals(usage);
    expect(totals.totalTokens).toBe(300);
    expect(totals.inputTokens).toBe(170);
    expect(totals.outputTokens).toBe(130);
  });

  it('returns per-day rows with session counts and usage totals', () => {
    const usage: UsageRecord[] = [
      {
        id: 'u-1',
        userId: 'user-1',
        period: 'daily',
        periodStart: '2026-02-04T00:00:00.000Z',
        tokensUsed: 80,
        promptTokens: 50,
        completionTokens: 30,
        updatedAt: '2026-02-04T23:00:00.000Z',
      },
    ];
    const sessions: SessionRecord[] = [
      {
        id: 's-1',
        userId: 'user-1',
        sessionId: 'alpha',
        startedAt: '2026-02-04T12:00:00.000Z',
        usage: { total_tokens: 100 },
        createdAt: '2026-02-04T12:10:00.000Z',
      },
      {
        id: 's-2',
        userId: 'user-1',
        sessionId: 'beta',
        startedAt: '2026-02-05T12:00:00.000Z',
        usage: {
          promptTokens: 25,
          completionTokens: 15,
        },
        createdAt: '2026-02-05T12:10:00.000Z',
      },
    ];

    const rows = buildDailyUserMetrics(usage, sessions);
    expect(rows).toHaveLength(2);

    expect(rows[0]).toMatchObject({
      date: '2026-02-05',
      sessionCount: 1,
      totalTokens: 40,
      inputTokens: 25,
      outputTokens: 15,
    });
    expect(rows[1]).toMatchObject({
      date: '2026-02-04',
      sessionCount: 1,
      totalTokens: 80,
      inputTokens: 50,
      outputTokens: 30,
    });
  });
});
