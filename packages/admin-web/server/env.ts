import * as path from 'node:path';

export interface AdminServerEnv {
  port: number;
  storePath: string;
  allowlist: Set<string>;
  adminHeader: string;
  corsOrigins: Set<string>;
}

function parseCsvSet(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

export function readAdminServerEnv(): AdminServerEnv {
  const port = Number(process.env['PAPERT_ADMIN_PORT'] || '4180');
  const storePath =
    process.env['PAPERT_ADMIN_STORE_PATH'] ||
    path.resolve(process.cwd(), 'data', 'admin-controls.sqlite');
  const allowlist = parseCsvSet(
    process.env['PAPERT_ADMIN_ALLOWLIST'] ||
      process.env['PAPERT_ADMIN_USER_IDS'],
  );
  const adminHeader =
    process.env['PAPERT_ADMIN_HEADER'] || 'x-admin-user-id';
  const corsOrigins = parseCsvSet(process.env['PAPERT_ADMIN_CORS_ORIGINS']);

  return {
    port: Number.isFinite(port) ? port : 4180,
    storePath,
    allowlist,
    adminHeader,
    corsOrigins,
  };
}
