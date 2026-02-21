/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import {
  getDiscoverableSkills,
  SkillStorage,
  toOutputString,
} from '../../config/skill.js';
import { getErrorMessage } from '../../utils/errors.js';
import { SkillEnablementManager } from '../../config/skills/skillEnablement.js';

export async function handleList() {
  try {
    const workspaceDir = process.cwd();
    const skills = getDiscoverableSkills(workspaceDir);

    if (skills.length === 0) {
      console.log('No skills installed.');
      return;
    }
    const manager = new SkillEnablementManager(
      SkillStorage.getUserSkillsDir(),
    );
    manager.validateSkillOverrides(skills);
    console.log(
      skills
        .map((skill, _): string => toOutputString(skill, workspaceDir))
        .join('\n\n'),
    );
  } catch (error) {
    console.error(getErrorMessage(error));
    process.exit(1);
  }
}

export const listCommand: CommandModule = {
  command: 'list',
  describe: 'Lists installed skills.',
  builder: (yargs) => yargs,
  handler: async () => {
    await handleList();
  },
};
