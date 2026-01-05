/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GeminiCLISkill } from '@papert-code/papert-code-core';
import { getErrorMessage } from '../../utils/errors.js';
import {
  SkillUpdateState,
  skillUpdatesReducer,
  initialSkillUpdatesState,
} from '../state/skills.js';
import { useCallback, useEffect, useMemo, useReducer } from 'react';
import type { UseHistoryManagerReturn } from './useHistoryManager.js';
import { MessageType, type ConfirmationRequest } from '../types.js';
import {
  checkForAllSkillUpdates,
  updateSkill,
} from '../../config/skills/update.js';
import { requestConsentInteractive } from '../../config/skill.js';
import { checkExhaustive } from '../../utils/checks.js';

type ConfirmationRequestWrapper = {
  prompt: React.ReactNode;
  onConfirm: (confirmed: boolean) => void;
};

type ConfirmationRequestAction =
  | { type: 'add'; request: ConfirmationRequestWrapper }
  | { type: 'remove'; request: ConfirmationRequestWrapper };

function confirmationRequestsReducer(
  state: ConfirmationRequestWrapper[],
  action: ConfirmationRequestAction,
): ConfirmationRequestWrapper[] {
  switch (action.type) {
    case 'add':
      return [...state, action.request];
    case 'remove':
      return state.filter((r) => r !== action.request);
    default:
      checkExhaustive(action);
      return state;
  }
}

export const useSkillUpdates = (
  skills: GeminiCLISkill[],
  addItem: UseHistoryManagerReturn['addItem'],
  cwd: string,
) => {
  const [skillsUpdateState, dispatchSkillStateUpdate] = useReducer(
    skillUpdatesReducer,
    initialSkillUpdatesState,
  );
  const [confirmUpdateSkillRequests, dispatchConfirmUpdateSkillRequests] =
    useReducer(confirmationRequestsReducer, []);
  const addConfirmUpdateSkillRequest = useCallback(
    (original: ConfirmationRequest) => {
      const wrappedRequest = {
        prompt: original.prompt,
        onConfirm: (confirmed: boolean) => {
          dispatchConfirmUpdateSkillRequests({
            type: 'remove',
            request: wrappedRequest,
          });
          original.onConfirm(confirmed);
        },
      };
      dispatchConfirmUpdateSkillRequests({
        type: 'add',
        request: wrappedRequest,
      });
    },
    [dispatchConfirmUpdateSkillRequests],
  );

  useEffect(() => {
    (async () => {
      await checkForAllSkillUpdates(skills, dispatchSkillStateUpdate);
    })();
  }, [skills, skills.length, dispatchSkillStateUpdate]);

  useEffect(() => {
    if (skillsUpdateState.batchChecksInProgress > 0) {
      return;
    }

    let skillsWithUpdatesCount = 0;
    for (const skill of skills) {
      const currentState = skillsUpdateState.skillStatuses.get(skill.name);
      if (
        !currentState ||
        currentState.processed ||
        currentState.status !== SkillUpdateState.UPDATE_AVAILABLE
      ) {
        continue;
      }

      dispatchSkillStateUpdate({
        type: 'SET_PROCESSED',
        payload: { name: skill.name, processed: true },
      });

      if (skill.installMetadata?.autoUpdate) {
        updateSkill(
          skill,
          cwd,
          (description) =>
            requestConsentInteractive(description, addConfirmUpdateSkillRequest),
          currentState.status,
          dispatchSkillStateUpdate,
        )
          .then((result) => {
            if (!result) return;
            addItem(
              {
                type: MessageType.INFO,
                text: `Skill "${skill.name}" successfully updated: ${result.originalVersion} → ${result.updatedVersion}.`,
              },
              Date.now(),
            );
          })
          .catch((error) => {
            addItem(
              {
                type: MessageType.ERROR,
                text: getErrorMessage(error),
              },
              Date.now(),
            );
          });
      } else {
        skillsWithUpdatesCount++;
      }
    }
    if (skillsWithUpdatesCount > 0) {
      const s = skillsWithUpdatesCount > 1 ? 's' : '';
      addItem(
        {
          type: MessageType.INFO,
          text: `You have ${skillsWithUpdatesCount} skill${s} with an update available, run "/skills list" for more information.`,
        },
        Date.now(),
      );
    }
  }, [skills, skillsUpdateState, addConfirmUpdateSkillRequest, addItem, cwd]);

  const skillsUpdateStateComputed = useMemo(() => {
    const result = new Map<string, SkillUpdateState>();
    for (const [key, value] of skillsUpdateState.skillStatuses.entries()) {
      result.set(key, value.status);
    }
    return result;
  }, [skillsUpdateState]);

  return {
    skillsUpdateState: skillsUpdateStateComputed,
    skillsUpdateStateInternal: skillsUpdateState.skillStatuses,
    dispatchSkillStateUpdate,
    confirmUpdateSkillRequests,
    addConfirmUpdateSkillRequest,
  };
};
