import type { SessionRecord, UsageRecord } from '../types';

const TOTAL_TOKEN_KEYS = ['tokensUsed', 'totalTokens', 'total_tokens', 'totalTokenCount'];
const INPUT_TOKEN_KEYS = ['promptTokens', 'inputTokens', 'input_tokens', 'prompt_tokens'];
const OUTPUT_TOKEN_KEYS = [
  'completionTokens',
  'outputTokens',
  'output_tokens',
  'completion_tokens',
];

export interface SessionTokenSummary {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
}

export interface UserTokenTotals {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
}

export interface DailyUserMetric {
  date: string;
  sessionCount: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
}

function normalizeTokenCount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.round(parsed));
    }
  }
  return 0;
}

function pickTokenCount(
  usage: Record<string, unknown>,
  keys: readonly string[],
): number | null {
  for (const key of keys) {
    if (!(key in usage)) continue;
    return normalizeTokenCount(usage[key]);
  }
  return null;
}

function toDateKey(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function getSessionTokenSummary(
  usage?: Record<string, unknown> | null,
): SessionTokenSummary {
  if (!usage) {
    return {
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
    };
  }

  const inputTokens = pickTokenCount(usage, INPUT_TOKEN_KEYS) ?? 0;
  const outputTokens = pickTokenCount(usage, OUTPUT_TOKEN_KEYS) ?? 0;
  const directTotal = pickTokenCount(usage, TOTAL_TOKEN_KEYS);

  return {
    totalTokens: directTotal ?? inputTokens + outputTokens,
    inputTokens,
    outputTokens,
  };
}

export function buildUserTokenTotals(usageRecords: UsageRecord[]): UserTokenTotals {
  const monthly = usageRecords.filter((record) => record.period === 'monthly');
  const source = monthly.length > 0
    ? monthly
    : usageRecords.filter((record) => record.period === 'daily');

  return source.reduce<UserTokenTotals>(
    (totals, record) => {
      totals.totalTokens += normalizeTokenCount(record.tokensUsed);
      totals.inputTokens += normalizeTokenCount(record.promptTokens);
      totals.outputTokens += normalizeTokenCount(record.completionTokens);
      return totals;
    },
    { totalTokens: 0, inputTokens: 0, outputTokens: 0 },
  );
}

interface InternalDailyUserMetric extends DailyUserMetric {
  hasUsageReport: boolean;
}

export function buildDailyUserMetrics(
  usageRecords: UsageRecord[],
  sessions: SessionRecord[],
): DailyUserMetric[] {
  const rows = new Map<string, InternalDailyUserMetric>();

  const getOrCreateRow = (date: string): InternalDailyUserMetric => {
    const existing = rows.get(date);
    if (existing) return existing;
    const row: InternalDailyUserMetric = {
      date,
      sessionCount: 0,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      hasUsageReport: false,
    };
    rows.set(date, row);
    return row;
  };

  for (const record of usageRecords) {
    if (record.period !== 'daily') continue;
    const date = toDateKey(record.periodStart);
    if (!date) continue;
    const row = getOrCreateRow(date);
    row.totalTokens += normalizeTokenCount(record.tokensUsed);
    row.inputTokens += normalizeTokenCount(record.promptTokens);
    row.outputTokens += normalizeTokenCount(record.completionTokens);
    row.hasUsageReport = true;
  }

  for (const session of sessions) {
    const date = toDateKey(session.startedAt ?? session.createdAt ?? session.endedAt ?? null);
    if (!date) continue;
    const row = getOrCreateRow(date);
    row.sessionCount += 1;
    if (!row.hasUsageReport) {
      const tokens = getSessionTokenSummary(session.usage);
      row.totalTokens += tokens.totalTokens;
      row.inputTokens += tokens.inputTokens;
      row.outputTokens += tokens.outputTokens;
    }
  }

  return [...rows.values()]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((row) => ({
      date: row.date,
      sessionCount: row.sessionCount,
      totalTokens: row.totalTokens,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
    }));
}

export function formatDateKey(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return date.toLocaleDateString();
}
