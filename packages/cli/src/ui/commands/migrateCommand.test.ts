/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */
// @vitest-environment node

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrateCommand } from './migrateCommand.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import { CommandKind } from './types.js';

describe('migrateCommand', () => {
  const originalCwd = process.cwd();
  let tempDir: string | undefined;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'papert-migrate-test-'));
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
    tempDir = undefined;
  });

  it('has expected metadata', () => {
    expect(migrateCommand.name).toBe('migrate');
    expect(migrateCommand.kind).toBe(CommandKind.BUILT_IN);
  });

  it('returns usage error when --from-gemini is missing', async () => {
    const context = createMockCommandContext();
    const result = await migrateCommand.action?.(context, '--dry-run');
    expect(result).toEqual({
      type: 'message',
      messageType: 'error',
      content: 'Usage: /migrate --from-gemini [--dry-run]',
    });
  });

  it('runs dry-run migration without writing files', async () => {
    const envPath = path.join(process.cwd(), '.env');
    await fs.writeFile(envPath, 'GEMINI_SANDBOX=docker\n', 'utf8');

    const context = createMockCommandContext();
    const result = await migrateCommand.action?.(
      context,
      '--from-gemini --dry-run',
    );
    const content = (result as { content: string }).content;
    expect(content).toContain('[dry-run] Updated .env');
    expect(content).toContain('[dry-run] Migration complete.');

    const after = await fs.readFile(envPath, 'utf8');
    expect(after).toContain('GEMINI_SANDBOX');
    expect(after).not.toContain('PAPERT_SANDBOX');
  });

  it('rewrites legacy names when dry-run is not set', async () => {
    const envPath = path.join(process.cwd(), '.env');
    await fs.writeFile(envPath, 'GEMINI_SANDBOX=docker\n', 'utf8');

    const context = createMockCommandContext();
    const result = await migrateCommand.action?.(context, '--from-gemini');
    const content = (result as { content: string }).content;
    expect(content).toContain('Updated .env');
    expect(content).toContain('Migration complete.');

    const after = await fs.readFile(envPath, 'utf8');
    expect(after).toContain('PAPERT_SANDBOX');
    expect(after).not.toContain('GEMINI_SANDBOX');
  });

  it('returns no-op message when no legacy references exist', async () => {
    await fs.writeFile(path.join(process.cwd(), '.env'), 'PAPERT_SANDBOX=docker\n');
    const context = createMockCommandContext();

    const result = await migrateCommand.action?.(context, '--from-gemini');
    expect((result as { content: string }).content).toContain(
      'No legacy GEMINI_* env references found in migration targets.',
    );
  });

  it('offers completion candidates', async () => {
    const context = createMockCommandContext();
    expect(await migrateCommand.completion?.(context, '')).toEqual([
      '--from-gemini',
      '--from-gemini --dry-run',
      'from-gemini',
      'from-gemini --dry-run',
      '--dry-run',
    ]);
    expect(await migrateCommand.completion?.(context, '--from-g')).toEqual([
      '--from-gemini',
      '--from-gemini --dry-run',
    ]);
  });
});

