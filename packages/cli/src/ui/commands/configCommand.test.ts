/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from 'vitest';
import { configCommand } from './configCommand.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import { CommandKind } from './types.js';
import type { LoadedSettings } from '../../config/settings.js';

function createSettingsMock(): LoadedSettings {
  return {
    merged: {
      tools: {
        approvalMode: 'default',
      },
    },
    isTrusted: true,
    system: {
      settings: {},
    },
    systemDefaults: {
      settings: {},
    },
    user: {
      settings: {
        tools: {
          approvalMode: 'plan',
        },
      },
    },
    workspace: {
      settings: {
        tools: {
          approvalMode: 'default',
        },
      },
    },
    setValue: vi.fn(),
  } as unknown as LoadedSettings;
}

describe('configCommand', () => {
  it('has expected metadata', () => {
    expect(configCommand.name).toBe('config');
    expect(configCommand.kind).toBe(CommandKind.BUILT_IN);
  });

  it('returns usage error for unsupported args', async () => {
    const context = createMockCommandContext();
    const result = await configCommand.action?.(context, '');

    expect(result).toEqual({
      type: 'message',
      messageType: 'error',
      content: 'Usage: /config explain [key] [--json]',
    });
  });

  it('renders explain output for a filtered key', async () => {
    const context = createMockCommandContext({
      services: {
        settings: createSettingsMock(),
      },
    });

    const result = await configCommand.action?.(
      context,
      'explain tools.approvalMode',
    );

    expect(result).toEqual(
      expect.objectContaining({
        type: 'message',
        messageType: 'info',
      }),
    );
    const content = (result as { content: string }).content;
    expect(content).toContain('Effective configuration report');
    expect(content).toContain('- tools.approvalMode');
    expect(content).toContain('source: workspace');
    expect(content).toContain('contributors: user, workspace');
  });

  it('supports --json output', async () => {
    const context = createMockCommandContext({
      services: {
        settings: createSettingsMock(),
      },
    });

    const result = await configCommand.action?.(
      context,
      'explain tools.approvalMode --json',
    );
    const content = (result as { content: string }).content;
    const parsed = JSON.parse(content) as {
      trustedWorkspace: boolean;
      keyFilter: string | null;
      entries: Array<{ key: string; source: string }>;
    };

    expect(parsed.trustedWorkspace).toBe(true);
    expect(parsed.keyFilter).toBe('tools.approvalMode');
    expect(parsed.entries[0]?.key).toBe('tools.approvalMode');
    expect(parsed.entries[0]?.source).toBe('workspace');
  });

  it('returns no-match message when key filter has no entries', async () => {
    const context = createMockCommandContext({
      services: {
        settings: createSettingsMock(),
      },
    });

    const result = await configCommand.action?.(context, 'explain missing.key');
    expect((result as { content: string }).content).toContain(
      'No configuration keys matched the requested filter.',
    );
  });

  it('offers completion candidates', async () => {
    const context = createMockCommandContext();
    expect(await configCommand.completion?.(context, '')).toEqual([
      'explain',
      'explain --json',
    ]);
    expect(await configCommand.completion?.(context, 'explain --j')).toEqual([
      'explain --json',
    ]);
  });
});

