/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import { spawn as childProcessSpawn } from 'node:child_process';

let spawnImpl: typeof childProcessSpawn = childProcessSpawn;

export const __setSpawnForAttach = (spawn: typeof childProcessSpawn): void => {
  spawnImpl = spawn;
};

export const __resetSpawnForAttach = (): void => {
  spawnImpl = childProcessSpawn;
};

export const __testSpawn = (): typeof childProcessSpawn => spawnImpl;

type RemoteSessionResponse = {
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

async function createRemoteSession(
  daemonUrl: URL,
  serverToken: string,
): Promise<RemoteSessionResponse> {
  const headers: Record<string, string> = {};
  if (serverToken.trim().length > 0) {
    headers['authorization'] = `Bearer ${serverToken.trim()}`;
  }

  const res = await fetch(new URL('/api/v1/sessions', daemonUrl), {
    method: 'POST',
    headers,
  });
  if (!res.ok) {
    let details = '';
    try {
      const body = (await res.json()) as { error?: string };
      if (typeof body?.error === 'string' && body.error.length > 0) {
        details = `: ${body.error}`;
      }
    } catch {
      // Ignore malformed body.
    }
    throw new Error(
      `Failed to create remote session: ${res.status} ${res.statusText}${details}`,
    );
  }
  const parsed = (await res.json()) as Partial<RemoteSessionResponse>;
  if (
    typeof parsed.sessionId !== 'string' ||
    parsed.sessionId.length === 0 ||
    typeof parsed.token !== 'string' ||
    parsed.token.length === 0
  ) {
    throw new Error('Remote daemon returned an invalid session response.');
  }
  return {
    sessionId: parsed.sessionId,
    token: parsed.token,
  };
}

export const attachCommand: CommandModule = {
  command: 'attach <url>',
  describe:
    'Attach to an existing remote session, or create one with --server-token.',
  builder: (yargs) =>
    yargs
      .positional('url', {
        type: 'string',
        describe: 'Base URL of the daemon, e.g. http://host:41242',
        demandOption: true,
      })
      .option('session-id', {
        type: 'string',
        description: 'Existing remote session id.',
      })
      .option('session-token', {
        type: 'string',
        description: 'Existing remote session token.',
      })
      .option('server-token', {
        type: 'string',
        description:
          'Server token used to create a new remote session before attaching.',
      })
      .option('allow-insecure-http', {
        type: 'boolean',
        description:
          'Allow attaching over plain HTTP for non-local daemon hosts (insecure).',
        default: false,
      })
      .version(false),
  handler: async (argv) => {
    const daemonUrl = normalizeDaemonUrl(String(argv['url']));
    const sessionIdArg =
      typeof argv['session-id'] === 'string' ? argv['session-id'].trim() : '';
    const sessionTokenArg =
      typeof argv['session-token'] === 'string'
        ? argv['session-token'].trim()
        : '';
    const serverTokenArg =
      typeof argv['server-token'] === 'string'
        ? argv['server-token'].trim()
        : '';

    const hasSessionId = sessionIdArg.length > 0;
    const hasSessionToken = sessionTokenArg.length > 0;
    const hasServerToken = serverTokenArg.length > 0;

    if (hasSessionId !== hasSessionToken) {
      throw new Error(
        'Both --session-id and --session-token are required together.',
      );
    }
    if ((hasSessionId && hasServerToken) || (!hasSessionId && !hasServerToken)) {
      throw new Error(
        'Provide either (--session-id + --session-token) or --server-token.',
      );
    }
    if (
      daemonUrl.protocol === 'http:' &&
      !Boolean(argv['allow-insecure-http']) &&
      !isLoopbackHost(daemonUrl.hostname)
    ) {
      throw new Error(
        'Refusing insecure HTTP attach to a non-local host. Use HTTPS or pass --allow-insecure-http.',
      );
    }

    let sessionId = sessionIdArg;
    let sessionToken = sessionTokenArg;
    if (!hasSessionId) {
      const created = await createRemoteSession(daemonUrl, serverTokenArg);
      sessionId = created.sessionId;
      sessionToken = created.token;
    }

    const child = __testSpawn()(
      process.execPath,
      [
        // run the current CLI entrypoint
        process.argv[1]!,
      ],
      {
        stdio: 'inherit',
        env: {
          ...process.env,
          PAPERT_REMOTE_URL: daemonUrl.toString(),
          PAPERT_REMOTE_SESSION_ID: sessionId,
          PAPERT_REMOTE_SESSION_TOKEN: sessionToken,
        },
      },
    );

    child.on('close', (code) => {
      process.exit(code ?? 0);
    });
  },
};
