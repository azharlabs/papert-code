import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { readAdminServerEnv } from './env.js';
import { getDb } from './db.js';
import { AdminRepo } from './repo.js';
import {
  GroupSchema,
  LoginSchema,
  QuotaRequestSchema,
  SessionUploadSchema,
  UsageReportSchema,
  UserCreateSchema,
  UserUpdateSchema,
} from './validation.js';
import {
  getJwtSecret,
  hashPassword,
  issueToken,
  verifyPassword,
  verifyToken,
} from './auth.js';
import { computeQuotaStatus, applyUsage, getPeriodStart } from './quota.js';

const env = readAdminServerEnv();
const db = getDb({ path: env.storePath });
const repo = new AdminRepo(db);

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

if (env.allowlist.size === 0) {
  console.warn(
    '[admin-web] PAPERT_ADMIN_ALLOWLIST is empty. Admin endpoints are currently open.',
  );
}
if (!process.env['PAPERT_ADMIN_JWT_SECRET']) {
  console.warn(
    '[admin-web] PAPERT_ADMIN_JWT_SECRET is not set. Using a dev-only default.',
  );
}
if (!process.env['PAPERT_ADMIN_ENC_KEY']) {
  console.warn(
    '[admin-web] PAPERT_ADMIN_ENC_KEY is not set. Using a dev-only encryption key.',
  );
}

const DEFAULT_GROUP_NAME = 'Default';

function ensureDefaultGroup(): { id: string } | null {
  const existing = repo.getGroupByName(DEFAULT_GROUP_NAME);
  if (existing) return existing;
  const groups = repo.listGroups();
  if (groups.length > 0) {
    return null;
  }
  return repo.createGroup({
    name: DEFAULT_GROUP_NAME,
    controls: {},
    provider: {},
    quotaMonthly: null,
    quotaDaily: null,
  });
}

async function ensureBootstrapAdmin(): Promise<void> {
  const bootstrapEmail = process.env['PAPERT_ADMIN_BOOTSTRAP_EMAIL'];
  const bootstrapPassword = process.env['PAPERT_ADMIN_BOOTSTRAP_PASSWORD'];
  if (!bootstrapEmail || !bootstrapPassword) return;

  const existing = repo.listUsers();
  if (existing.length > 0) return;

  const defaultGroup = ensureDefaultGroup();
  const passwordHash = await hashPassword(bootstrapPassword);
  repo.createUser({
    email: bootstrapEmail,
    passwordHash,
    role: 'admin',
    groupId: defaultGroup?.id ?? null,
    selfManaged: false,
    provider: {},
    controls: {},
    active: true,
  });
  console.log('[admin-web] Bootstrapped admin user.');
}

function ensureDefaultGroupAssignment(): void {
  const defaultGroup = repo.getGroupByName(DEFAULT_GROUP_NAME);
  if (!defaultGroup) return;
  const users = repo.listUsers();
  if (users.length !== 1) return;
  const user = users[0];
  if (user.role !== 'admin' || user.groupId) return;
  repo.updateUser(user.id, { groupId: defaultGroup.id });
}

function readAdminHeader(req: express.Request): string | undefined {
  return req.header(env.adminHeader) || undefined;
}

function requireAllowlist(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  if (env.allowlist.size === 0) {
    return next();
  }
  const auth = (req as any).auth as { email?: string } | undefined;
  const adminId = readAdminHeader(req) || auth?.email;
  if (!adminId || !env.allowlist.has(adminId)) {
    return res.status(403).json({
      error: 'admin_forbidden',
      message: 'Admin access denied.',
    });
  }
  return next();
}

function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const auth = req.header('authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'missing_token',
      message: 'Authorization token required.',
    });
  }
  try {
    const token = auth.slice('Bearer '.length);
    const payload = verifyToken(token);
    (req as any).auth = payload;
    return next();
  } catch {
    return res.status(401).json({
      error: 'invalid_token',
      message: 'Invalid or expired token.',
    });
  }
}

function requireAdminRole(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const auth = (req as any).auth as { role: string } | undefined;
  if (!auth || auth.role !== 'admin') {
    return res.status(403).json({
      error: 'admin_only',
      message: 'Admin role required.',
    });
  }
  return next();
}

function mergeControls(...controls: Array<Record<string, any>>): Record<string, any> {
  return controls.reduce((acc, control) => {
    return {
      ...acc,
      ...control,
      mcpSetting: {
        ...(acc.mcpSetting || {}),
        ...(control.mcpSetting || {}),
      },
      cliFeatureSetting: {
        ...(acc.cliFeatureSetting || {}),
        ...(control.cliFeatureSetting || {}),
        extensionsSetting: {
          ...(acc.cliFeatureSetting?.extensionsSetting || {}),
          ...(control.cliFeatureSetting?.extensionsSetting || {}),
        },
      },
    };
  }, {} as Record<string, any>);
}

function resolveUserControls(userId: string) {
  const user = repo.getUserById(userId) || repo.getUserByEmail(userId);
  if (!user) return null;
  const group = user.groupId ? repo.getGroup(user.groupId) : null;
  if (user.selfManaged) {
    const quota = computeQuotaStatus(repo, user, group);
    return {
      controls: {
        mcpSetting: { mcpEnabled: true },
        cliFeatureSetting: {
          extensionsSetting: { extensionsEnabled: true },
          unmanagedCapabilitiesEnabled: true,
        },
      },
      user,
      group,
      provider: user.provider,
      quota: {
        ...quota,
        exceeded: false,
        monthlyLimit: null,
        dailyLimit: null,
      },
    };
  }
  const controls = mergeControls(group?.controls ?? {}, user.controls ?? {});
  const provider = {
    ...(group?.provider ?? {}),
    ...(user.provider ?? {}),
  };
  const quota = computeQuotaStatus(repo, user, group);
  return { controls, user, group, provider, quota };
}

app.get('/api/v1/admin/health', (_req, res) => {
  res.json({ status: 'ok', version: 'v1', jwt: Boolean(getJwtSecret()) });
});

app.post('/api/v1/auth/login', async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'invalid_body',
      details: parsed.error.flatten(),
    });
  }

  const user = repo.getUserByEmail(parsed.data.email);
  if (!user || !user.active) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }

  const resolved = resolveUserControls(user.id);
  if (!resolved) {
    return res.status(403).json({ error: 'user_not_found' });
  }

  const token = issueToken(user);
  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      groupId: user.groupId,
      selfManaged: user.selfManaged,
      provider: resolved.provider,
    },
    controls: resolved.controls,
    quota: resolved.quota,
    access: resolved.quota.exceeded && !user.selfManaged ? 'denied' : 'granted',
  });
});

app.get('/api/v1/admin-controls', async (req, res) => {
  const userId =
    (req.header('x-user-id') ||
      (typeof req.query.userId === 'string' ? req.query.userId : undefined))?.trim();
  if (!userId) {
    return res.status(400).json({
      error: 'missing_user_id',
      message: 'Provide userId query param or x-user-id header.',
    });
  }

  const resolved = resolveUserControls(userId);
  if (!resolved) {
    return res.status(404).json({ error: 'user_not_found' });
  }

  return res.json(resolved.controls);
});

app.get('/api/v1/user/config', requireAuth, (req, res) => {
  const auth = (req as any).auth as { userId: string };
  const resolved = resolveUserControls(auth.userId);
  if (!resolved) {
    return res.status(404).json({ error: 'user_not_found' });
  }

  if (!resolved.user.selfManaged && resolved.quota.exceeded) {
    return res.status(429).json({
      error: 'quota_exceeded',
      message: 'Token quota exceeded. Request a quota increase from admin.',
      quota: resolved.quota,
    });
  }

  return res.json({
    user: {
      id: resolved.user.id,
      email: resolved.user.email,
      role: resolved.user.role,
      groupId: resolved.user.groupId,
      selfManaged: resolved.user.selfManaged,
    },
    provider: resolved.provider,
    controls: resolved.controls,
    quota: resolved.quota,
  });
});

app.post('/api/v1/user/usage', requireAuth, (req, res) => {
  const parsed = UsageReportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
  }
  const auth = (req as any).auth as { userId: string };
  const user = repo.getUserById(auth.userId);
  if (!user) {
    return res.status(404).json({ error: 'user_not_found' });
  }

  applyUsage(repo, user, parsed.data.totalTokens);

  const resolved = resolveUserControls(user.id);
  return res.json({
    ok: true,
    quota: resolved?.quota,
  });
});

app.post('/api/v1/user/sessions', requireAuth, async (req, res) => {
  const parsed = SessionUploadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
  }
  const auth = (req as any).auth as { userId: string };
  const user = repo.getUserById(auth.userId);
  if (!user) {
    return res.status(404).json({ error: 'user_not_found' });
  }

  const sessionDir = path.resolve(process.cwd(), 'data', 'sessions', user.id);
  await fs.mkdir(sessionDir, { recursive: true });
  const filePath = path.join(sessionDir, `${parsed.data.sessionId}.jsonl`);
  await fs.writeFile(filePath, parsed.data.transcript, 'utf-8');

  const record = repo.createSession({
    userId: user.id,
    sessionId: parsed.data.sessionId,
    model: parsed.data.model ?? null,
    baseUrl: parsed.data.baseUrl ?? null,
    startedAt: parsed.data.startedAt ?? null,
    endedAt: parsed.data.endedAt ?? null,
    usage: parsed.data.usage ?? {},
    transcriptPath: filePath,
  });

  return res.json({ session: record });
});

app.post('/api/v1/user/quota-requests', requireAuth, (req, res) => {
  const parsed = QuotaRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
  }
  const auth = (req as any).auth as { userId: string };
  const request = repo.createQuotaRequest({
    userId: auth.userId,
    requestedMonthly: parsed.data.requestedMonthly,
    reason: parsed.data.reason,
  });
  return res.json({ request });
});

// Admin endpoints
app.get('/api/v1/admin/users', requireAuth, requireAllowlist, requireAdminRole, (_req, res) => {
  res.json({ users: repo.listUsers() });
});

app.post('/api/v1/admin/users', requireAuth, requireAllowlist, requireAdminRole, async (req, res) => {
  const parsed = UserCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const user = repo.createUser({
    email: parsed.data.email,
    passwordHash,
    role: parsed.data.role,
    groupId: parsed.data.groupId,
    selfManaged: parsed.data.selfManaged,
    provider: parsed.data.provider,
    controls: parsed.data.controls,
    active: parsed.data.active,
  });

  res.json({ user });
});

app.put('/api/v1/admin/users/:id', requireAuth, requireAllowlist, requireAdminRole, async (req, res) => {
  const parsed = UserUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
  }
  const existing = repo.getUserById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'user_not_found' });
  }

  const passwordHash = parsed.data.password
    ? await hashPassword(parsed.data.password)
    : existing.passwordHash;

  const updated = repo.updateUser(req.params.id, {
    email: parsed.data.email ?? existing.email,
    passwordHash,
    role: parsed.data.role ?? existing.role,
    groupId: parsed.data.groupId ?? existing.groupId,
    selfManaged: parsed.data.selfManaged ?? existing.selfManaged,
    provider: parsed.data.provider ?? existing.provider,
    controls: parsed.data.controls ?? existing.controls,
    active: parsed.data.active ?? existing.active,
  });

  res.json({ user: updated });
});

app.delete('/api/v1/admin/users/:id', requireAuth, requireAllowlist, requireAdminRole, (req, res) => {
  const removed = repo.deleteUser(req.params.id);
  res.json({ removed });
});

app.get('/api/v1/admin/groups', requireAuth, requireAllowlist, requireAdminRole, (_req, res) => {
  res.json({ groups: repo.listGroups() });
});

app.post('/api/v1/admin/groups', requireAuth, requireAllowlist, requireAdminRole, (req, res) => {
  const parsed = GroupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
  }
  const group = repo.createGroup({
    name: parsed.data.name,
    controls: parsed.data.controls,
    provider: parsed.data.provider,
    quotaMonthly: parsed.data.quotaMonthly ?? null,
    quotaDaily: parsed.data.quotaDaily ?? null,
  });
  res.json({ group });
});

app.put('/api/v1/admin/groups/:id', requireAuth, requireAllowlist, requireAdminRole, (req, res) => {
  const parsed = GroupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
  }
  const updated = repo.updateGroup(req.params.id, {
    name: parsed.data.name,
    controls: parsed.data.controls,
    provider: parsed.data.provider,
    quotaMonthly: parsed.data.quotaMonthly ?? null,
    quotaDaily: parsed.data.quotaDaily ?? null,
  });
  res.json({ group: updated });
});

app.delete('/api/v1/admin/groups/:id', requireAuth, requireAllowlist, requireAdminRole, (req, res) => {
  const removed = repo.deleteGroup(req.params.id);
  res.json({ removed });
});

app.get('/api/v1/admin/usage/:userId', requireAuth, requireAllowlist, requireAdminRole, (req, res) => {
  const usage = repo.listUsage(req.params.userId);
  const monthlyStart = getPeriodStart('monthly');
  const dailyStart = getPeriodStart('daily');
  res.json({
    usage,
    current: {
      monthly: repo.getUsage(req.params.userId, 'monthly', monthlyStart),
      daily: repo.getUsage(req.params.userId, 'daily', dailyStart),
    },
  });
});

app.get('/api/v1/admin/quota-requests', requireAuth, requireAllowlist, requireAdminRole, (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  res.json({ requests: repo.listQuotaRequests(status) });
});

app.post('/api/v1/admin/quota-requests/:id/approve', requireAuth, requireAllowlist, requireAdminRole, (req, res) => {
  const updated = repo.updateQuotaRequest(req.params.id, 'approved');
  res.json({ request: updated });
});

app.post('/api/v1/admin/quota-requests/:id/reject', requireAuth, requireAllowlist, requireAdminRole, (req, res) => {
  const updated = repo.updateQuotaRequest(req.params.id, 'rejected');
  res.json({ request: updated });
});

app.get('/api/v1/admin/sessions', requireAuth, requireAllowlist, requireAdminRole, (req, res) => {
  const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
  res.json({ sessions: repo.listSessions(userId) });
});

app.get('/api/v1/admin/sessions/:id', requireAuth, requireAllowlist, requireAdminRole, async (req, res) => {
  const session = repo.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'session_not_found' });
  }
  let transcript: string | undefined;
  if (session.transcriptPath) {
    try {
      transcript = await fs.readFile(session.transcriptPath, 'utf-8');
    } catch {
      transcript = undefined;
    }
  }
  res.json({ session, transcript });
});

ensureBootstrapAdmin()
  .then(() => {
    ensureDefaultGroup();
    ensureDefaultGroupAssignment();
    app.listen(env.port, () => {
      console.log(`[admin-web] Admin server listening on :${env.port}`);
    });
  })
  .catch((error) => {
    console.error('[admin-web] Failed to bootstrap admin user:', error);
    process.exit(1);
  });
