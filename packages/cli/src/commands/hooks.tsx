/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import { migrateCommand } from './hooks/migrate.js';

export const hooksCommand: CommandModule = {
  command: 'hooks <command>',
  aliases: ['hook'],
  describe: 'Manage Papert Code hooks.',
  builder: (yargs) =>
    yargs
      .command(migrateCommand)
      .demandCommand(1, 'You need at least one command before continuing.')
      .version(false),
  handler: () => {
    // This handler is not called when a subcommand is provided.
    // Yargs will show the help menu.
  },
};
