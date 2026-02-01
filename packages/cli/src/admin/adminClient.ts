import { computeUsageFromMetrics } from '../utils/nonInteractiveHelpers.js';
import { uiTelemetryService, AuthType, type SessionMetrics } from '@papert-code/papert-code-core';
import type { Config } from '@papert-code/papert-code-core';
import path from 'node:path';
import fs from 'node:fs/promises';

export interface AdminSession {
  baseUrl: string;
  token: string;
  userId: string;
  email: string;
  selfManaged: boolean;
  provider: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  };
  controls: Record<string, unknown>;
  quota?: Record<string, unknown>;
}

export class AdminQuotaError extends Error {
  readonly quota?: Record<string, unknown>;
  readonly token?: string;
  readonly baseUrl?: string;
  constructor(
    message: string,
    options: { quota?: Record<string, unknown>; token?: string; baseUrl?: string } = {},
  ) {
    super(message);
    this.name = 'AdminQuotaError';
    this.quota = options.quota;
    this.token = options.token;
    this.baseUrl = options.baseUrl;
  }
}

function getAdminEnv(): {
  baseUrl?: string;
  email?: string;
  password?: string;
  token?: string;
} {
  const rawBase = process.env['PAPERT_ADMIN_URL'];
  const baseUrl = rawBase ? rawBase.replace(/\/$/, '') : undefined;
  return {
    baseUrl,
    email: process.env['PAPERT_ADMIN_EMAIL'],
    password: process.env['PAPERT_ADMIN_PASSWORD'],
    token: process.env['PAPERT_ADMIN_TOKEN'],
  };
}

async function requestJson<T>(
  baseUrl: string,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, options);
  const payload = await response.json().catch(() => undefined);
  if (!response.ok) {
    const message = payload?.message || payload?.error || response.statusText;
    const error = new Error(message || 'Request failed');
    (error as { payload?: unknown }).payload = payload;
    (error as { status?: number }).status = response.status;
    throw error;
  }
  return payload as T;
}

export async function resolveAdminSession(): Promise<AdminSession | null> {
  const { baseUrl, email, password, token } = getAdminEnv();
  if (!baseUrl) return null;

  let authToken = token;
  let loginResponse: any;

  if (!authToken && email && password) {
    loginResponse = await requestJson<any>(baseUrl, '/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    authToken = loginResponse.token;
  }

  if (!authToken) {
    return null;
  }

  try {
    const configResponse = await requestJson<any>(baseUrl, '/api/v1/user/config', {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    const user = configResponse.user ?? loginResponse?.user;
    return {
      baseUrl,
      token: authToken,
      userId: user?.id || email || 'unknown-user',
      email: user?.email || email || 'unknown',
      selfManaged: Boolean(user?.selfManaged),
      provider: configResponse.provider ?? loginResponse?.provider ?? {},
      controls: configResponse.controls ?? loginResponse?.controls ?? {},
      quota: configResponse.quota ?? loginResponse?.quota,
    };
  } catch (err) {
    const payload = (err as { payload?: any }).payload;
    if (payload?.error === 'quota_exceeded') {
      throw new AdminQuotaError(payload.message || 'Token quota exceeded', {
        quota: payload.quota,
        token: authToken,
        baseUrl,
      });
    }
    throw err;
  }
}

export function applyAdminSessionToEnv(session: AdminSession): void {
  process.env['PAPERT_ADMIN_TOKEN'] = session.token;
  process.env['PAPERT_ADMIN_USER_ID'] = session.userId;
  process.env['PAPERT_ADMIN_URL'] = session.baseUrl;
}

export function applyAdminProviderToArgv(
  argv: Record<string, unknown>,
  session: AdminSession,
): void {
  if (session.selfManaged) {
    return;
  }
  argv.authType = AuthType.USE_OPENAI;
  if (session.provider?.apiKey) {
    argv.openaiApiKey = session.provider.apiKey;
  }
  if (session.provider?.baseUrl) {
    argv.openaiBaseUrl = session.provider.baseUrl;
  }
  if (session.provider?.model) {
    argv.model = session.provider.model;
  }
}

export async function reportAdminUsage(
  session: AdminSession,
  config: Config,
): Promise<void> {
  const metrics = uiTelemetryService.getMetrics();
  const usage = computeUsageFromMetrics(metrics as SessionMetrics);
  if (!usage?.totalTokens) return;

  await requestJson(session.baseUrl, '/api/v1/user/usage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId: config.getSessionId(),
      totalTokens: usage.totalTokens,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      model: config.getModel(),
      baseUrl: config.getContentGeneratorConfig().baseUrl,
    }),
  });
}

export async function uploadAdminSession(
  session: AdminSession,
  config: Config,
): Promise<void> {
  const sessionId = config.getSessionId();
  const chatPath = path.join(
    config.storage.getProjectTempDir(),
    'chats',
    `${sessionId}.jsonl`,
  );
  let transcript: string;
  try {
    transcript = await fs.readFile(chatPath, 'utf-8');
  } catch {
    return;
  }

  await requestJson(session.baseUrl, '/api/v1/user/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId,
      transcript,
      model: config.getModel(),
      baseUrl: config.getContentGeneratorConfig().baseUrl,
    }),
  });
}

export async function requestQuotaIncrease(
  baseUrl: string,
  token: string,
  reason: string,
): Promise<void> {
  await requestJson(baseUrl, '/api/v1/user/quota-requests', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason }),
  });
}
