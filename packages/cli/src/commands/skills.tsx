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
import { defer } from '../deferred.js';

export const skillsCommand: CommandModule = {
  command: 'skills <command>',
  describe: 'Manage Papert Code skills.',
  builder: (yargs) =>
    yargs
      .command(defer(installCommand, 'skills'))
      .command(defer(uninstallCommand, 'skills'))
      .command(defer(listCommand, 'skills'))
      .command(defer(updateCommand, 'skills'))
      .command(defer(disableCommand, 'skills'))
      .command(defer(enableCommand, 'skills'))
      .command(defer(linkCommand, 'skills'))
      .command(defer(newCommand, 'skills'))
      .command(defer(validateCommand, 'skills'))
      .demandCommand(),
  handler: () => { },
};
