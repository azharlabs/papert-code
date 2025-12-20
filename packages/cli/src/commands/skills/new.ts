/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { access, mkdir, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import type { CommandModule } from 'yargs';
import { getErrorMessage } from '../../utils/errors.js';
import { SKILL_FILENAME } from '../../config/skill.js';

interface NewArgs {
  path: string;
}

async function pathExists(path: string) {
  try {
    await access(path);
    return true;
  } catch (_e) {
    return false;
  }
}

async function createDirectory(path: string) {
  if (await pathExists(path)) {
    throw new Error(`Path already exists: ${path}`);
  }
  await mkdir(path, { recursive: true });
}

function buildSkillTemplate(name: string): string {
  return [
    '---',
    `name: ${name}`,
    'version: 1.0.0',
    '---',
    '',
    `# ${name}`,
    '',
    'Describe what this skill does and how it should be used.',
    '',
  ].join('\n');
}

async function handleNew(args: NewArgs) {
  try {
    await createDirectory(args.path);
    const skillName = basename(args.path);
    const skillFilePath = `${args.path}/${SKILL_FILENAME}`;
    await writeFile(skillFilePath, buildSkillTemplate(skillName));
    console.log(`Successfully created new skill at ${args.path}.`);
    console.log(
      `You can install this using "papert skills link ${args.path}" to test it out.`,
    );
  } catch (error) {
    console.error(getErrorMessage(error));
    throw error;
  }
}

export const newCommand: CommandModule = {
  command: 'new <path>',
  describe: 'Create a new skill with a SKILL.md template.',
  builder: async (yargs) =>
    yargs.positional('path', {
      describe: 'The path to create the skill in.',
      type: 'string',
    }),
  handler: async (args) => {
    await handleNew({
      path: args['path'] as string,
    });
  },
};
