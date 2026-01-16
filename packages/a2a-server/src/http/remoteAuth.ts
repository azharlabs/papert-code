/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export type RemoteAuthConfig = {
  enabled: boolean;
  /**
   * If set, sessions must present this token to create a session.
   * This is intended for local/LAN usage.
   */
  serverToken?: string;
  /**
   * Default session lease duration.
   */
  sessionTtlMs: number;
};

export type RemoteSession = {
  id: string;
  tokenHash: string;
  createdAtMs: number;
  lastSeenAtMs: number;
  expiresAtMs: number;
  workspaceRoot: string;
};

export type CreateSessionResult = {
  session: RemoteSession;
  /** Plain token returned once to the client. */
  token: string;
};

export class RemoteSessionStore {
  private sessions = new Map<string, RemoteSession>();
  private workspaceLocks = new Map<string, string>();

  constructor(private readonly config: RemoteAuthConfig) {}

  createSession(workspaceRoot: string): CreateSessionResult {
    const id = randomBytes(16).toString('hex');
    const token = randomBytes(32).toString('hex');
    const now = Date.now();

    const tokenHash = sha256(token);

    const session: RemoteSession = {
      id,
      tokenHash,
      createdAtMs: now,
      lastSeenAtMs: now,
      expiresAtMs: now + this.config.sessionTtlMs,
      workspaceRoot,
    };

    this.sessions.set(id, session);
    return { session, token };
  }

  getSession(sessionId: string): RemoteSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    if (Date.now() > session.expiresAtMs) {
      this.releaseSession(sessionId);
      return undefined;
    }
    return session;
  }

  touchSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    const now = Date.now();
    session.lastSeenAtMs = now;
    session.expiresAtMs = now + this.config.sessionTtlMs;
  }

  releaseSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      const lockOwner = this.workspaceLocks.get(session.workspaceRoot);
      if (lockOwner === sessionId) {
        this.workspaceLocks.delete(session.workspaceRoot);
      }
    }
    this.sessions.delete(sessionId);
  }

  acquireWorkspaceLock(sessionId: string, workspaceRoot: string): boolean {
    this.cleanupExpired();
    const currentOwner = this.workspaceLocks.get(workspaceRoot);
    if (currentOwner && currentOwner !== sessionId) {
      return false;
    }
    this.workspaceLocks.set(workspaceRoot, sessionId);
    return true;
  }

  hasWorkspaceLock(sessionId: string, workspaceRoot: string): boolean {
    this.cleanupExpired();
    return this.workspaceLocks.get(workspaceRoot) === sessionId;
  }

  validateSessionToken(sessionId: string, token: string): boolean {
    const session = this.getSession(sessionId);
    if (!session) return false;

    const providedHash = sha256(token);
    return safeEqualHex(session.tokenHash, providedHash);
  }

  cleanupExpired(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now > session.expiresAtMs) {
        this.releaseSession(id);
      }
    }
  }
}

export function parseBearerToken(
  headerValue: string | undefined,
): string | undefined {
  if (!headerValue) return undefined;
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'hex');
  const bBuf = Buffer.from(b, 'hex');
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}
