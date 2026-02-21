/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  migrateGeminiEnvNames,
  rewriteLegacyGeminiEnvNames,
  migrateCommand,
} from './migrate.js';

describe('migrate command', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('has expected command metadata', () => {
    expect(migrateCommand.command).toBe('migrate');
    expect(typeof migrateCommand.builder).toBe('function');
    expect(typeof migrateCommand.handler).toBe('function');
  });

  it('rewrites legacy GEMINI_* names to PAPERT_* names', () => {
    const source = `
export GEMINI_SANDBOX=docker
export GEMINI_TELEMETRY_ENABLED=1
if [ "$GEMINI_CLI_NO_RELAUNCH" = "true" ]; then
  echo disabled
fi
`;
    const result = rewriteLegacyGeminiEnvNames(source);

    expect(result.updatedContent).toContain('PAPERT_SANDBOX');
    expect(result.updatedContent).toContain('PAPERT_TELEMETRY_ENABLED');
    expect(result.updatedContent).toContain('PAPERT_CLI_NO_RELAUNCH');
    expect(result.updatedContent).not.toContain('GEMINI_SANDBOX');
    expect(result.replacements).toBe(3);
    expect(result.legacyVariables).toEqual([
      'GEMINI_CLI_NO_RELAUNCH',
      'GEMINI_SANDBOX',
      'GEMINI_TELEMETRY_ENABLED',
    ]);
  });

  it('updates candidate files on disk', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'papert-migrate-'));
    tempDirs.push(tempDir);

    const envPath = path.join(tempDir, '.env');
    fs.writeFileSync(
      envPath,
      'GEMINI_SANDBOX=docker\nGEMINI_TELEMETRY_TARGET=gcp\n',
      'utf-8',
    );

    const workflowsDir = path.join(tempDir, '.github', 'workflows');
    fs.mkdirSync(workflowsDir, { recursive: true });
    const workflowPath = path.join(workflowsDir, 'ci.yml');
    fs.writeFileSync(
      workflowPath,
      'env:\n  GEMINI_TELEMETRY_ENABLED: "1"\n  FOO: "bar"\n',
      'utf-8',
    );

    const result = migrateGeminiEnvNames(tempDir);

    expect(result.updatedFiles).toHaveLength(2);
    expect(result.totalReplacements).toBe(3);
    expect(fs.readFileSync(envPath, 'utf-8')).toContain('PAPERT_SANDBOX');
    expect(fs.readFileSync(envPath, 'utf-8')).not.toContain('GEMINI_SANDBOX');
    expect(fs.readFileSync(workflowPath, 'utf-8')).toContain(
      'PAPERT_TELEMETRY_ENABLED',
    );
  });

  it('supports dry-run mode without writing files', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'papert-migrate-'));
    tempDirs.push(tempDir);

    const settingsDir = path.join(tempDir, '.papert');
    fs.mkdirSync(settingsDir, { recursive: true });
    const settingsPath = path.join(settingsDir, 'settings.json');
    fs.writeFileSync(
      settingsPath,
      JSON.stringify(
        {
          hooks: {
            BeforeTool: [
              {
                hooks: [
                  {
                    command: 'echo $GEMINI_YOLO_MODE',
                  },
                ],
              },
            ],
          },
        },
        null,
        2,
      ),
      'utf-8',
    );

    const original = fs.readFileSync(settingsPath, 'utf-8');
    const result = migrateGeminiEnvNames(tempDir, { dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(result.updatedFiles).toHaveLength(1);
    expect(result.totalReplacements).toBe(1);
    expect(fs.readFileSync(settingsPath, 'utf-8')).toBe(original);
  });
});

