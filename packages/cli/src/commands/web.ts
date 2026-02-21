/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import { spawn as childProcessSpawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';

let spawnImpl: typeof childProcessSpawn = childProcessSpawn;

export const __setSpawnForWeb = (spawn: typeof childProcessSpawn): void => {
  spawnImpl = spawn;
};

export const __resetSpawnForWeb = (): void => {
  spawnImpl = childProcessSpawn;
};

export const __testSpawnForWeb = (): typeof childProcessSpawn => spawnImpl;

function resolveServerToken(
  tokenArg: unknown,
  allowEmptyToken: boolean,
): string {
  if (typeof tokenArg === 'string' && tokenArg.trim().length > 0) {
    return tokenArg.trim();
  }
  if (allowEmptyToken) {
    return '';
  }
  return randomBytes(24).toString('base64url');
}

function resolveA2aServerEntrypoint(): string | undefined {
  const candidates: string[] = [];
  const commandFile = fileURLToPath(import.meta.url);
  const commandDir = path.dirname(commandFile);
  const papertEntrypoint = process.argv[1];

  // Monorepo from current directory.
  candidates.push(
    path.resolve(process.cwd(), 'packages/a2a-server/dist/src/http/server.js'),
  );

  // Monorepo when command file is in packages/cli/src or packages/cli/dist/src.
  candidates.push(
    path.resolve(
      commandDir,
      '../../../../packages/a2a-server/dist/src/http/server.js',
    ),
  );
  candidates.push(
    path.resolve(
      commandDir,
      '../../../../../packages/a2a-server/dist/src/http/server.js',
    ),
  );

  // Relative to resolved papert entrypoint.
  if (papertEntrypoint) {
    candidates.push(
      path.resolve(
        path.dirname(papertEntrypoint),
        '../packages/a2a-server/dist/src/http/server.js',
      ),
    );
    candidates.push(
      path.resolve(
        path.dirname(papertEntrypoint),
        '../../packages/a2a-server/dist/src/http/server.js',
      ),
    );
  }

  // Installed package dependency resolution.
  try {
    const require = createRequire(import.meta.url);
    const resolved = require.resolve(
      '@papert-code/papert-code-a2a-server/dist/src/http/server.js',
    );
    candidates.push(resolved);
  } catch {
    // Ignore and continue with fallback command.
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

export const webCommand: CommandModule = {
  command: 'web',
  describe: 'Run Papert Code daemon with the web UI enabled.',
  builder: (yargs) =>
    yargs
      .option('port', {
        type: 'number',
        description: 'Port to bind the daemon to.',
        default: 41242,
      })
      .option('token', {
        type: 'string',
        description:
          'Server token required to create a remote session. If omitted, a random token is generated and printed.',
      })
      .option('session-ttl-ms', {
        type: 'number',
        description: 'Session lease TTL in milliseconds.',
        default: 60_000,
      })
      .option('host', {
        type: 'string',
        description: 'Host to bind to.',
        default: '127.0.0.1',
      })
      .option('allow-empty-token', {
        type: 'boolean',
        description:
          'Allow creating remote sessions without a server token (insecure, local-only).',
        default: false,
      })
      .option('docs', {
        type: 'boolean',
        description: 'Enable OpenAPI docs UI at /docs and spec at /openapi.json.',
        default: false,
      })
      .version(false),
  handler: async (argv) => {
    const allowEmptyToken = Boolean(argv['allow-empty-token']);
    const token = resolveServerToken(argv['token'], allowEmptyToken);
    const bindHost = String(argv['host'] ?? '127.0.0.1');
    const port = Number(argv['port'] ?? 41242);
    const connectHost =
      bindHost === '0.0.0.0' || bindHost === '::' ? '127.0.0.1' : bindHost;
    const connectUrl = `http://${connectHost}:${port}`;

    const env = {
      ...process.env,
      PAPERT_REMOTE_ENABLED: '1',
      PAPERT_WEB_UI_ENABLED: '1',
      PAPERT_REMOTE_SERVER_TOKEN: token,
      PAPERT_REMOTE_SESSION_TTL_MS: String(argv['session-ttl-ms'] ?? 60_000),
      PAPERT_REMOTE_DOCS_ENABLED: argv['docs'] ? '1' : '0',
      CODER_AGENT_PORT: String(port),
      CODER_AGENT_HOST: bindHost,
    };

    console.error(
      `[papert] starting web UI\n` +
        `  bind:  ${bindHost}:${port}\n` +
        `  url:   ${connectUrl}\n` +
        `  port:  ${env.CODER_AGENT_PORT}\n` +
        `  token: ${env.PAPERT_REMOTE_SERVER_TOKEN}\n` +
        `  cmd:   papert-a2a-server`
    );
    if (allowEmptyToken) {
      console.error(
        '[papert] warning: --allow-empty-token disables server-token auth for session creation',
      );
    }
    if (!allowEmptyToken && typeof argv['token'] !== 'string') {
      console.error('[papert] generated ephemeral server token for this run');
    }

    console.error(`[papert] open ${connectUrl} in your browser to use Papert Code Web`);
    console.error(
      `[papert] connect: papert connect ${connectUrl} --token ${token}`,
    );
    console.error(
      `[papert] attach:  papert attach ${connectUrl} --server-token ${token}`,
    );

    const localServerEntrypoint = resolveA2aServerEntrypoint();

    const spawnCommand = localServerEntrypoint
      ? {
          command: process.execPath,
          args: [localServerEntrypoint],
          display: `${process.execPath} ${localServerEntrypoint}`,
        }
      : {
          command: 'papert-a2a-server',
          args: [],
          display: 'papert-a2a-server',
        };

    console.error(`[papert] spawning: ${spawnCommand.display}`);

    let child;
    try {
      child = __testSpawnForWeb()(spawnCommand.command, spawnCommand.args, {
        stdio: 'inherit',
        env,
      });
    } catch (err) {
      console.error(`[papert] failed to spawn daemon:`, err);
      process.exit(1);
      return;
    }

    child.on('error', (err) => {
      console.error(`[papert] daemon spawn error:`, err);
      process.exit(1);
    });

    child.on('close', (code) => {
      if (code && code !== 0) {
        console.error(`[papert] papert-a2a-server exited with code ${code}`);
      }
      process.exit(code ?? 0);
    });
  },
};
