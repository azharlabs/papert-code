/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import { installCommand } from './skills/install.js';
import { uninstallCommand } from './skills/uninstall.js';
import { listCommand } from './skills/list.js';
import { updateCommand } from './skills/update.js';
import { disableCommand } from './skills/disable.js';
import { enableCommand } from './skills/enable.js';
import { linkCommand } from './skills/link.js';
import { newCommand } from './skills/new.js';
import { validateCommand } from './skills/validate.js';

export const skillsCommand: CommandModule = {
  command: 'skills <command>',
  describe: 'Manage Papert Code skills.',
  builder: (yargs) =>
    yargs
      .command(installCommand)
      .command(uninstallCommand)
      .command(listCommand)
      .command(updateCommand)
      .command(disableCommand)
      .command(enableCommand)
      .command(linkCommand)
      .command(newCommand)
      .command(validateCommand)
      .demandCommand(),
  handler: () => { },
};
