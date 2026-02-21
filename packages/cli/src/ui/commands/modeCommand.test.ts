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
import { loadCustomModes } from '../../modes/customModes.js';

vi.mock('../../modes/customModes.js', () => ({
  loadCustomModes: vi.fn().mockResolvedValue([]),
}));

describe('modeCommand', () => {
  let mockContext: CommandContext;
  const setModeProfile = vi.fn();
  const setApprovalMode = vi.fn();
  const setValue = vi.fn();

  beforeEach(() => {
    setModeProfile.mockReset();
    setApprovalMode.mockReset();
    setValue.mockReset();
    vi.mocked(loadCustomModes).mockResolvedValue([]);
    mockContext = createMockCommandContext({
      services: {
        config: {
          getModeProfile: () => undefined,
          getApprovalMode: () => ApprovalMode.DEFAULT,
          setModeProfile,
          setApprovalMode,
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

  it('switches to markdown-defined custom mode by applying approval mode', async () => {
    vi.mocked(loadCustomModes).mockResolvedValue([
      {
        name: 'ship-fast',
        description: 'Custom mode',
        approvalMode: ApprovalMode.AUTO_EDIT,
        source: 'project',
        filePath: '/tmp/project/.papert/modes/ship-fast.md',
      },
    ]);

    const result = await modeCommand.action?.(mockContext, 'ship-fast');
    expect(setModeProfile).toHaveBeenCalledWith(undefined);
    expect(setApprovalMode).toHaveBeenCalledWith(ApprovalMode.AUTO_EDIT);
    expect(result).toEqual(
      expect.objectContaining({
        type: 'message',
        messageType: 'info',
      }),
    );
  });
});
