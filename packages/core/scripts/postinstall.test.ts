/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  getPlatformGuidance,
  resolveBundledRipgrepBinary,
  runPostInstallHealthChecks,
  runPostinstall,
  setupBundledRipgrep,
} from './postinstall.js';

function createMockFs(existingPaths: string[] = []) {
  const pathSet = new Set(existingPaths);
  return {
    existsSync: vi.fn((inputPath: string) => pathSet.has(inputPath)),
    chmodSync: vi.fn(),
    accessSync: vi.fn(),
    constants: {
      F_OK: 0,
      X_OK: 1,
    },
  };
}

function createLogger() {
  return {
    log: vi.fn(),
    warn: vi.fn(),
  };
}

describe('postinstall script', () => {
  it('resolves bundled ripgrep path for linux x64', () => {
    const vendorDir = '/pkg/vendor/ripgrep';
    const binaryDir = path.join(vendorDir, 'x64-linux');
    const binaryPath = path.join(binaryDir, 'rg');
    const fsModule = createMockFs([vendorDir, binaryDir, binaryPath]);

    const resolved = resolveBundledRipgrepBinary({
      platform: 'linux',
      arch: 'x64',
      vendorDir,
      fsModule,
    });

    expect(resolved.binaryPath).toBe(binaryPath);
    expect(resolved.reason).toBeNull();
  });

  it('returns reason when architecture is unsupported', () => {
    const resolved = resolveBundledRipgrepBinary({
      platform: 'linux',
      arch: 'ia32',
      vendorDir: '/pkg/vendor/ripgrep',
      fsModule: createMockFs(),
    });

    expect(resolved.binaryPath).toBeNull();
    expect(resolved.reason).toContain('unsupported architecture');
  });

  it('sets executable bit and attempts quarantine cleanup on macOS', () => {
    const vendorDir = '/pkg/vendor/ripgrep';
    const binaryDir = path.join(vendorDir, 'arm64-darwin');
    const binaryPath = path.join(binaryDir, 'rg');
    const fsModule = createMockFs([vendorDir, binaryDir, binaryPath]);
    const execCommand = vi.fn();
    const logger = createLogger();

    const result = setupBundledRipgrep({
      platform: 'darwin',
      arch: 'arm64',
      vendorDir,
      fsModule,
      execCommand,
      logger,
    });

    expect(result.binaryPath).toBe(binaryPath);
    expect(fsModule.chmodSync).toHaveBeenCalledWith(binaryPath, 0o755);
    expect(execCommand).toHaveBeenCalledWith(
      `xattr -d com.apple.quarantine "${binaryPath}"`,
      { stdio: 'pipe' },
    );
    expect(result.warnings).toEqual([]);
  });

  it('reports node-version and ripgrep availability warnings in health checks', () => {
    const logger = createLogger();
    const health = runPostInstallHealthChecks({
      platform: 'linux',
      nodeVersion: '18.17.0',
      binaryPath: null,
      execCommand: () => {
        throw new Error('rg not found');
      },
      logger,
    });

    expect(health.warnings.length).toBeGreaterThanOrEqual(2);
    expect(
      health.warnings.some((warning) => warning.includes('Node.js 18.17.0')),
    ).toBe(true);
    expect(
      health.warnings.some((warning) =>
        warning.includes('ripgrep is not available on PATH'),
      ),
    ).toBe(true);
  });

  it('emits platform-specific guidance when postinstall warnings occur', () => {
    const logger = createLogger();
    const fsModule = createMockFs();

    const result = runPostinstall({
      platform: 'win32',
      arch: 'x64',
      nodeVersion: '18.0.0',
      vendorDir: '/missing',
      fsModule,
      execCommand: () => {
        throw new Error('rg not found');
      },
      logger,
    });

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(
      logger.log.mock.calls.some(([message]) =>
        String(message).includes('Windows guidance:'),
      ),
    ).toBe(true);
  });

  it('returns linux guidance that includes chmod recovery', () => {
    const guidance = getPlatformGuidance('linux', '/tmp/rg');
    expect(guidance).toContain('Linux guidance:');
    expect(
      guidance.some((line) => line.includes('chmod +x "/tmp/rg"')),
    ).toBe(true);
  });
});
