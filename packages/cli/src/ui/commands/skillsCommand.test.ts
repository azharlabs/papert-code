/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { skillsCommand, SKILLS_INVOCATION_POLICY } from './skillsCommand.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import { MessageType } from '../types.js';

describe('skillsCommand', () => {
  it('defaults to listing skills', async () => {
    const context = createMockCommandContext();
    await skillsCommand.action?.(context, '');

    expect(context.ui.addItem).toHaveBeenCalledWith(
      { type: MessageType.SKILLS_LIST },
      expect.any(Number),
    );
  });

  it('shows policy text via /skills policy', async () => {
    const context = createMockCommandContext();
    const policySubcommand = skillsCommand.subCommands?.find(
      (command) => command.name === 'policy',
    );
    expect(policySubcommand).toBeDefined();
    await policySubcommand?.action?.(context, '');

    expect(context.ui.addItem).toHaveBeenCalledWith(
      {
        type: MessageType.INFO,
        text: SKILLS_INVOCATION_POLICY,
      },
      expect.any(Number),
    );
  });

  it('suggests --all for update completion', async () => {
    const updateSubcommand = skillsCommand.subCommands?.find(
      (command) => command.name === 'update',
    );
    if (!updateSubcommand?.completion) {
      throw new Error('Missing update completion');
    }
    const context = createMockCommandContext({
      services: {
        config: {
          getSkills: () => [{ name: 'code-review' }, { name: 'security' }],
        },
      },
    });
    const suggestions = await updateSubcommand.completion(context, '--');
    expect(suggestions).toContain('--all');
  });
});
