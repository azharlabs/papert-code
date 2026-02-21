/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */
// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildConfigExplainEntries, configCommand } from './config.js';
import { loadSettings } from '../config/settings.js';

vi.mock('../config/settings.js', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../config/settings.js')>();
  return {
    ...original,
    loadSettings: vi.fn(),
  };
});

describe('config command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds precedence-aware explain entries', () => {
    const entries = buildConfigExplainEntries({
      isTrusted: true,
      merged: {
        general: { releaseChannel: 'preview' },
        tools: { sandbox: false },
        ui: { theme: 'workspace-theme' },
      },
      systemDefaults: {
        settings: {
          general: { releaseChannel: 'stable' },
          tools: { sandbox: true },
        },
      },
      user: {
        settings: {
          general: { releaseChannel: 'preview' },
          ui: { theme: 'light' },
        },
      },
      workspace: {
        settings: {
          ui: { theme: 'workspace-theme' },
          tools: { sandbox: true },
        },
      },
      system: {
        settings: {
          tools: { sandbox: false },
        },
      },
    });

    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'general.releaseChannel',
          source: 'user',
          contributors: ['system-defaults', 'user'],
        }),
        expect.objectContaining({
          key: 'ui.theme',
          source: 'workspace',
          contributors: ['user', 'workspace'],
        }),
        expect.objectContaining({
          key: 'tools.sandbox',
          source: 'system',
          contributors: ['system-defaults', 'workspace', 'system'],
        }),
      ]),
    );
  });

  it('ignores workspace contributors when workspace is not trusted', () => {
    const entries = buildConfigExplainEntries({
      isTrusted: false,
      merged: {
        ui: { theme: 'light' },
      },
      systemDefaults: {
        settings: {},
      },
      user: {
        settings: {
          ui: { theme: 'light' },
        },
      },
      workspace: {
        settings: {
          ui: { theme: 'workspace-theme' },
        },
      },
      system: {
        settings: {},
      },
    });

    expect(entries).toEqual([
      expect.objectContaining({
        key: 'ui.theme',
        source: 'user',
        contributors: ['user'],
      }),
    ]);
  });

  it('supports key filter', () => {
    const entries = buildConfigExplainEntries(
      {
        isTrusted: true,
        merged: {
          general: { releaseChannel: 'stable' },
          ui: { theme: 'dark' },
        },
        systemDefaults: { settings: {} },
        user: { settings: { general: { releaseChannel: 'stable' } } },
        workspace: { settings: {} },
        system: { settings: {} },
      },
      'general',
    );

    expect(entries).toEqual([
      expect.objectContaining({ key: 'general.releaseChannel' }),
    ]);
  });

  it('prints json explain output', async () => {
    const loadSettingsMock = vi.mocked(loadSettings);
    loadSettingsMock.mockReturnValue({
      isTrusted: true,
      merged: { general: { releaseChannel: 'stable' } },
      systemDefaults: { settings: {} },
      user: { settings: { general: { releaseChannel: 'stable' } } },
      workspace: { settings: {} },
      system: { settings: {} },
    } as unknown as ReturnType<typeof loadSettings>);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await configCommand.handler?.({
      action: 'explain',
      key: 'general',
      json: true,
    } as never);

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('"entries"'),
    );
    logSpy.mockRestore();
  });
});
