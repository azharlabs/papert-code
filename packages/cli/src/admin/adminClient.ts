import { computeUsageFromMetrics } from '../utils/nonInteractiveHelpers.js';
import {
  uiTelemetryService,
  AuthType,
  Storage,
  type SessionMetrics,
} from '@papert-code/papert-code-core';
import type { Config } from '@papert-code/papert-code-core';
import path from 'node:path';
import fs from 'node:fs/promises';
import prompts from 'prompts';

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
    models?: string[];
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

function getAdminTokenPath(): string {
  return path.join(Storage.getGlobalPapertDir(), 'admin-token.json');
}

async function loadCachedToken(
  baseUrl: string,
): Promise<{ token: string; email?: string } | null> {
  try {
    const raw = await fs.readFile(getAdminTokenPath(), 'utf-8');
    const parsed = JSON.parse(raw) as {
      token?: string;
      email?: string;
      baseUrl?: string;
    };
    if (!parsed.token || !parsed.baseUrl) return null;
    if (parsed.baseUrl !== baseUrl) return null;
    return { token: parsed.token, email: parsed.email };
  } catch {
    return null;
  }
}

async function saveCachedToken(
  baseUrl: string,
  token: string,
  email?: string,
): Promise<void> {
  const payload = { baseUrl, token, email, savedAt: new Date().toISOString() };
  await fs.mkdir(path.dirname(getAdminTokenPath()), { recursive: true });
  await fs.writeFile(getAdminTokenPath(), JSON.stringify(payload, null, 2));
}

async function promptForLogin(): Promise<{ email: string; password: string } | null> {
  if (!process.stdin.isTTY) return null;
  const response = await prompts(
    [
      {
        type: 'text',
        name: 'email',
        message: 'Admin email',
        validate: (value: string) =>
          value.includes('@') ? true : 'Enter a valid email',
      },
      {
        type: 'password',
        name: 'password',
        message: 'Admin password',
      },
    ],
    {
      onCancel: () => true,
    },
  );
  if (!response.email || !response.password) {
    return null;
  }
  return { email: response.email as string, password: response.password as string };
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

function isFetchFailure(err: unknown): boolean {
  return err instanceof TypeError && err.message === 'fetch failed';
}

export async function resolveAdminSession(): Promise<AdminSession | null> {
  const { baseUrl, email, password, token } = getAdminEnv();
  if (!baseUrl) return null;

  let authToken = token;
  let loginResponse: any;

  if (!authToken) {
    const cached = await loadCachedToken(baseUrl);
    if (cached?.token) {
      authToken = cached.token;
    }
  }

  let loginEmail = email;
  let loginPassword = password;
  if (!authToken && (!loginEmail || !loginPassword)) {
    const prompted = await promptForLogin();
    if (prompted) {
      loginEmail = prompted.email;
      loginPassword = prompted.password;
    }
  }

  if (!authToken && loginEmail && loginPassword) {
    try {
      loginResponse = await requestJson<any>(baseUrl, '/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      authToken = loginResponse.token;
      if (authToken) {
        await saveCachedToken(baseUrl, authToken, loginEmail);
      }
    } catch (err) {
      if (isFetchFailure(err)) {
        console.warn(
          `Warning: unable to reach admin server at ${baseUrl}. Continuing without admin session.`,
        );
        return null;
      }
      throw err;
    }
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
    const provider =
      configResponse.provider ??
      loginResponse?.provider ??
      loginResponse?.user?.provider ??
      {};
    return {
      baseUrl,
      token: authToken,
      userId: user?.id || email || 'unknown-user',
      email: user?.email || email || 'unknown',
      selfManaged: Boolean(user?.selfManaged),
      provider,
      controls: configResponse.controls ?? loginResponse?.controls ?? {},
      quota: configResponse.quota ?? loginResponse?.quota,
    };
  } catch (err) {
    if (isFetchFailure(err)) {
      console.warn(
        `Warning: unable to reach admin server at ${baseUrl}. Continuing without admin session.`,
      );
      return null;
    }
    if ((err as { status?: number }).status === 401) {
      try {
        await fs.unlink(getAdminTokenPath());
      } catch {
        // ignore cache delete failures
      }
    }
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

export async function resolveAdminSessionWithCredentials(options: {
  baseUrl: string;
  email?: string;
  password?: string;
  token?: string;
}): Promise<AdminSession | null> {
  const baseUrl = options.baseUrl.replace(/\/$/, '');
  if (!baseUrl) return null;

  let authToken = options.token;
  let loginResponse: any;

  if (!authToken && options.email && options.password) {
    try {
      loginResponse = await requestJson<any>(baseUrl, '/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: options.email,
          password: options.password,
        }),
      });
      authToken = loginResponse.token;
      if (authToken) {
        await saveCachedToken(baseUrl, authToken, options.email);
      }
    } catch (err) {
      if (isFetchFailure(err)) {
        throw new Error(
          `Unable to reach admin server at ${baseUrl}. Please check the URL and network.`,
        );
      }
      throw err;
    }
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
    const provider =
      configResponse.provider ??
      loginResponse?.provider ??
      loginResponse?.user?.provider ??
      {};
    return {
      baseUrl,
      token: authToken,
      userId: user?.id || options.email || 'unknown-user',
      email: user?.email || options.email || 'unknown',
      selfManaged: Boolean(user?.selfManaged),
      provider,
      controls: configResponse.controls ?? loginResponse?.controls ?? {},
      quota: configResponse.quota ?? loginResponse?.quota,
    };
  } catch (err) {
    if (isFetchFailure(err)) {
      throw new Error(
        `Unable to reach admin server at ${baseUrl}. Please check the URL and network.`,
      );
    }
    if ((err as { status?: number }).status === 401) {
      try {
        await fs.unlink(getAdminTokenPath());
      } catch {
        // ignore cache delete failures
      }
    }
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
  const models =
    session.provider?.models && session.provider.models.length > 0
      ? session.provider.models
      : session.provider?.model
        ? [session.provider.model]
        : null;
  if (models) {
    process.env['PAPERT_ADMIN_MODELS'] = JSON.stringify(models);
  }
}

export function applyAdminProviderToArgv(
  argv: Record<string, unknown>,
  session: AdminSession,
): void {
  if (session.selfManaged) {
    return;
  }
  argv['authType'] = AuthType.USE_OPENAI;
  if (session.provider?.apiKey) {
    argv['openaiApiKey'] = session.provider.apiKey;
  }
  if (session.provider?.baseUrl) {
    argv['openaiBaseUrl'] = session.provider.baseUrl;
  }
  const defaultModel =
    session.provider?.model || session.provider?.models?.[0];
  if (defaultModel) {
    argv['model'] = defaultModel;
  }
}

export async function reportAdminUsage(
  session: AdminSession,
  config: Config,
): Promise<void> {
  const metrics = uiTelemetryService.getMetrics();
  const usage = computeUsageFromMetrics(metrics as SessionMetrics);
  const totalTokens =
    usage?.total_tokens ??
    (typeof usage?.input_tokens === 'number' &&
    typeof usage?.output_tokens === 'number'
      ? usage.input_tokens + usage.output_tokens
      : undefined);
  if (!totalTokens) return;

  await requestJson(session.baseUrl, '/api/v1/user/usage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId: config.getSessionId(),
      totalTokens,
      promptTokens: usage.input_tokens,
      completionTokens: usage.output_tokens,
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
