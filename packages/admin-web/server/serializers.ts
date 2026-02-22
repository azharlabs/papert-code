import type { UserRecord } from './repo.js';

export type PublicUserRecord = Omit<UserRecord, 'passwordHash'>;

export function toPublicUser(user: UserRecord): PublicUserRecord {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}
