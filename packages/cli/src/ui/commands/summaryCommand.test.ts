/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { summaryCommand } from './summaryCommand.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import type { Part } from '@google/genai';

describe('summaryCommand', () => {
  it('returns an error message when config is missing', async () => {
    const context = createMockCommandContext({
      services: { config: null },
    });

    const result = await summaryCommand.action!(context, '');
    expect(result).toEqual({
      type: 'message',
      messageType: 'error',
      content: 'Config not loaded.',
    });
  });

  it('returns a submit_prompt contract for cross-mode summary generation', async () => {
    const context = createMockCommandContext({
      services: {
        config: {
          getProjectRoot: () => '/test/project',
        },
      },
    });

    const result = await summaryCommand.action!(context, '');
    expect(result).toBeDefined();
    if (!result || result.type !== 'submit_prompt') {
      throw new Error('Expected submit_prompt response');
    }
    const contentParts = Array.isArray(result.content)
      ? result.content
      : [result.content];
    const prompt = contentParts
      .map((part: Part | string) => {
        if (typeof part === 'string') {
          return part;
        }
        if ('text' in part && typeof part.text === 'string') {
          return part.text;
        }
        return '';
      })
      .join('\n');
    expect(prompt).toContain('SYSTEM CONTRACT: summary-command/v1');
    expect(prompt).toContain('Write the final markdown to `.papert/PROJECT_SUMMARY.md`.');
    expect(prompt).toContain('After writing the file, respond with a short confirmation');
  });
});
