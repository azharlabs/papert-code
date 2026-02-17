/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { SubagentTeamManager } from './team-manager.js';
import type { Config } from '../config/config.js';

describe('SubagentTeamManager', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'papert-team-manager-'));
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
              agents: [
                { name: 'coder', model: 'papert-2.5-pro' },
                { name: 'reviewer', workspace: 'review-zone' },
              ],
              allowlist: ['alice'],
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

  function makeConfig(): Config {
    return {
      getProjectRoot: () => projectRoot,
    } as Config;
  }

  it('loads team by id and name', async () => {
    const manager = new SubagentTeamManager(makeConfig());
    const byId = await manager.loadTeam('dev');
    const byName = await manager.loadTeam('development team');
    expect(byId?.leader).toBe('coder');
    expect(byName?.id).toBe('dev');
  });

  it('returns per-agent model/workspace overrides', async () => {
    const manager = new SubagentTeamManager(makeConfig());
    const team = await manager.loadTeam('dev');
    expect(team).toBeTruthy();
    expect(manager.getTeamAgentModel(team!, 'coder')).toBe('papert-2.5-pro');
    expect(manager.getTeamAgentWorkspace(team!, 'reviewer')).toBe('review-zone');
  });

  it('enforces allowlist', async () => {
    const manager = new SubagentTeamManager(makeConfig());
    const team = await manager.loadTeam('dev');
    expect(() => manager.ensureSenderAllowed(team!, 'alice')).not.toThrow();
    expect(() => manager.ensureSenderAllowed(team!, 'bob')).toThrow(
      /not allowed/,
    );
  });
});
