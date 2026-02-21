/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import { useUIState } from '../../contexts/UIStateContext.js';
import { SkillUpdateState } from '../../state/skills.js';
import { getDiscoverableSkills } from '../../../config/skill.js';

export const SkillsList = () => {
  const { commandContext, skillsUpdateState } = useUIState();
  const config = commandContext.services.config;
  const workspaceDir = config?.getWorkingDir() ?? process.cwd();
  const discoverableSkills = getDiscoverableSkills(workspaceDir);
  const activeSkillNames = new Set(
    (config?.getSkills() ?? []).map((skill) => skill.name),
  );

  if (discoverableSkills.length === 0) {
    return <Text>No skills installed.</Text>;
  }

  return (
    <Box flexDirection="column" marginTop={1} marginBottom={1}>
      <Text>Installed skills:</Text>
      <Box flexDirection="column" paddingLeft={2}>
        {discoverableSkills.map((skill) => {
          const state = skillsUpdateState.get(skill.config.name);
          const activeString = activeSkillNames.has(skill.config.name)
            ? 'active'
            : 'disabled';

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
            <Box key={skill.config.name}>
              <Text>
                <Text color="cyan">{`${skill.config.name} (v${skill.config.version})`}</Text>
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
