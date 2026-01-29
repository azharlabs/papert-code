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

export const attachCommand: CommandModule = {
  command: 'attach <url>',
  describe: 'Attach the CLI to an existing remote session.',
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
        demandOption: true,
      })
      .option('session-token', {
        type: 'string',
        description: 'Existing remote session token.',
        demandOption: true,
      })
      .version(false),
  handler: async (argv) => {
    const url = String(argv['url']);
    const sessionId = String(argv['session-id']);
    const sessionToken = String(argv['session-token']);

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
          PAPERT_REMOTE_URL: url,
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
