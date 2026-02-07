/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */
// @vitest-environment node

import { describe, it, expect } from 'vitest';
import { chatCommand } from './chatCommand.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';

function getSubCommand(name: string) {
  const subCommand = chatCommand.subCommands?.find((cmd) => cmd.name === name);
  if (!subCommand?.action) {
    throw new Error(`Missing sub-command action: ${name}`);
  }
  return subCommand;
}

describe('chatCommand', () => {
  it('opens session browser for /chat list', async () => {
    const context = createMockCommandContext();
    const list = getSubCommand('list');

    const result = await list.action?.(context, '');
    expect(result).toEqual({
      type: 'dialog',
      dialog: 'sessionBrowser',
    });
  });

  it('opens session browser for /chat resume without tag', async () => {
    const context = createMockCommandContext();
    const resume = getSubCommand('resume');

    const result = await resume.action?.(context, '');
    expect(result).toEqual({
      type: 'dialog',
      dialog: 'sessionBrowser',
    });
  });
});
