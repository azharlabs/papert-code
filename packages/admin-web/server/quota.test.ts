import { describe, it, expect } from 'vitest';
import { getPeriodStart, computeQuotaStatus } from './quota.js';
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
});
