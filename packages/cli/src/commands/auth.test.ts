/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */
// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthType } from '@papert-code/papert-code-core';
import { authCommand, buildAuthDiagnostics } from './auth.js';
import { loadSettings, SettingScope } from '../config/settings.js';

vi.mock('../config/settings.js', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../config/settings.js')>();
  return {
    ...original,
    loadSettings: vi.fn(),
  };
});

describe('terminal auth command', () => {
  const oldEnv = process.env;

  beforeEach(() => {
    process.env = { ...oldEnv };
    vi.clearAllMocks();
  });

  it('builds diagnostics with effective auth and readiness flags', () => {
    const diagnostics = buildAuthDiagnostics(
      {
        security: {
          auth: {
            selectedType: AuthType.PAPERT_OAUTH,
            enforcedType: AuthType.USE_OPENAI,
            apiKey: 'test-key',
          },
        },
      },
      {
        OPENAI_BASE_URL: 'https://api.example.com',
        PAPERT_ADMIN_BASE_URL: 'https://admin.example.com',
      },
    );

    expect(diagnostics.effectiveType).toBe(AuthType.USE_OPENAI);
    expect(diagnostics.modeReadiness.apiKey.ready).toBe(true);
    expect(diagnostics.modeReadiness.enterprise.ready).toBe(true);
  });

  it('auth diagnose prints json output', async () => {
    const loadSettingsMock = vi.mocked(loadSettings);
    loadSettingsMock.mockReturnValue({
      merged: {
        security: {
          auth: {
            selectedType: AuthType.PAPERT_OAUTH,
          },
        },
      },
      setValue: vi.fn(),
    } as unknown as ReturnType<typeof loadSettings>);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await authCommand.handler?.({
      action: 'diagnose',
      json: true,
    } as never);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('effectiveType'));
    logSpy.mockRestore();
  });

  it('auth use enterprise switches selected and enforced auth types', async () => {
    const setValueMock = vi.fn();
    vi.mocked(loadSettings).mockReturnValue({
      merged: {},
      setValue: setValueMock,
    } as unknown as ReturnType<typeof loadSettings>);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await authCommand.handler?.({
      action: 'use',
      mode: 'enterprise',
    } as never);

    expect(setValueMock).toHaveBeenNthCalledWith(
      1,
      SettingScope.User,
      'security.auth.selectedType',
      AuthType.USE_OPENAI,
    );
    expect(setValueMock).toHaveBeenNthCalledWith(
      2,
      SettingScope.User,
      'security.auth.enforcedType',
      AuthType.USE_OPENAI,
    );
    logSpy.mockRestore();
  });

  it('prints usage for invalid mode', async () => {
    vi.mocked(loadSettings).mockReturnValue({
      merged: {},
      setValue: vi.fn(),
    } as unknown as ReturnType<typeof loadSettings>);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await authCommand.handler?.({
      action: 'use',
      mode: 'invalid-mode',
    } as never);

    expect(logSpy).toHaveBeenCalledWith(
      'Usage: papert auth use <oauth|api-key|enterprise>',
    );
    logSpy.mockRestore();
  });
});
