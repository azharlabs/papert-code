/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resetEnvAliasWarningsForTesting,
  resolveEnvAlias,
} from './envAliases.js';

describe('resolveEnvAlias', () => {
  beforeEach(() => {
    resetEnvAliasWarningsForTesting();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses canonical variable when present', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
    const value = resolveEnvAlias('PAPERT_SANDBOX', 'GEMINI_SANDBOX', {
      env: {
        PAPERT_SANDBOX: 'docker',
        GEMINI_SANDBOX: 'podman',
      },
    });
    expect(value).toBe('docker');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('falls back to legacy variable and warns once', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
    const env = { GEMINI_SANDBOX: 'docker' };

    expect(
      resolveEnvAlias('PAPERT_SANDBOX', 'GEMINI_SANDBOX', { env }),
    ).toBe('docker');
    expect(
      resolveEnvAlias('PAPERT_SANDBOX', 'GEMINI_SANDBOX', { env }),
    ).toBe('docker');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('GEMINI_SANDBOX'),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('PAPERT_SANDBOX'),
    );
  });
});
