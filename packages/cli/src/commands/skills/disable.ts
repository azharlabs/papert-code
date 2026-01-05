/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { type CommandModule } from 'yargs';
import {
  FatalConfigError,
  getErrorMessage,
} from '@papert-code/papert-code-core';
import { disableSkill } from '../../config/skill.js';
import { SettingScope } from '../../config/settings.js';

interface DisableArgs {
  name: string;
  scope?: string;
}

export function handleDisable(args: DisableArgs) {
  try {
    if (args.scope?.toLowerCase() === 'workspace') {
      disableSkill(args.name, SettingScope.Workspace);
    } else {
      disableSkill(args.name, SettingScope.User);
    }
    if (args.scope) {
      console.log(
        `Skill "${args.name}" successfully disabled for scope "${args.scope}".`,
      );
    } else {
      console.log(
        `Skill "${args.name}" successfully disabled in all scopes.`,
      );
    }
  } catch (error) {
    throw new FatalConfigError(getErrorMessage(error));
  }
}

export const disableCommand: CommandModule = {
  command: 'disable [--scope] <name>',
  describe: 'Disables a skill.',
  builder: (yargs) =>
    yargs
      .positional('name', {
        describe: 'The name of the skill to disable.',
        type: 'string',
      })
      .option('scope', {
        describe:
          'The scope to disable the skill in. If not set, will be disabled in all scopes.',
        type: 'string',
      })
      .check((argv) => {
        if (
          argv.scope &&
          !Object.values(SettingScope)
            .map((s) => s.toLowerCase())
            .includes((argv.scope as string).toLowerCase())
        ) {
          throw new Error(
            `Invalid scope: ${argv.scope}. Please use one of ${Object.values(
              SettingScope,
            )
              .map((s) => s.toLowerCase())
              .join(', ')}.`,
          );
        }
        return true;
      }),
  handler: (argv) => {
    handleDisable({
      name: argv['name'] as string,
      scope: argv['scope'] as string,
    });
  },
};
