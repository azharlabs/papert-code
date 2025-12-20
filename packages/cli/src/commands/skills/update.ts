/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import {
  checkForAllSkillUpdates,
  updateAllUpdatableSkills,
  updateSkill,
  type SkillUpdateInfo,
} from '../../config/skills/update.js';
import { checkForSkillUpdate } from '../../config/skills/github.js';
import { getErrorMessage } from '../../utils/errors.js';
import { SkillUpdateState } from '../../ui/state/skills.js';
import {
  loadSkills,
  SkillStorage,
  annotateActiveSkills,
  requestConsentNonInteractive,
} from '../../config/skill.js';
import { SkillEnablementManager } from '../../config/skills/skillEnablement.js';

interface UpdateArgs {
  name?: string;
  all?: boolean;
}

const updateOutput = (info: SkillUpdateInfo) =>
  `Skill "${info.name}" successfully updated: ${info.originalVersion} → ${info.updatedVersion}.`;

export async function handleUpdate(args: UpdateArgs) {
  const workingDir = process.cwd();
  const skillEnablementManager = new SkillEnablementManager(
    SkillStorage.getUserSkillsDir(),
    args.name ? [args.name] : [],
  );
  const allSkills = loadSkills(skillEnablementManager);
  const skills = annotateActiveSkills(
    allSkills,
    workingDir,
    skillEnablementManager,
  );
  if (args.name) {
    try {
      const skill = skills.find((entry) => entry.name === args.name);
      if (!skill) {
        console.log(`Skill "${args.name}" not found.`);
        return;
      }
      let updateState: SkillUpdateState | undefined;
      if (!skill.installMetadata) {
        console.log(
          `Unable to update skill "${args.name}" due to missing install metadata`,
        );
        return;
      }
      await checkForSkillUpdate(skill, (newState) => {
        updateState = newState;
      });
      if (updateState !== SkillUpdateState.UPDATE_AVAILABLE) {
        console.log(`Skill "${args.name}" is already up to date.`);
        return;
      }
      const updatedSkillInfo = (await updateSkill(
        skill,
        workingDir,
        requestConsentNonInteractive,
        updateState,
        () => {},
      ))!;
      if (updatedSkillInfo.originalVersion !== updatedSkillInfo.updatedVersion) {
        console.log(updateOutput(updatedSkillInfo));
      } else {
        console.log(`Skill "${args.name}" is already up to date.`);
      }
    } catch (error) {
      console.error(getErrorMessage(error));
    }
  }
  if (args.all) {
    try {
      const skillState = new Map();
      await checkForAllSkillUpdates(skills, (action) => {
        if (action.type === 'SET_STATE') {
          skillState.set(action.payload.name, {
            status: action.payload.state,
            processed: true,
          });
        }
      });
      let updateInfos = await updateAllUpdatableSkills(
        workingDir,
        requestConsentNonInteractive,
        skills,
        skillState,
        () => {},
      );
      updateInfos = updateInfos.filter(
        (info) => info.originalVersion !== info.updatedVersion,
      );
      if (updateInfos.length === 0) {
        console.log('No skills to update.');
        return;
      }
      console.log(updateInfos.map((info) => updateOutput(info)).join('\n'));
    } catch (error) {
      console.error(getErrorMessage(error));
    }
  }
}

export const updateCommand: CommandModule = {
  command: 'update [<name>] [--all]',
  describe: 'Updates all skills or a named skill to the latest version.',
  builder: (yargs) =>
    yargs
      .positional('name', {
        describe: 'The name of the skill to update.',
        type: 'string',
      })
      .option('all', {
        describe: 'Update all skills.',
        type: 'boolean',
      })
      .conflicts('name', 'all')
      .check((argv) => {
        if (!argv.all && !argv.name) {
          throw new Error('Either a skill name or --all must be provided');
        }
        return true;
      }),
  handler: async (argv) => {
    await handleUpdate({
      name: argv['name'] as string | undefined,
      all: argv['all'] as boolean | undefined,
    });
  },
};
