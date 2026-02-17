/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { teamCommand } from './teamCommand.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import { MessageType } from '../types.js';

describe('teamCommand', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'papert-team-cmd-'));
    await fs.mkdir(path.join(projectRoot, '.papert'), { recursive: true });
    await fs.writeFile(
      path.join(projectRoot, '.papert', 'agent-teams.json'),
      JSON.stringify(
        {
          teams: [
            {
              id: 'dev',
              name: 'Development Team',
              leader: 'coder',
              agents: [{ name: 'coder' }, { name: 'reviewer' }],
            },
          ],
        },
        null,
        2,
      ),
      'utf8',
    );
  });

  afterEach(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  function makeContext() {
    return createMockCommandContext({
      services: {
        config: {
          getProjectRoot: () => projectRoot,
          getSubagentManager: () => ({
            listSubagents: vi
              .fn()
              .mockResolvedValue([{ name: 'coder' }, { name: 'reviewer' }]),
          }),
        },
      },
    });
  }

  it('shows help when no args', async () => {
    const context = makeContext();
    if (!teamCommand.action) throw new Error('Action not defined');
    await teamCommand.action(context, '');
    expect(context.ui.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageType.INFO,
      }),
      expect.any(Number),
    );
  });

  it('exposes subcommands for command suggestions', () => {
    const names = (teamCommand.subCommands ?? []).map((item) => item.name);
    expect(names).toEqual(
      expect.arrayContaining(['list', 'show', 'validate', 'subagents', 'help']),
    );
  });

  it('lists teams', async () => {
    const context = makeContext();
    if (!teamCommand.action) throw new Error('Action not defined');
    await teamCommand.action(context, 'list');

    expect(context.ui.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageType.INFO,
        text: expect.stringContaining('team:dev'),
      }),
      expect.any(Number),
    );
  });

  it('shows specific team', async () => {
    const context = makeContext();
    if (!teamCommand.action) throw new Error('Action not defined');
    await teamCommand.action(context, 'show dev');

    expect(context.ui.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageType.INFO,
        text: expect.stringContaining('"id": "dev"'),
      }),
      expect.any(Number),
    );
  });

  it('validates team against available subagents', async () => {
    const context = makeContext();
    if (!teamCommand.action) throw new Error('Action not defined');
    await teamCommand.action(context, 'validate dev');

    expect(context.ui.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageType.INFO,
        text: expect.stringContaining('team:dev OK'),
      }),
      expect.any(Number),
    );
  });
});
