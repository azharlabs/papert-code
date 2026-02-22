import { describe, it, expect } from 'vitest';
import { getPeriodStart, computeQuotaStatus, applyUsage } from './quota.js';
import { AdminRepo } from './repo.js';
import { getDb } from './db.js';
import * as path from 'node:path';
import * as os from 'node:os';
import { randomUUID } from 'node:crypto';

function createRepo() {
  const dbPath = path.join(os.tmpdir(), `papert-admin-${randomUUID()}.sqlite`);
  const db = getDb({ path: dbPath });
  return new AdminRepo(db);
}

describe('quota helpers', () => {
  it('computes period starts', () => {
    const daily = getPeriodStart('daily', new Date(Date.UTC(2026, 1, 1)));
    const monthly = getPeriodStart('monthly', new Date(Date.UTC(2026, 1, 15)));
    expect(daily).toContain('2026-02-01');
    expect(monthly).toContain('2026-02-01');
  });

  it('computes quota exceeded when usage over limit', async () => {
    const repo = createRepo();
    const now = new Date(Date.UTC(2026, 1, 1));
    const group = repo.createGroup({
      name: 'Test',
      controls: {},
      provider: {},
      quotaMonthly: 100,
      quotaDaily: 50,
    });
    const user = repo.createUser({
      email: 'dev@company.com',
      passwordHash: 'hash',
      role: 'user',
      groupId: group.id,
      controls: {},
      provider: {},
    });
    repo.upsertUsage(user.id, 'monthly', getPeriodStart('monthly', now), 150);
    repo.upsertUsage(user.id, 'daily', getPeriodStart('daily', now), 10);

    const status = computeQuotaStatus(repo, user, group, now);
    expect(status.exceeded).toBe(true);
    expect(status.monthlyUsed).toBe(150);
    expect(status.dailyUsed).toBe(10);
  });

  it('stores input/output token totals when applying usage', () => {
    const repo = createRepo();
    const now = new Date(Date.UTC(2026, 1, 2));
    const group = repo.createGroup({
      name: 'Metrics',
      controls: {},
      provider: {},
    });
    const user = repo.createUser({
      email: 'metrics@company.com',
      passwordHash: 'hash',
      role: 'user',
      groupId: group.id,
      controls: {},
      provider: {},
    });

    applyUsage(repo, user, 120, 70, 50, now);

    const monthly = repo.getUsage(user.id, 'monthly', getPeriodStart('monthly', now));
    const daily = repo.getUsage(user.id, 'daily', getPeriodStart('daily', now));

    expect(monthly?.tokensUsed).toBe(120);
    expect(monthly?.promptTokens).toBe(70);
    expect(monthly?.completionTokens).toBe(50);
    expect(daily?.tokensUsed).toBe(120);
    expect(daily?.promptTokens).toBe(70);
    expect(daily?.completionTokens).toBe(50);
  });
});
