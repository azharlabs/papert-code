/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import { spawn as childProcessSpawn } from 'node:child_process';

let spawnImpl: typeof childProcessSpawn = childProcessSpawn;

export const __setSpawnForConnect = (
  spawn: typeof childProcessSpawn,
): void => {
  spawnImpl = spawn;
};

export const __resetSpawnForConnect = (): void => {
  spawnImpl = childProcessSpawn;
};

export const __testSpawnForConnect = (): typeof childProcessSpawn => spawnImpl;

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

export const connectCommand: CommandModule = {
  command: 'connect <url>',
  describe: 'Connect to a remote Papert Code daemon and run the CLI against it.',
  builder: (yargs) =>
    yargs
      .positional('url', {
        type: 'string',
        describe: 'Base URL of the daemon, e.g. http://host:41242',
        demandOption: true,
      })
      .option('token', {
        type: 'string',
        description: 'Server token required to create a remote session.',
        demandOption: true,
      })
      .option('allow-insecure-http', {
        type: 'boolean',
        description:
          'Allow connecting over plain HTTP for non-local daemon hosts (insecure).',
        default: false,
      })
      .version(false),
  handler: async (argv) => {
    const daemonUrl = normalizeDaemonUrl(String(argv['url']));
    const token = String(argv['token']);
    const allowInsecureHttp = Boolean(argv['allow-insecure-http']);

    if (
      daemonUrl.protocol === 'http:' &&
      !allowInsecureHttp &&
      !isLoopbackHost(daemonUrl.hostname)
    ) {
      throw new Error(
        'Refusing insecure HTTP connect to a non-local host. Use HTTPS or pass --allow-insecure-http.',
      );
    }

    // Launch the local Interactive TUI, but route all model/tool calls to the
    // remote daemon by passing remote session parameters via env.
    const child = __testSpawnForConnect()(
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
          PAPERT_REMOTE_TOKEN: token,
          PAPERT_REMOTE_ALLOW_INSECURE_HTTP: allowInsecureHttp ? '1' : '0',
        },
      },
    );

    child.on('close', (code) => {
      process.exit(code ?? 0);
    });
  },
};
