/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CommandModule } from 'yargs';
import semver from 'semver';
import { loadSkillConfig, validateName } from '../../config/skill.js';
import { getErrorMessage } from '../../utils/errors.js';

interface ValidateArgs {
  path: string;
}

async function validateSkill(args: ValidateArgs) {
  const absoluteInputPath = path.resolve(args.path);
  const skillConfig = loadSkillConfig({
    skillDir: absoluteInputPath,
    workspaceDir: process.cwd(),
  });

  validateName(skillConfig.name);

  const warnings: string[] = [];
  const errors: string[] = [];

  const contextFileNames = skillConfig.contextFileName
    ? Array.isArray(skillConfig.contextFileName)
      ? skillConfig.contextFileName
      : [skillConfig.contextFileName]
    : skillConfig.contextFiles || [];

  if (contextFileNames.length > 0) {
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
        `The following context files referenced in SKILL.md are missing: ${missingContextFiles}`,
      );
    }
  }

  if (!semver.valid(skillConfig.version)) {
    warnings.push(
      `Warning: Version '${skillConfig.version}' does not appear to be standard semver (e.g., 1.0.0).`,
    );
  }

  if (warnings.length > 0) {
    warnings.forEach((warning) => console.warn(warning));
  }

  if (errors.length > 0) {
    errors.forEach((error) => console.error(error));
    throw new Error('Skill validation failed.');
  }
}

export async function handleValidate(args: ValidateArgs) {
  try {
    await validateSkill(args);
    console.log(`Skill ${args.path} has been successfully validated.`);
  } catch (error) {
    console.error(getErrorMessage(error));
    process.exit(1);
  }
}

export const validateCommand: CommandModule = {
  command: 'validate <path>',
  describe: 'Validates a skill from a local path.',
  builder: (yargs) =>
    yargs.positional('path', {
      describe: 'The path of the skill to validate.',
      type: 'string',
      demandOption: true,
    }),
  handler: async (args) => {
    await handleValidate({
      path: args['path'] as string,
    });
  },
};
