import { describe, it, expect } from 'vitest';
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

describe('AdminRepo', () => {
  it('creates and fetches users and groups', () => {
    const repo = createRepo();
    const group = repo.createGroup({
      name: 'Engineering',
      controls: { mcpSetting: { mcpEnabled: true } },
      provider: { baseUrl: 'https://api.example.com' },
      quotaMonthly: 1000,
      quotaDaily: 100,
    });
    const user = repo.createUser({
      email: 'user@company.com',
      passwordHash: 'hash',
      role: 'user',
      groupId: group.id,
      provider: { apiKey: 'secret' },
      controls: { cliFeatureSetting: { unmanagedCapabilitiesEnabled: true } },
    });

    const fetchedUser = repo.getUserByEmail('user@company.com');
    expect(fetchedUser?.id).toBe(user.id);
    expect(fetchedUser?.groupId).toBe(group.id);
    expect(fetchedUser?.provider.apiKey).toBe('secret');

    const fetchedGroup = repo.getGroup(group.id);
    expect(fetchedGroup?.quotaMonthly).toBe(1000);
  });

  it('maps quota requests using API field casing', () => {
    const repo = createRepo();
    const group = repo.createGroup({
      name: 'Support',
      controls: {},
      provider: {},
    });
    const user = repo.createUser({
      email: 'quota@company.com',
      passwordHash: 'hash',
      role: 'user',
      groupId: group.id,
      controls: {},
      provider: {},
    });

    const created = repo.createQuotaRequest({
      userId: user.id,
      requestedMonthly: 2000,
      reason: 'Need more room',
    });
    const listed = repo.listQuotaRequests();
    const updated = repo.updateQuotaRequest(created.id, 'approved');

    expect(listed).toHaveLength(1);
    expect(listed[0]?.userId).toBe(user.id);
    expect(listed[0]?.requestedMonthly).toBe(2000);
    expect((listed[0] as unknown as { user_id?: string }).user_id).toBeUndefined();

    expect(updated?.userId).toBe(user.id);
    expect(updated?.requestedMonthly).toBe(2000);
    expect(updated?.status).toBe('approved');
    expect(
      (updated as unknown as { requested_monthly?: number }).requested_monthly,
    ).toBeUndefined();
  });

  it('coalesces usage writes into one row per user/period bucket', () => {
    const repo = createRepo();
    const group = repo.createGroup({
      name: 'Data',
      controls: {},
      provider: {},
    });
    const user = repo.createUser({
      email: 'usage@company.com',
      passwordHash: 'hash',
      role: 'user',
      groupId: group.id,
      controls: {},
      provider: {},
    });

    const periodStart = '2026-02-01T00:00:00.000Z';
    repo.upsertUsage(user.id, 'monthly', periodStart, 40);
    const second = repo.upsertUsage(user.id, 'monthly', periodStart, 60);
    const usageRows = repo.listUsage(user.id).filter((row) => row.period === 'monthly');

    expect(usageRows).toHaveLength(1);
    expect(second.tokensUsed).toBe(100);
    expect(usageRows[0]?.tokensUsed).toBe(100);
  });
});
