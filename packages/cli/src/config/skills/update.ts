/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type SkillUpdateAction,
  SkillUpdateState,
  type SkillUpdateStatus,
} from '../../ui/state/skills.js';
import {
  copySkill,
  installSkill,
  uninstallSkill,
  loadSkill,
  loadSkillInstallMetadata,
  SkillStorage,
  loadSkillConfig,
} from '../skill.js';
import { checkForSkillUpdate } from './github.js';
import type { GeminiCLISkill } from '@papert-code/papert-code-core';
import * as fs from 'node:fs';
import { getErrorMessage } from '../../utils/errors.js';

export interface SkillUpdateInfo {
  name: string;
  originalVersion: string;
  updatedVersion: string;
}

export async function updateSkill(
  skill: GeminiCLISkill,
  cwd: string = process.cwd(),
  requestConsent: (consent: string) => Promise<boolean>,
  currentState: SkillUpdateState,
  dispatchSkillStateUpdate: (action: SkillUpdateAction) => void,
): Promise<SkillUpdateInfo | undefined> {
  if (currentState === SkillUpdateState.UPDATING) {
    return undefined;
  }
  dispatchSkillStateUpdate({
    type: 'SET_STATE',
    payload: { name: skill.name, state: SkillUpdateState.UPDATING },
  });
  const installMetadata = loadSkillInstallMetadata(skill.path);

  if (!installMetadata?.type) {
    dispatchSkillStateUpdate({
      type: 'SET_STATE',
      payload: { name: skill.name, state: SkillUpdateState.ERROR },
    });
    throw new Error(
      `Skill ${skill.name} cannot be updated, type is unknown.`,
    );
  }
  if (installMetadata?.type === 'link') {
    dispatchSkillStateUpdate({
      type: 'SET_STATE',
      payload: { name: skill.name, state: SkillUpdateState.UP_TO_DATE },
    });
    throw new Error('Skill is linked so does not need to be updated');
  }
  const originalVersion = skill.version;

  const tempDir = await SkillStorage.createTmpDir();
  try {
    await copySkill(skill.path, tempDir);
    const previousSkillConfig = loadSkillConfig({
      skillDir: skill.path,
      workspaceDir: cwd,
    });
    await uninstallSkill(skill.name, cwd);
    await installSkill(
      installMetadata,
      requestConsent,
      cwd,
      previousSkillConfig,
    );

    const updatedSkillStorage = new SkillStorage(skill.name);
    const updatedSkill = loadSkill({
      skillDir: updatedSkillStorage.getSkillDir(),
      workspaceDir: cwd,
    });
    if (!updatedSkill) {
      dispatchSkillStateUpdate({
        type: 'SET_STATE',
        payload: { name: skill.name, state: SkillUpdateState.ERROR },
      });
      throw new Error('Updated skill not found after installation.');
    }
    const updatedVersion = updatedSkill.config.version;
    dispatchSkillStateUpdate({
      type: 'SET_STATE',
      payload: {
        name: skill.name,
        state: SkillUpdateState.UPDATED_NEEDS_RESTART,
      },
    });
    return {
      name: skill.name,
      originalVersion,
      updatedVersion,
    };
  } catch (e) {
    console.error(`Error updating skill, rolling back. ${getErrorMessage(e)}`);
    dispatchSkillStateUpdate({
      type: 'SET_STATE',
      payload: { name: skill.name, state: SkillUpdateState.ERROR },
    });
    await copySkill(tempDir, skill.path);
    throw e;
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
}

export async function updateAllUpdatableSkills(
  cwd: string = process.cwd(),
  requestConsent: (consent: string) => Promise<boolean>,
  skills: GeminiCLISkill[],
  skillsState: Map<string, SkillUpdateStatus>,
  dispatch: (action: SkillUpdateAction) => void,
): Promise<SkillUpdateInfo[]> {
  return (
    await Promise.all(
      skills
        .filter(
          (skill) =>
            skillsState.get(skill.name)?.status ===
            SkillUpdateState.UPDATE_AVAILABLE,
        )
        .map((skill) =>
          updateSkill(
            skill,
            cwd,
            requestConsent,
            skillsState.get(skill.name)!.status,
            dispatch,
          ),
        ),
    )
  ).filter((updateInfo) => !!updateInfo);
}

export interface SkillUpdateCheckResult {
  state: SkillUpdateState;
  error?: string;
}

export async function checkForAllSkillUpdates(
  skills: GeminiCLISkill[],
  dispatch: (action: SkillUpdateAction) => void,
): Promise<void> {
  dispatch({ type: 'BATCH_CHECK_START' });
  const promises: Array<Promise<void>> = [];
  for (const skill of skills) {
    if (!skill.installMetadata) {
      dispatch({
        type: 'SET_STATE',
        payload: {
          name: skill.name,
          state: SkillUpdateState.NOT_UPDATABLE,
        },
      });
      continue;
    }
    promises.push(
      checkForSkillUpdate(skill, (updatedState) => {
        dispatch({
          type: 'SET_STATE',
          payload: { name: skill.name, state: updatedState },
        });
      }),
    );
  }
  await Promise.all(promises);
  dispatch({ type: 'BATCH_CHECK_END' });
}
