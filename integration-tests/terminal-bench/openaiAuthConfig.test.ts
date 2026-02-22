/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveTerminalBenchOpenAiConfig } from './openaiAuthConfig.js';

const tempDirs: string[] = [];

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function writeSettings(baseDir: string, payload: unknown): void {
  const papertDir = join(baseDir, '.papert');
  mkdirSync(papertDir, { recursive: true });
  writeFileSync(join(papertDir, 'settings.json'), JSON.stringify(payload));
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('resolveTerminalBenchOpenAiConfig', () => {
  it('prefers OPENAI_* environment variables', () => {
    const cwdDir = createTempDir('papert-auth-cwd-');
    const homeDir = createTempDir('papert-auth-home-');
    writeSettings(homeDir, {
      security: { auth: { apiKey: 'home-key', baseUrl: 'https://home.example' } },
      model: { name: 'home-model' },
    });

    const result = resolveTerminalBenchOpenAiConfig({
      cwd: cwdDir,
      homeDir,
      env: {
        OPENAI_API_KEY: 'env-key',
        OPENAI_BASE_URL: 'https://env.example',
        OPENAI_MODEL: 'env-model',
      },
    });

    expect(result.apiKey).toBe('env-key');
    expect(result.baseUrl).toBe('https://env.example');
    expect(result.model).toBe('env-model');
    expect(result.source).toEqual({
      apiKey: 'env',
      baseUrl: 'env',
      model: 'env',
    });
  });

  it('falls back to workspace settings before user settings', () => {
    const cwdDir = createTempDir('papert-auth-cwd-');
    const homeDir = createTempDir('papert-auth-home-');
    writeSettings(cwdDir, {
      security: {
        auth: { apiKey: 'workspace-key', baseUrl: 'https://workspace.example' },
      },
      model: { name: 'workspace-model' },
    });
    writeSettings(homeDir, {
      security: { auth: { apiKey: 'home-key', baseUrl: 'https://home.example' } },
      model: { name: 'home-model' },
    });

    const result = resolveTerminalBenchOpenAiConfig({
      cwd: cwdDir,
      homeDir,
      env: {},
    });

    expect(result.apiKey).toBe('workspace-key');
    expect(result.baseUrl).toBe('https://workspace.example');
    expect(result.model).toBe('workspace-model');
    expect(result.source).toEqual({
      apiKey: 'workspace',
      baseUrl: 'workspace',
      model: 'workspace',
    });
  });

  it('resolves $ENV style values from settings files', () => {
    const cwdDir = createTempDir('papert-auth-cwd-');
    const homeDir = createTempDir('papert-auth-home-');
    writeSettings(homeDir, {
      security: { auth: { apiKey: '$TB_KEY', baseUrl: '$TB_BASE' } },
      model: { name: '$TB_MODEL' },
    });

    const result = resolveTerminalBenchOpenAiConfig({
      cwd: cwdDir,
      homeDir,
      env: {
        TB_KEY: 'resolved-key',
        TB_BASE: 'https://resolved.example',
        TB_MODEL: 'resolved-model',
      },
    });

    expect(result.apiKey).toBe('resolved-key');
    expect(result.baseUrl).toBe('https://resolved.example');
    expect(result.model).toBe('resolved-model');
    expect(result.source).toEqual({
      apiKey: 'user',
      baseUrl: 'user',
      model: 'user',
    });
  });
});

