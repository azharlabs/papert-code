import type { UserRecord } from './repo.js';

export type PublicUserRecord = Omit<UserRecord, 'passwordHash'>;

export function toPublicUser(user: UserRecord): PublicUserRecord {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    groupId: user.groupId,
    selfManaged: user.selfManaged,
    provider: user.provider,
    controls: user.controls,
    active: user.active,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
