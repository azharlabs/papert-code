import type { AdminRepo, GroupRecord, UsageRecord, UserRecord } from './repo.js';

export interface QuotaStatus {
  monthlyLimit?: number | null;
  monthlyUsed: number;
  dailyLimit?: number | null;
  dailyUsed: number;
  exceeded: boolean;
}

export function getPeriodStart(period: 'daily' | 'monthly', now = new Date()): string {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (period === 'monthly') {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  }
  return date.toISOString();
}

export function resolveQuotaLimits(group: GroupRecord | null, user: UserRecord): {
  monthlyLimit?: number | null;
  dailyLimit?: number | null;
} {
  const monthlyLimit = group?.quotaMonthly ?? null;
  const dailyLimit = group?.quotaDaily ?? null;
  return { monthlyLimit, dailyLimit };
}

export function computeQuotaStatus(
  repo: AdminRepo,
  user: UserRecord,
  group: GroupRecord | null,
  now: Date = new Date(),
): QuotaStatus {
  const { monthlyLimit, dailyLimit } = resolveQuotaLimits(group, user);
  const monthlyStart = getPeriodStart('monthly', now);
  const dailyStart = getPeriodStart('daily', now);

  const monthlyUsage = repo.getUsage(user.id, 'monthly', monthlyStart);
  const dailyUsage = repo.getUsage(user.id, 'daily', dailyStart);

  const monthlyUsed = monthlyUsage?.tokensUsed ?? 0;
  const dailyUsed = dailyUsage?.tokensUsed ?? 0;

  const exceeded =
    (monthlyLimit !== null && monthlyLimit !== undefined && monthlyUsed >= monthlyLimit) ||
    (dailyLimit !== null && dailyLimit !== undefined && dailyUsed >= dailyLimit);

  return {
    monthlyLimit,
    monthlyUsed,
    dailyLimit,
    dailyUsed,
    exceeded,
  };
}

export function applyUsage(
  repo: AdminRepo,
  user: UserRecord,
  tokens: number,
  now: Date = new Date(),
): { monthly: UsageRecord; daily: UsageRecord } {
  const monthlyStart = getPeriodStart('monthly', now);
  const dailyStart = getPeriodStart('daily', now);
  const monthly = repo.upsertUsage(user.id, 'monthly', monthlyStart, tokens);
  const daily = repo.upsertUsage(user.id, 'daily', dailyStart, tokens);
  return { monthly, daily };
}
