/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */
// @vitest-environment node

import * as fsPromises from 'node:fs/promises';
import mock from 'mock-fs';
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
  afterEach(() => {
    mock.restore();
  });

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

  it('exports jsonl artifacts with /chat export', async () => {
    const exportSubcommand = getSubCommand('export');
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
                { role: 'user', parts: [{ text: 'hello' }] },
                {
                  role: 'model',
                  parts: [
                    { text: 'hi there' },
                    {
                      functionCall: {
                        id: '1',
                        name: 'read_file',
                        args: { path: 'README.md' },
                      },
                    },
                  ],
                },
              ],
            }),
          }),
        },
      },
    });

    const result = await exportSubcommand.action?.(context, '/tmp/out.jsonl');
    expect(result?.type).toBe('message');
    if (result?.type === 'message') {
      expect(result.messageType).toBe('info');
      expect(result.content).toContain('Conversation exported to');
      expect(result.content).toContain('(jsonl)');
    }
    const exported = await fsPromises.readFile('/tmp/out.jsonl', 'utf-8');
    expect(exported).toContain('"type":"chat_turn"');
    expect(exported).toContain('"role":"user"');
    expect(exported).toContain('"role":"model"');
    expect(exported).toContain('"toolCalls"');
  });

  it('rejects unsupported /chat export formats', async () => {
    const exportSubcommand = getSubCommand('export');
    const context = createMockCommandContext();

    const result = await exportSubcommand.action?.(context, 'out.txt');
    expect(result).toEqual({
      type: 'message',
      messageType: 'error',
      content: 'Invalid export format. Use one of: .jsonl, .html, .md, .json',
    });
  });
});
