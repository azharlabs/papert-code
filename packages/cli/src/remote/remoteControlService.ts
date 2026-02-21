/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

export type RemoteControlServiceOptions = {
  baseUrl: string;
  serverToken: string;
  allowInsecureHttp?: boolean;
};

type SessionResponse = {
  sessionId: string;
  token: string;
};

export type RemoteSessionInfo = {
  baseUrl: string;
  sessionId: string;
  token: string;
};

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized === '0.0.0.0'
  );
}

function normalizeDaemonUrl(rawUrl: string): URL {
  try {
    return new URL(rawUrl);
  } catch {
    throw new Error(`Invalid daemon URL: "${rawUrl}"`);
  }
}

export async function createRemoteControlService(
  options: RemoteControlServiceOptions,
): Promise<RemoteSessionInfo> {
  const daemonUrl = normalizeDaemonUrl(options.baseUrl);
  const allowInsecureHttp = options.allowInsecureHttp ?? false;

  if (
    daemonUrl.protocol === 'http:' &&
    !allowInsecureHttp &&
    !isLoopbackHost(daemonUrl.hostname)
  ) {
    throw new Error(
      'Refusing insecure HTTP connect to a non-local host. Use HTTPS or pass --allow-insecure-http.',
    );
  }

  const res = await fetch(new URL('/api/v1/sessions', daemonUrl), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${options.serverToken}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to create remote session: ${res.status} ${res.statusText}`);
  }

  const session = (await res.json()) as SessionResponse;

  return {
    baseUrl: daemonUrl.toString(),
    sessionId: session.sessionId,
    token: session.token,
  };
}
