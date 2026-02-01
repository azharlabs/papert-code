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
    expect(fetchedUser?.groupId).toBe(group.id);
    expect(fetchedUser?.provider.apiKey).toBe('secret');

    const fetchedGroup = repo.getGroup(group.id);
    expect(fetchedGroup?.quotaMonthly).toBe(1000);
  });
});
