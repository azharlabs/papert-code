/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Config } from '@papert-code/papert-code-core';
import { ApprovalMode } from '@papert-code/papert-code-core';
import { SettingScope, type LoadedSettings } from '../../config/settings.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import type { CommandContext } from './types.js';
import { modeCommand } from './modeCommand.js';

describe('modeCommand', () => {
  let mockContext: CommandContext;
  const setModeProfile = vi.fn();
  const setValue = vi.fn();

  beforeEach(() => {
    setModeProfile.mockReset();
    setValue.mockReset();
    mockContext = createMockCommandContext({
      services: {
        config: {
          getModeProfile: () => undefined,
          getApprovalMode: () => ApprovalMode.DEFAULT,
          setModeProfile,
        } as unknown as Config,
        settings: {
          merged: {},
          setValue,
          forScope: () => ({}),
        } as unknown as LoadedSettings,
      },
    });
  });

  it('shows mode summary when no args are provided', async () => {
    const result = await modeCommand.action?.(mockContext, '');
    expect(result).toEqual(
      expect.objectContaining({
        type: 'message',
        messageType: 'info',
      }),
    );
    if (result?.type === 'message') {
      expect(result.content).toContain('Current mode profile: none');
      expect(result.content).toContain('Available profiles:');
    }
  });

  it('switches mode profile for the current session', async () => {
    const result = await modeCommand.action?.(mockContext, 'build');
    expect(setModeProfile).toHaveBeenCalledWith('build');
    expect(setValue).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        type: 'message',
        messageType: 'info',
      }),
    );
  });

  it('persists mode profile when using --project scope', async () => {
    await modeCommand.action?.(mockContext, 'review --project');
    expect(setModeProfile).toHaveBeenCalledWith('review');
    expect(setValue).toHaveBeenCalledWith(
      SettingScope.Workspace,
      'tools.modeProfile',
      'review',
    );
    expect(setValue).toHaveBeenCalledWith(
      SettingScope.Workspace,
      'tools.approvalMode',
      ApprovalMode.DEFAULT,
    );
  });

  it('returns error for unknown mode profile', async () => {
    const result = await modeCommand.action?.(mockContext, 'invalid-profile');
    expect(setModeProfile).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        type: 'message',
        messageType: 'error',
      }),
    );
  });

  it('completes known profile names and flags', async () => {
    const completions = await modeCommand.completion?.(mockContext, 're');
    expect(completions).toContain('review');
  });
});

