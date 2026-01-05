/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import { useUIState } from '../../contexts/UIStateContext.js';
import { SkillUpdateState } from '../../state/skills.js';

export const SkillsList = () => {
  const { commandContext, skillsUpdateState } = useUIState();
  const allSkills = commandContext.services.config!.getSkills();

  if (allSkills.length === 0) {
    return <Text>No skills installed.</Text>;
  }

  return (
    <Box flexDirection="column" marginTop={1} marginBottom={1}>
      <Text>Installed skills:</Text>
      <Box flexDirection="column" paddingLeft={2}>
        {allSkills.map((skill) => {
          const state = skillsUpdateState.get(skill.name);
          const activeString = skill.isActive ? 'active' : 'disabled';

          let stateColor = 'gray';
          const stateText = state || 'unknown state';

          switch (state) {
            case SkillUpdateState.CHECKING_FOR_UPDATES:
            case SkillUpdateState.UPDATING:
              stateColor = 'cyan';
              break;
            case SkillUpdateState.UPDATE_AVAILABLE:
            case SkillUpdateState.UPDATED_NEEDS_RESTART:
              stateColor = 'yellow';
              break;
            case SkillUpdateState.ERROR:
              stateColor = 'red';
              break;
            case SkillUpdateState.UP_TO_DATE:
            case SkillUpdateState.NOT_UPDATABLE:
              stateColor = 'green';
              break;
            default:
              console.error(`Unhandled SkillUpdateState ${state}`);
              break;
          }

          return (
            <Box key={skill.name}>
              <Text>
                <Text color="cyan">{`${skill.name} (v${skill.version})`}</Text>
                {` - ${activeString}`}
                {<Text color={stateColor}>{` (${stateText})`}</Text>}
              </Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
