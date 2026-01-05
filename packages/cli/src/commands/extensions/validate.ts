/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CommandModule } from 'yargs';
import semver from 'semver';
import {
  loadExtensionConfig,
  validateName,
} from '../../config/extension.js';
import { getErrorMessage } from '../../utils/errors.js';

interface ValidateArgs {
  path: string;
}

async function validateExtension(args: ValidateArgs) {
  const absoluteInputPath = path.resolve(args.path);
  const extensionConfig = loadExtensionConfig({
    extensionDir: absoluteInputPath,
    workspaceDir: process.cwd(),
  });

  // Validate required fields on load.
  validateName(extensionConfig.name);

  const warnings: string[] = [];
  const errors: string[] = [];

  if (extensionConfig.contextFileName) {
    const contextFileNames = Array.isArray(extensionConfig.contextFileName)
      ? extensionConfig.contextFileName
      : [extensionConfig.contextFileName];

    const missingContextFiles: string[] = [];
    for (const contextFilePath of contextFileNames) {
      const contextFileAbsolutePath = path.resolve(
        absoluteInputPath,
        contextFilePath,
      );
      if (!fs.existsSync(contextFileAbsolutePath)) {
        missingContextFiles.push(contextFilePath);
      }
    }
    if (missingContextFiles.length > 0) {
      errors.push(
        `The following context files referenced in papert-extension.json are missing: ${missingContextFiles}`,
      );
    }
  }

  if (!semver.valid(extensionConfig.version)) {
    warnings.push(
      `Warning: Version '${extensionConfig.version}' does not appear to be standard semver (e.g., 1.0.0).`,
    );
  }

  if (warnings.length > 0) {
    warnings.forEach((warning) => console.warn(warning));
  }

  if (errors.length > 0) {
    errors.forEach((error) => console.error(error));
    throw new Error('Extension validation failed.');
  }
}

export async function handleValidate(args: ValidateArgs) {
  try {
    await validateExtension(args);
    console.log(`Extension ${args.path} has been successfully validated.`);
  } catch (error) {
    console.error(getErrorMessage(error));
    process.exit(1);
  }
}

export const validateCommand: CommandModule = {
  command: 'validate <path>',
  describe: 'Validates an extension from a local path.',
  builder: (yargs) =>
    yargs.positional('path', {
      describe: 'The path of the extension to validate.',
      type: 'string',
      demandOption: true,
    }),
  handler: async (args) => {
    await handleValidate({
      path: args['path'] as string,
    });
  },
};
