/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */
// @vitest-environment node

import * as fsPromises from 'node:fs/promises';
import mock from 'mock-fs';
import { afterEach, describe, expect, it } from 'vitest';
import { exportCommand } from './exportCommand.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';

describe('exportCommand', () => {
  afterEach(() => {
    mock.restore();
  });

  it('exports markdown artifacts from /export', async () => {
    mock({
      '/tmp': {},
    });
    const context = createMockCommandContext({
      services: {
        config: {
          getGeminiClient: () => ({
            getChat: () => ({
              getHistory: () => [
                { role: 'system', parts: [{ text: 'bootstrap' }] },
                { role: 'user', parts: [{ text: 'Summarize release risk' }] },
                { role: 'model', parts: [{ text: 'Top risks are ...' }] },
              ],
            }),
          }),
        },
      },
    });

    const result = await exportCommand.action?.(context, '/tmp/dataset.md');
    expect(result?.type).toBe('message');
    if (result?.type === 'message') {
      expect(result.messageType).toBe('info');
      expect(result.content).toContain('(md)');
    }
    const output = await fsPromises.readFile('/tmp/dataset.md', 'utf-8');
    expect(output).toContain('# Papert Conversation Export');
    expect(output).toContain('Structured prompt-replay artifact generated via `/export`.');
  });
});
