import * as fs from 'node:fs';
import * as path from 'node:path';
import Database from 'better-sqlite3';

export interface DbConfig {
  path: string;
}

const dbInstances = new Map<string, Database.Database>();

export function getDb(config: DbConfig): Database.Database {
  const existing = dbInstances.get(config.path);
  if (existing) return existing;

  const dir = path.dirname(config.path);
  fs.mkdirSync(dir, { recursive: true });

  const db = new Database(config.path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  migrate(db);
  dbInstances.set(config.path, db);
  return db;
}

function migrate(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      controls_json TEXT NOT NULL,
      provider_json TEXT NOT NULL,
      quota_monthly INTEGER,
      quota_daily INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      group_id TEXT,
      self_managed INTEGER NOT NULL DEFAULT 0,
      provider_json TEXT NOT NULL,
      controls_json TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (group_id) REFERENCES groups(id)
    );

    CREATE TABLE IF NOT EXISTS usage (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      period TEXT NOT NULL,
      period_start TEXT NOT NULL,
      tokens_used INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      model TEXT,
      base_url TEXT,
      started_at TEXT,
      ended_at TEXT,
      usage_json TEXT NOT NULL,
      transcript_path TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS quota_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      requested_monthly INTEGER,
      reason TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
}
