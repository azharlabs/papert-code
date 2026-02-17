/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { parseInitialAgentPrefix, parseTeamHandoffs } from './mention-parser.js';

describe('mention-parser', () => {
  it('parses @agent prefix from initial prompt', () => {
    const parsed = parseInitialAgentPrefix('@reviewer Please verify auth flow');
    expect(parsed.agent).toBe('reviewer');
    expect(parsed.message).toBe('Please verify auth flow');
  });

  it('returns original message when no prefix exists', () => {
    const parsed = parseInitialAgentPrefix('Please verify auth flow');
    expect(parsed.agent).toBeUndefined();
    expect(parsed.message).toBe('Please verify auth flow');
  });

  it('parses bracket handoffs and strips tags', () => {
    const parsed = parseTeamHandoffs(
      'I fixed the bug. [@reviewer: check diff] [@writer: update docs]',
      new Set(['reviewer', 'writer']),
    );

    expect(parsed.cleanedResponse).toBe('I fixed the bug.');
    expect(parsed.handoffs).toEqual([
      { toAgent: 'reviewer', message: 'check diff' },
      { toAgent: 'writer', message: 'update docs' },
    ]);
  });
});
