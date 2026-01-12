/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type express from 'express';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { createApp } from './app.js';
import type { TaskMetadata } from '../types.js';
import { createMockConfig } from '../utils/testing_utils.js';
import { debugLogger, type Config } from '@papert-code/papert-code-core';
import { requestApp } from './test-utils.js';

// Mock the logger to avoid polluting test output
// Comment out to help debug
vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock Task.create to avoid its complex setup
vi.mock('../agent/task.js', () => {
  class MockTask {
    id: string;
    contextId: string;
    taskState = 'submitted';
    config = {
      getContentGeneratorConfig: vi
        .fn()
        .mockReturnValue({ model: 'gemini-pro' }),
    };
    geminiClient = {
      initialize: vi.fn().mockResolvedValue(undefined),
    };
    constructor(id: string, contextId: string) {
      this.id = id;
      this.contextId = contextId;
    }
    static create = vi
      .fn()
      .mockImplementation((id, contextId) =>
        Promise.resolve(new MockTask(id, contextId)),
      );
    getMetadata = vi.fn().mockImplementation(async () => ({
      id: this.id,
      contextId: this.contextId,
      taskState: this.taskState,
      model: 'gemini-pro',
      mcpServers: [],
      availableTools: [],
    }));
  }
  return { Task: MockTask };
});

vi.mock('../config/config.js', async () => {
  const actual = await vi.importActual('../config/config.js');
  return {
    ...actual,
    loadConfig: vi
      .fn()
      .mockImplementation(async () => createMockConfig({}) as Config),
  };
});

describe('Agent Server Endpoints', () => {
  let app: express.Express;
  let testWorkspace: string;

  const createTask = (contextId: string) =>
    requestApp(app, {
      method: 'POST',
      path: '/tasks',
      body: {
        contextId,
        agentSettings: {
          kind: 'agent-settings',
          workspacePath: testWorkspace,
        },
      },
    });

  beforeAll(async () => {
    // Create a unique temporary directory for the workspace to avoid conflicts
    testWorkspace = fs.mkdtempSync(
      path.join(os.tmpdir(), 'gemini-agent-test-'),
    );
    app = await createApp();
  });

  afterAll(async () => {
    if (testWorkspace) {
      try {
        fs.rmSync(testWorkspace, { recursive: true, force: true });
      } catch (e) {
        debugLogger.warn(`Could not remove temp dir '${testWorkspace}':`, e);
      }
    }
  });

  it('should create a new task via POST /tasks', async () => {
    const response = await createTask('test-context');
    expect(response.status).toBe(201);
    expect(response.body).toBeTypeOf('string'); // Should return the task ID
  }, 7000);

  it('should get metadata for a specific task via GET /tasks/:taskId/metadata', async () => {
    const createResponse = await createTask('test-context-2');
    const taskId = createResponse.body;
    const response = await requestApp(app, {
      method: 'GET',
      path: `/tasks/${taskId}/metadata`,
    });
    expect(response.status).toBe(200);
    expect((response.body as { metadata: TaskMetadata }).metadata.id).toBe(
      taskId,
    );
  }, 6000);

  it('should get metadata for all tasks via GET /tasks/metadata', async () => {
    const createResponse = await createTask('test-context-3');
    const taskId = createResponse.body;
    const response = await requestApp(app, {
      method: 'GET',
      path: '/tasks/metadata',
    });
    expect(response.status).toBe(200);
    const metadata = response.body as TaskMetadata[];
    expect(Array.isArray(metadata)).toBe(true);
    expect(metadata.length).toBeGreaterThan(0);
    const taskMetadata = metadata.find((m) => m.id === taskId);
    expect(taskMetadata).toBeDefined();
  });

  it('should return 404 for a non-existent task', async () => {
    const response = await requestApp(app, {
      method: 'GET',
      path: '/tasks/fake-task/metadata',
    });
    expect(response.status).toBe(404);
  });

  it('should return agent metadata via GET /.well-known/agent-card.json', async () => {
    const response = await requestApp(app, {
      method: 'GET',
      path: '/.well-known/agent-card.json',
    });
    expect(response.status).toBe(200);
    expect((response.body as { name: string }).name).toBe('Papert Code Agent');
  });
});
