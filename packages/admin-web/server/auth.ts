import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import type { UserRecord } from './repo.js';

const DEV_FALLBACK_SECRET = randomBytes(32).toString('hex');
const TOKEN_TTL_SECONDS = 60 * 60 * 12; // 12h

export function getJwtSecret(): string {
  return process.env['PAPERT_ADMIN_JWT_SECRET'] || DEV_FALLBACK_SECRET;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function issueToken(user: UserRecord): string {
  const payload = {
    sub: user.id,
    role: user.role,
    email: user.email,
  };
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: TOKEN_TTL_SECONDS,
  });
}

export function verifyToken(token: string): {
  userId: string;
  role: string;
  email?: string;
} {
  const decoded = jwt.verify(token, getJwtSecret()) as {
    sub: string;
    role: string;
    email?: string;
  };
  return {
    userId: decoded.sub,
    role: decoded.role,
    email: decoded.email,
  };
}
