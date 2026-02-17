/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { SubagentTeamExecutor } from './team-executor.js';
import type { Config } from '../config/config.js';
import type { SubagentManager } from '../subagents/subagent-manager.js';
import type { SubagentConfig } from '../subagents/types.js';

describe('SubagentTeamExecutor', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'papert-team-exec-'));
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
              maxMessages: 4,
              agents: [
                { name: 'coder', model: 'model-coder' },
                { name: 'reviewer', model: 'model-reviewer' },
              ],
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

  it('executes team handoff chain and applies per-agent model overrides', async () => {
    const loadSubagent = vi.fn(async (name: string): Promise<SubagentConfig | null> => ({
      name,
      description: `${name} agent`,
      systemPrompt: `You are ${name}`,
      level: 'project',
      modelConfig: {},
    }));

    const responseByAgent: Record<string, string> = {
      coder: 'Implemented changes. [@reviewer: review this patch]',
      reviewer: 'Reviewed and approved.',
    };
    const createSubagentScope = vi.fn(async (cfg: SubagentConfig) => ({
      async runNonInteractive() {
        return;
      },
      getFinalText() {
        return responseByAgent[cfg.name] ?? 'Done';
      },
    }));

    const subagentManager = {
      loadSubagent,
      createSubagentScope,
    } as unknown as SubagentManager;

    const executor = new SubagentTeamExecutor(makeConfig(), subagentManager);
    const result = await executor.execute({
      teamIdOrName: 'dev',
      prompt: 'Please fix auth',
    });

    expect(result.teamId).toBe('dev');
    expect(result.steps.map((s) => s.agent)).toEqual(['coder', 'reviewer']);
    expect(result.finalText).toContain('@coder: Implemented changes.');
    expect(result.finalText).toContain('@reviewer: Reviewed and approved.');

    expect(createSubagentScope).toHaveBeenCalledTimes(2);
    const firstConfig = createSubagentScope.mock.calls[0][0] as SubagentConfig;
    const secondConfig = createSubagentScope.mock.calls[1][0] as SubagentConfig;
    expect(firstConfig.modelConfig?.model).toBe('model-coder');
    expect(secondConfig.modelConfig?.model).toBe('model-reviewer');
    expect(firstConfig.systemPrompt).toContain('Team Workspace');
  });
});
