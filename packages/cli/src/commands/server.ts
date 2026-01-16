/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const serverCommand: CommandModule = {
  command: 'server',
  describe: 'Run Papert Code daemon (remote driving server).',
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
        default: '0.0.0.0',
      })
      .option('docs', {
        type: 'boolean',
        description: 'Enable OpenAPI docs UI at /docs and spec at /openapi.json.',
        default: false,
      })
      .version(false),
  handler: async (argv) => {
    const token =
      typeof argv['token'] === 'string' && argv['token'].trim().length > 0
        ? argv['token'].trim()
        : undefined;

    const env = {
      ...process.env,
      PAPERT_REMOTE_ENABLED: '1',
      PAPERT_REMOTE_SERVER_TOKEN: token ?? '',
      PAPERT_REMOTE_SESSION_TTL_MS: String(argv['session-ttl-ms'] ?? 60_000),
      PAPERT_REMOTE_DOCS_ENABLED: argv['docs'] ? '1' : '0',
      CODER_AGENT_PORT: String(argv['port'] ?? 41242),
      CODER_AGENT_HOST: String(argv['host'] ?? '0.0.0.0'),
    };

    // Spawn the a2a server binary. This keeps the daemon implementation in one place.
    const url = `http://127.0.0.1:${Number(argv['port'] ?? 41242)}`;
    console.error(
      `[papert] starting a2a server\n` +
        `  url:   ${url}\n` +
        `  port:  ${env.CODER_AGENT_PORT}\n` +
        `  token: ${env.PAPERT_REMOTE_SERVER_TOKEN}\n` +
        `  cmd:   papert-a2a-server`
    );

    const localServerEntrypoint = path.resolve(
      process.cwd(),
      'packages/a2a-server/dist/src/http/server.js',
    );

    const spawnCommand = fs.existsSync(localServerEntrypoint)
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
      child = spawn(spawnCommand.command, spawnCommand.args, {
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
