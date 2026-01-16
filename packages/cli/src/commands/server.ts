/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import { spawn } from 'node:child_process';

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
      .version(false),
  handler: async (argv) => {
    const token =
      typeof argv.token === 'string' && argv.token.trim().length > 0
        ? argv.token.trim()
        : undefined;

    const env = {
      ...process.env,
      PAPERT_REMOTE_ENABLED: '1',
      PAPERT_REMOTE_SERVER_TOKEN: token ?? '',
      PAPERT_REMOTE_SESSION_TTL_MS: String(argv['session-ttl-ms'] ?? 60_000),
      CODER_AGENT_PORT: String(argv.port ?? 41242),
      CODER_AGENT_HOST: String(argv.host ?? '0.0.0.0'),
    };

    // Spawn the a2a server binary. This keeps the daemon implementation in one place.
    const child = spawn('papert-a2a-server', [], {
      stdio: 'inherit',
      env,
    });

    child.on('close', (code) => {
      process.exit(code ?? 0);
    });
  },
};
