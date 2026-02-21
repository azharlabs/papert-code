/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import commandExists from 'command-exists';
import { loadSandboxConfig } from './sandboxConfig.js';
import { resetEnvAliasWarningsForTesting } from '../utils/envAliases.js';

vi.mock('../utils/package.js', () => ({
  getPackageJson: vi.fn(async () => ({
    config: { sandboxImageUri: 'ghcr.io/papert/sandbox:test' },
  })),
}));

vi.mock('command-exists', () => ({
  default: {
    sync: vi.fn(() => true),
  },
}));

describe('loadSandboxConfig env aliases', () => {
  beforeEach(() => {
    delete process.env['PAPERT_SANDBOX'];
    delete process.env['GEMINI_SANDBOX'];
    delete process.env['PAPERT_SANDBOX_IMAGE'];
    delete process.env['GEMINI_SANDBOX_IMAGE'];
    resetEnvAliasWarningsForTesting();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prefers PAPERT_SANDBOX over GEMINI_SANDBOX', async () => {
    process.env['PAPERT_SANDBOX'] = 'docker';
    process.env['GEMINI_SANDBOX'] = 'podman';

    const cfg = await loadSandboxConfig({} as never, {});
    expect(cfg).toEqual({
      command: 'docker',
      image: 'ghcr.io/papert/sandbox:test',
    });
    expect(commandExists.sync).toHaveBeenCalledWith('docker');
  });

  it('supports legacy GEMINI_SANDBOX when PAPERT_SANDBOX is absent', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
    process.env['GEMINI_SANDBOX'] = 'podman';

    const cfg = await loadSandboxConfig({} as never, {});
    expect(cfg).toEqual({
      command: 'podman',
      image: 'ghcr.io/papert/sandbox:test',
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('GEMINI_SANDBOX'),
    );
  });

  it('prefers PAPERT_SANDBOX_IMAGE over legacy and package fallback', async () => {
    process.env['PAPERT_SANDBOX'] = 'docker';
    process.env['PAPERT_SANDBOX_IMAGE'] = 'ghcr.io/papert/custom:image';
    process.env['GEMINI_SANDBOX_IMAGE'] = 'ghcr.io/papert/legacy:image';

    const cfg = await loadSandboxConfig({} as never, {});
    expect(cfg?.image).toBe('ghcr.io/papert/custom:image');
  });
});
