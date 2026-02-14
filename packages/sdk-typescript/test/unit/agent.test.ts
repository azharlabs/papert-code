import { EventEmitter } from 'node:events';
import * as path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const spawnMock = vi.fn();
const findNativeCliPathMock = vi.fn(() => 'papert');
const prepareSpawnInfoMock = vi.fn((input?: string) => ({
  command: input || 'papert',
  args: [],
  type: 'native' as const,
  originalInput: input || 'papert',
}));

vi.mock('node:child_process', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

vi.mock('../../src/utils/cliPath.js', () => ({
  findNativeCliPath: () => findNativeCliPathMock(),
  prepareSpawnInfo: (input?: string) => prepareSpawnInfoMock(input),
}));

import { createPapertAgent } from '../../src/agent.js';

function makeFakeProcess() {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  return proc;
}

describe('createPapertAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('spawns native papert command when cliBinaryPath is a command name', async () => {
    spawnMock.mockImplementation(() => {
      const proc = makeFakeProcess();
      setImmediate(() => {
        proc.stdout.emit('data', Buffer.from('ok\\n'));
        proc.emit('close', 0);
      });
      return proc;
    });

    const agent = await createPapertAgent({
      cliBinaryPath: 'papert',
      cliArgs: { approvalMode: 'auto-edit' },
    });
    const result = await agent.runPrompt('hello');

    expect(prepareSpawnInfoMock).toHaveBeenCalledWith('papert');
    expect(spawnMock).toHaveBeenCalledWith(
      'papert',
      expect.arrayContaining(['--prompt', 'hello', '--approval-mode', 'auto-edit']),
      expect.objectContaining({ stdio: ['ignore', 'pipe', 'pipe'] }),
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('ok');
  });

  it('uses findNativeCliPath when cliBinaryPath is not provided', async () => {
    spawnMock.mockImplementation(() => {
      const proc = makeFakeProcess();
      setImmediate(() => proc.emit('close', 0));
      return proc;
    });

    const agent = await createPapertAgent();
    await agent.runPrompt('hello');

    expect(findNativeCliPathMock).toHaveBeenCalledTimes(1);
    expect(prepareSpawnInfoMock).toHaveBeenCalledWith('papert');
  });

  it('passes skillsPath through PAPERT_CODE_SKILLS_PATHS env', async () => {
    spawnMock.mockImplementation(() => {
      const proc = makeFakeProcess();
      setImmediate(() => proc.emit('close', 0));
      return proc;
    });

    const agent = await createPapertAgent({
      skillsPath: ['/tmp/skills-a', '/tmp/skills-b'],
    });
    await agent.runPrompt('hello');

    const spawnOptions = spawnMock.mock.calls[0][2] as {
      env?: Record<string, string>;
    };
    const raw = spawnOptions.env?.PAPERT_CODE_SKILLS_PATHS || '';
    const parts = raw.split(path.delimiter).filter(Boolean);
    expect(parts).toContain('/tmp/skills-a');
    expect(parts).toContain('/tmp/skills-b');
  });
});
