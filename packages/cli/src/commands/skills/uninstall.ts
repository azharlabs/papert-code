/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import { getErrorMessage } from '../../utils/errors.js';
import { uninstallSkill } from '../../config/skill.js';

interface UninstallArgs {
  identifier: string;
}

export async function handleUninstall(args: UninstallArgs) {
  try {
    await uninstallSkill(args.identifier);
    console.log(`Skill "${args.identifier}" uninstalled successfully.`);
  } catch (error) {
    console.error(getErrorMessage(error));
    process.exit(1);
  }
}

export const uninstallCommand: CommandModule = {
  command: 'uninstall <identifier>',
  describe: 'Uninstalls a skill by name or source.',
  builder: (yargs) =>
    yargs.positional('identifier', {
      describe: 'The name or source of the skill to uninstall.',
      type: 'string',
      demandOption: true,
    }),
  handler: async (argv) => {
    await handleUninstall({
      identifier: argv['identifier'] as string,
    });
  },
};
