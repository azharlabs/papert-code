/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { render } from 'ink-testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SkillUpdateState } from '../../state/skills.js';
import { SkillsList } from './SkillsList.js';
import * as UIStateContext from '../../contexts/UIStateContext.js';
import * as SkillConfig from '../../../config/skill.js';

vi.mock('../../contexts/UIStateContext.js', async (importOriginal) => {
  const actual = await importOriginal<typeof UIStateContext>();
  return {
    ...actual,
    useUIState: vi.fn(),
  };
});

vi.mock('../../../config/skill.js', async (importOriginal) => {
  const actual = await importOriginal<typeof SkillConfig>();
  return {
    ...actual,
    getDiscoverableSkills: vi.fn(),
  };
});

const useUIStateMock = vi.mocked(UIStateContext.useUIState);
const getDiscoverableSkillsMock = vi.mocked(SkillConfig.getDiscoverableSkills);

describe('<SkillsList />', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useUIStateMock.mockReturnValue({
      commandContext: {
        services: {
          config: {
            getWorkingDir: () => '/workspace',
            getSkills: () => [],
          },
        },
      },
      skillsUpdateState: new Map(),
    } as unknown as ReturnType<typeof UIStateContext.useUIState>);
  });

  it('shows empty state when no skills are discoverable', () => {
    getDiscoverableSkillsMock.mockReturnValue([]);

    const { lastFrame } = render(<SkillsList />);
    expect(lastFrame()).toContain('No skills installed.');
  });

  it('lists discoverable skills and marks active state from session config', () => {
    getDiscoverableSkillsMock.mockReturnValue([
      {
        path: '/tmp/skill-default',
        config: { name: 'default-skill', version: '1.0.0' },
        contextFiles: [],
      },
      {
        path: '/tmp/skill-local',
        config: { name: 'local-skill', version: '2.0.0' },
        contextFiles: [],
      },
    ] as ReturnType<typeof SkillConfig.getDiscoverableSkills>);

    useUIStateMock.mockReturnValue({
      commandContext: {
        services: {
          config: {
            getWorkingDir: () => '/workspace',
            getSkills: () => [{ name: 'default-skill' }],
          },
        },
      },
      skillsUpdateState: new Map([
        ['default-skill', SkillUpdateState.UP_TO_DATE],
        ['local-skill', SkillUpdateState.NOT_UPDATABLE],
      ]),
    } as unknown as ReturnType<typeof UIStateContext.useUIState>);

    const { lastFrame } = render(<SkillsList />);
    const output = lastFrame();

    expect(output).toContain('Installed skills:');
    expect(output).toContain('default-skill (v1.0.0) - active');
    expect(output).toContain('local-skill (v2.0.0) - disabled');
  });
});

