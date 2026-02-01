import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { AdminControls } from './types.js';
import { decryptSecret, encryptSecret } from './crypto.js';

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  models?: string[];
}

export interface GroupRecord {
  id: string;
  name: string;
  controls: AdminControls;
  provider: ProviderConfig;
  quotaMonthly?: number | null;
  quotaDaily?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'user';
  groupId?: string | null;
  selfManaged: boolean;
  provider: ProviderConfig;
  controls: AdminControls;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UsageRecord {
  id: string;
  userId: string;
  period: 'daily' | 'monthly';
  periodStart: string;
  tokensUsed: number;
  updatedAt: string;
}

export interface SessionRecord {
  id: string;
  userId: string;
  sessionId: string;
  model?: string | null;
  baseUrl?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  usage: Record<string, unknown>;
  transcriptPath?: string | null;
  createdAt: string;
}

export interface QuotaRequestRecord {
  id: string;
  userId: string;
  requestedMonthly?: number | null;
  reason?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

function encodeJson(value: unknown): string {
  return JSON.stringify(value ?? {});
}

function decodeJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

export class AdminRepo {
  constructor(private readonly db: Database.Database) {}

  createGroup(data: {
    name: string;
    controls?: AdminControls;
    provider?: ProviderConfig;
    quotaMonthly?: number | null;
    quotaDaily?: number | null;
  }): GroupRecord {
    const id = randomUUID();
    const timestamp = nowIso();
    this.db
      .prepare(
        `INSERT INTO groups (id, name, controls_json, provider_json, quota_monthly, quota_daily, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        data.name,
        encodeJson(data.controls ?? {}),
        encodeJson(data.provider ?? {}),
        data.quotaMonthly ?? null,
        data.quotaDaily ?? null,
        timestamp,
        timestamp,
      );
    return this.getGroup(id)!;
  }

  listGroups(): GroupRecord[] {
    const rows = this.db.prepare(`SELECT * FROM groups ORDER BY name`).all();
    return rows.map((row) => this.mapGroup(row));
  }

  getGroupByName(name: string): GroupRecord | null {
    const row = this.db
      .prepare(`SELECT * FROM groups WHERE name = ? LIMIT 1`)
      .get(name);
    return row ? this.mapGroup(row) : null;
  }

  getGroup(id: string): GroupRecord | null {
    const row = this.db.prepare(`SELECT * FROM groups WHERE id = ?`).get(id);
    return row ? this.mapGroup(row) : null;
  }

  updateGroup(id: string, data: Partial<GroupRecord>): GroupRecord | null {
    const existing = this.getGroup(id);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...data,
      controls: data.controls ?? existing.controls,
      provider: data.provider ?? existing.provider,
      quotaMonthly:
        data.quotaMonthly !== undefined ? data.quotaMonthly : existing.quotaMonthly,
      quotaDaily:
        data.quotaDaily !== undefined ? data.quotaDaily : existing.quotaDaily,
      updatedAt: nowIso(),
    };
    this.db
      .prepare(
        `UPDATE groups SET name = ?, controls_json = ?, provider_json = ?, quota_monthly = ?, quota_daily = ?, updated_at = ? WHERE id = ?`
      )
      .run(
        updated.name,
        encodeJson(updated.controls),
        encodeJson(updated.provider),
        updated.quotaMonthly ?? null,
        updated.quotaDaily ?? null,
        updated.updatedAt,
        id,
      );
    return this.getGroup(id);
  }

  deleteGroup(id: string): boolean {
    const result = this.db.prepare(`DELETE FROM groups WHERE id = ?`).run(id);
    return result.changes > 0;
  }

  createUser(data: {
    email: string;
    passwordHash: string;
    role: 'admin' | 'user';
    groupId?: string | null;
    selfManaged?: boolean;
    provider?: ProviderConfig;
    controls?: AdminControls;
    active?: boolean;
  }): UserRecord {
    const id = randomUUID();
    const timestamp = nowIso();
    const provider = data.provider ?? {};
    const storedProvider = {
      ...provider,
      apiKey: provider.apiKey ? encryptSecret(provider.apiKey) : undefined,
    };
    this.db
      .prepare(
        `INSERT INTO users (id, email, password_hash, role, group_id, self_managed, provider_json, controls_json, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        data.email,
        data.passwordHash,
        data.role,
        data.groupId ?? null,
        data.selfManaged ? 1 : 0,
        encodeJson(storedProvider),
        encodeJson(data.controls ?? {}),
        data.active === false ? 0 : 1,
        timestamp,
        timestamp,
      );
    return this.getUserById(id)!;
  }

  listUsers(): UserRecord[] {
    const rows = this.db.prepare(`SELECT * FROM users ORDER BY email`).all();
    return rows.map((row) => this.mapUser(row));
  }

  getUserByEmail(email: string): UserRecord | null {
    const row = this.db.prepare(`SELECT * FROM users WHERE email = ?`).get(email);
    return row ? this.mapUser(row) : null;
  }

  getUserById(id: string): UserRecord | null {
    const row = this.db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
    return row ? this.mapUser(row) : null;
  }

  updateUser(id: string, data: Partial<UserRecord>): UserRecord | null {
    const existing = this.getUserById(id);
    if (!existing) return null;

    const provider = data.provider ?? existing.provider;
    const storedProvider = {
      ...provider,
      apiKey: provider.apiKey ? encryptSecret(provider.apiKey) : undefined,
    };

    const updated = {
      ...existing,
      ...data,
      provider,
      controls: data.controls ?? existing.controls,
      updatedAt: nowIso(),
    };

    this.db
      .prepare(
        `UPDATE users SET email = ?, password_hash = ?, role = ?, group_id = ?, self_managed = ?, provider_json = ?, controls_json = ?, active = ?, updated_at = ? WHERE id = ?`
      )
      .run(
        updated.email,
        updated.passwordHash,
        updated.role,
        updated.groupId ?? null,
        updated.selfManaged ? 1 : 0,
        encodeJson(storedProvider),
        encodeJson(updated.controls),
        updated.active ? 1 : 0,
        updated.updatedAt,
        id,
      );

    return this.getUserById(id);
  }

  deleteUser(id: string): boolean {
    const result = this.db.prepare(`DELETE FROM users WHERE id = ?`).run(id);
    return result.changes > 0;
  }

  upsertUsage(userId: string, period: 'daily' | 'monthly', periodStart: string, tokens: number): UsageRecord {
    const existing = this.db
      .prepare(`SELECT * FROM usage WHERE user_id = ? AND period = ? AND period_start = ?`)
      .get(userId, period, periodStart) as UsageRecord | undefined;

    const timestamp = nowIso();
    if (existing) {
      const updatedTokens = existing.tokensUsed + tokens;
      this.db
        .prepare(`UPDATE usage SET tokens_used = ?, updated_at = ? WHERE id = ?`)
        .run(updatedTokens, timestamp, existing.id);
      return {
        ...existing,
        tokensUsed: updatedTokens,
        updatedAt: timestamp,
      };
    }

    const id = randomUUID();
    this.db
      .prepare(`INSERT INTO usage (id, user_id, period, period_start, tokens_used, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(id, userId, period, periodStart, tokens, timestamp);

    return {
      id,
      userId,
      period,
      periodStart,
      tokensUsed: tokens,
      updatedAt: timestamp,
    };
  }

  getUsage(userId: string, period: 'daily' | 'monthly', periodStart: string): UsageRecord | null {
    const row = this.db
      .prepare(`SELECT * FROM usage WHERE user_id = ? AND period = ? AND period_start = ?`)
      .get(userId, period, periodStart);
    return row ? this.mapUsage(row) : null;
  }

  listUsage(userId: string): UsageRecord[] {
    const rows = this.db.prepare(`SELECT * FROM usage WHERE user_id = ? ORDER BY period_start DESC`).all(userId);
    return rows.map((row) => this.mapUsage(row));
  }

  createSession(record: Omit<SessionRecord, 'id' | 'createdAt'>): SessionRecord {
    const id = randomUUID();
    const createdAt = nowIso();
    this.db
      .prepare(
        `INSERT INTO sessions (id, user_id, session_id, model, base_url, started_at, ended_at, usage_json, transcript_path, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        record.userId,
        record.sessionId,
        record.model ?? null,
        record.baseUrl ?? null,
        record.startedAt ?? null,
        record.endedAt ?? null,
        encodeJson(record.usage ?? {}),
        record.transcriptPath ?? null,
        createdAt,
      );
    return {
      ...record,
      id,
      createdAt,
    };
  }

  listSessions(userId?: string): SessionRecord[] {
    const rows = userId
      ? this.db.prepare(`SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC`).all(userId)
      : this.db.prepare(`SELECT * FROM sessions ORDER BY created_at DESC`).all();
    return rows.map((row) => this.mapSession(row));
  }

  getSession(id: string): SessionRecord | null {
    const row = this.db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id);
    return row ? this.mapSession(row) : null;
  }

  createQuotaRequest(data: {
    userId: string;
    requestedMonthly?: number | null;
    reason?: string | null;
  }): QuotaRequestRecord {
    const id = randomUUID();
    const timestamp = nowIso();
    this.db
      .prepare(
        `INSERT INTO quota_requests (id, user_id, requested_monthly, reason, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        data.userId,
        data.requestedMonthly ?? null,
        data.reason ?? null,
        'pending',
        timestamp,
        timestamp,
      );
    return {
      id,
      userId: data.userId,
      requestedMonthly: data.requestedMonthly ?? null,
      reason: data.reason ?? null,
      status: 'pending',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  listQuotaRequests(status?: string): QuotaRequestRecord[] {
    const rows = status
      ? this.db.prepare(`SELECT * FROM quota_requests WHERE status = ? ORDER BY created_at DESC`).all(status)
      : this.db.prepare(`SELECT * FROM quota_requests ORDER BY created_at DESC`).all();
    return rows as QuotaRequestRecord[];
  }

  updateQuotaRequest(id: string, status: 'approved' | 'rejected'): QuotaRequestRecord | null {
    const existing = this.db.prepare(`SELECT * FROM quota_requests WHERE id = ?`).get(id) as QuotaRequestRecord | undefined;
    if (!existing) return null;
    const updatedAt = nowIso();
    this.db
      .prepare(`UPDATE quota_requests SET status = ?, updated_at = ? WHERE id = ?`)
      .run(status, updatedAt, id);
    return { ...existing, status, updatedAt };
  }

  private mapGroup(row: any): GroupRecord {
    return {
      id: row.id,
      name: row.name,
      controls: decodeJson(row.controls_json, {}),
      provider: decodeJson(row.provider_json, {}),
      quotaMonthly: row.quota_monthly,
      quotaDaily: row.quota_daily,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapUser(row: any): UserRecord {
    const provider = decodeJson(row.provider_json, {});
    if (provider.apiKey) {
      try {
        provider.apiKey = decryptSecret(provider.apiKey);
      } catch {
        provider.apiKey = '';
      }
    }
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role,
      groupId: row.group_id,
      selfManaged: Boolean(row.self_managed),
      provider,
      controls: decodeJson(row.controls_json, {}),
      active: Boolean(row.active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapSession(row: any): SessionRecord {
    return {
      id: row.id,
      userId: row.user_id,
      sessionId: row.session_id,
      model: row.model,
      baseUrl: row.base_url,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      usage: decodeJson(row.usage_json, {}),
      transcriptPath: row.transcript_path,
      createdAt: row.created_at,
    };
  }

  private mapUsage(row: any): UsageRecord {
    return {
      id: row.id,
      userId: row.user_id,
      period: row.period,
      periodStart: row.period_start,
      tokensUsed: row.tokens_used,
      updatedAt: row.updated_at,
    };
  }
}
