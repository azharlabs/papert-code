/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import {
  loadExtensionByName,
  toOutputString,
} from '../../config/extension.js';
import { getErrorMessage } from '../../utils/errors.js';

interface DetailArgs {
  name: string;
}

export function handleDetail(args: DetailArgs) {
  try {
    const extension = loadExtensionByName(args.name, process.cwd());
    if (!extension) {
      throw new Error(`Extension "${args.name}" not found.`);
    }
    console.log(toOutputString(extension, process.cwd()));
  } catch (error) {
    console.error(getErrorMessage(error));
    process.exit(1);
  }
}

export const detailCommand: CommandModule = {
  command: 'detail <name>',
  describe: 'Show details for an installed extension.',
  builder: (yargs) =>
    yargs.positional('name', {
      describe: 'The name of the extension.',
      type: 'string',
      demandOption: true,
    }),
  handler: (argv) => {
    handleDetail({
      name: argv['name'] as string,
    });
  },
};
