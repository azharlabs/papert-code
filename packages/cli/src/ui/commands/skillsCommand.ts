/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { requestConsentInteractive } from '../../config/skill.js';
import {
  updateAllUpdatableSkills,
  type SkillUpdateInfo,
  updateSkill,
  checkForAllSkillUpdates,
} from '../../config/skills/update.js';
import { getErrorMessage } from '../../utils/errors.js';
import { SkillUpdateState } from '../state/skills.js';
import { MessageType } from '../types.js';
import {
  type CommandContext,
  type SlashCommand,
  CommandKind,
} from './types.js';
import { t } from '../../i18n/index.js';

async function listAction(context: CommandContext) {
  context.ui.addItem(
    {
      type: MessageType.SKILLS_LIST,
    },
    Date.now(),
  );
}

async function updateAction(context: CommandContext, args: string) {
  const updateArgs = args.split(' ').filter((value) => value.length > 0);
  const all = updateArgs.length === 1 && updateArgs[0] === '--all';
  const names = all ? undefined : updateArgs;
  let updateInfos: SkillUpdateInfo[] = [];

  if (!all && names?.length === 0) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: 'Usage: /skills update <skill-names>|--all',
      },
      Date.now(),
    );
    return;
  }

  try {
    await checkForAllSkillUpdates(
      context.services.config!.getSkills(),
      context.ui.dispatchSkillStateUpdate,
    );
    context.ui.setPendingItem({
      type: MessageType.SKILLS_LIST,
    });
    if (all) {
      updateInfos = await updateAllUpdatableSkills(
        context.services.config!.getWorkingDir(),
        (description) =>
          requestConsentInteractive(
            description,
            context.ui.addConfirmUpdateSkillRequest,
          ),
        context.services.config!.getSkills(),
        context.ui.skillsUpdateState,
        context.ui.dispatchSkillStateUpdate,
      );
    } else if (names?.length) {
      const workingDir = context.services.config!.getWorkingDir();
      const skills = context.services.config!.getSkills();
      for (const name of names) {
        const skill = skills.find((entry) => entry.name === name);
        if (!skill) {
          context.ui.addItem(
            {
              type: MessageType.ERROR,
              text: `Skill ${name} not found.`,
            },
            Date.now(),
          );
          continue;
        }
        const updateInfo = await updateSkill(
          skill,
          workingDir,
          (description) =>
            requestConsentInteractive(
              description,
              context.ui.addConfirmUpdateSkillRequest,
            ),
          context.ui.skillsUpdateState.get(skill.name)?.status ??
            SkillUpdateState.UNKNOWN,
          context.ui.dispatchSkillStateUpdate,
        );
        if (updateInfo) updateInfos.push(updateInfo);
      }
    }

    if (updateInfos.length === 0) {
      context.ui.addItem(
        {
          type: MessageType.INFO,
          text: 'No skills to update.',
        },
        Date.now(),
      );
      return;
    }
  } catch (error) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: getErrorMessage(error),
      },
      Date.now(),
    );
  } finally {
    context.ui.addItem(
      {
        type: MessageType.SKILLS_LIST,
      },
      Date.now(),
    );
    context.ui.setPendingItem(null);
  }
}

const listSkillsCommand: SlashCommand = {
  name: 'list',
  get description() {
    return t('List active skills');
  },
  kind: CommandKind.BUILT_IN,
  action: listAction,
};

const updateSkillsCommand: SlashCommand = {
  name: 'update',
  get description() {
    return t('Update skills. Usage: update <skill-names>|--all');
  },
  kind: CommandKind.BUILT_IN,
  action: updateAction,
  completion: async (context, partialArg) => {
    const skills = context.services.config?.getSkills() ?? [];
    const skillNames = skills.map((skill) => skill.name);
    const suggestions = skillNames.filter((name) => name.startsWith(partialArg));

    if ('--all'.startsWith(partialArg) || 'all'.startsWith(partialArg)) {
      suggestions.unshift('--all');
    }

    return suggestions;
  },
};

export const skillsCommand: SlashCommand = {
  name: 'skills',
  get description() {
    return t('Manage skills');
  },
  kind: CommandKind.BUILT_IN,
  subCommands: [listSkillsCommand, updateSkillsCommand],
  action: (context, args) => listSkillsCommand.action!(context, args),
};
