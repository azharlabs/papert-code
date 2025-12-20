/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import { installSkill, requestConsentNonInteractive } from '../../config/skill.js';
import type { ExtensionInstallMetadata } from '@papert-code/papert-code-core';
import { getErrorMessage } from '../../utils/errors.js';

interface InstallArgs {
  path: string;
}

export async function handleLink(args: InstallArgs) {
  try {
    const installMetadata: ExtensionInstallMetadata = {
      source: args.path,
      type: 'link',
    };
    const skillNames = await installSkill(
      installMetadata,
      requestConsentNonInteractive,
    );
    const label = skillNames.length > 1 ? 'Skills' : 'Skill';
    console.log(`${label} ${skillNames.map((name) => `"${name}"`).join(', ')} linked successfully and enabled.`);
  } catch (error) {
    console.error(getErrorMessage(error));
    process.exit(1);
  }
}

export const linkCommand: CommandModule = {
  command: 'link <path>',
  describe:
    'Links a skill from a local path. Updates made to the local path will always be reflected.',
  builder: (yargs) =>
    yargs
      .positional('path', {
        describe: 'The name of the skill to link.',
        type: 'string',
      })
      .check((_) => true),
  handler: async (argv) => {
    await handleLink({
      path: argv['path'] as string,
    });
  },
};
