/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { rm, mkdtemp } from 'node:fs/promises';
import { TaskScheduler } from '@papert-code/papert-code-core';
import type { IControlContext } from '../ControlContext.js';
import type { IPendingRequestRegistry } from './baseController.js';
import { SchedulerController } from './schedulerController.js';

function createRegistry(): IPendingRequestRegistry {
  return {
    registerIncomingRequest: vi.fn(),
    deregisterIncomingRequest: vi.fn(),
    registerOutgoingRequest: vi.fn(),
    deregisterOutgoingRequest: vi.fn(),
  };
}

function createContext(cwd: string): IControlContext {
  const abortController = new AbortController();
  return {
    config: {
      getWorkingDir: vi.fn(() => cwd),
    } as unknown as IControlContext['config'],
    streamJson: {
      send: vi.fn(),
      emitSystemMessage: vi.fn(),
    } as unknown as IControlContext['streamJson'],
    sessionId: 'test-session',
    abortSignal: abortController.signal,
    debugMode: false,
    permissionMode: 'default',
    sdkMcpServers: new Set(),
    mcpClients: new Map(),
  };
}

describe('SchedulerController', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'scheduler-controller-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('auto-starts scheduler when adding a job', async () => {
    const startSpy = vi
      .spyOn(TaskScheduler.prototype, 'start')
      .mockResolvedValue(undefined);

    const context = createContext(tmpDir);
    const controller = new SchedulerController(
      context,
      createRegistry(),
      'SchedulerController',
    );

    await controller.handleRequest(
      {
        subtype: 'scheduler_add',
        cwd: tmpDir,
        job: {
          name: 'heartbeat',
          schedule: { kind: 'every', everyMs: 60_000 },
          payload: { kind: 'heartbeat', text: 'hi' },
        },
      },
      'req-add',
    );

    expect(startSpy).toHaveBeenCalledTimes(1);
  });

  it('emits scheduler_event system messages for scheduler activity', async () => {
    const context = createContext(tmpDir);
    const controller = new SchedulerController(
      context,
      createRegistry(),
      'SchedulerController',
    );

    const addResponse = await controller.handleRequest(
      {
        subtype: 'scheduler_add',
        cwd: tmpDir,
        job: {
          name: 'heartbeat',
          schedule: { kind: 'every', everyMs: 60_000 },
          payload: { kind: 'heartbeat', text: 'hi' },
        },
      },
      'req-add-events',
    );

    const job = addResponse['job'] as { id: string };
    await controller.handleRequest(
      {
        subtype: 'scheduler_run',
        cwd: tmpDir,
        id: job.id,
        mode: 'force',
      },
      'req-run-events',
    );

    const emitSystemMessage = context.streamJson
      .emitSystemMessage as unknown as ReturnType<typeof vi.fn>;
    expect(emitSystemMessage).toHaveBeenCalled();

    const eventCalls = emitSystemMessage.mock.calls.filter(
      (call) => call[0] === 'scheduler_event',
    );
    expect(eventCalls.length).toBeGreaterThan(0);

    const actions = eventCalls
      .map((call) => call[1]?.event?.action)
      .filter(Boolean);
    expect(actions).toContain('added');
    expect(actions).toContain('finished');
  });
});

