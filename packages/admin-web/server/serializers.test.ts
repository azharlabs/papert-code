import { describe, expect, it } from 'vitest';
import type { UserRecord } from './repo.js';
import { toPublicUser } from './serializers.js';

describe('toPublicUser', () => {
  it('removes password hash from serialized user payload', () => {
    const user: UserRecord = {
      id: 'user-1',
      email: 'admin@company.com',
      passwordHash: 'hashed-value',
      role: 'admin',
      groupId: null,
      selfManaged: false,
      provider: {},
      controls: {},
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const serialized = toPublicUser(user);

    expect('passwordHash' in serialized).toBe(false);
    expect(serialized.email).toBe('admin@company.com');
    expect(serialized.role).toBe('admin');
  });
});
