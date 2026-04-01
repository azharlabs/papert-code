/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import { Storage } from './storage.js';
import { getBrandConfig } from './branding.js';

describe('Storage – getGlobalSettingsPath', () => {
  it('returns path to ~/.papert/settings.json', () => {
    const expected = path.join(
      os.homedir(),
      getBrandConfig().configDirName,
      'settings.json',
    );
    expect(Storage.getGlobalSettingsPath()).toBe(expected);
  });
});

describe('Storage – additional helpers', () => {
  const projectRoot = '/tmp/project';
  const storage = new Storage(projectRoot);

  it('getWorkspaceSettingsPath returns project/.papert/settings.json', () => {
    const expected = path.join(
      projectRoot,
      getBrandConfig().configDirName,
      'settings.json',
    );
    expect(storage.getWorkspaceSettingsPath()).toBe(expected);
  });

  it('getUserCommandsDir returns ~/.papert/commands', () => {
    const expected = path.join(
      os.homedir(),
      getBrandConfig().configDirName,
      'commands',
    );
    expect(Storage.getUserCommandsDir()).toBe(expected);
  });

  it('getProjectCommandsDir returns project/.papert/commands', () => {
    const expected = path.join(
      projectRoot,
      getBrandConfig().configDirName,
      'commands',
    );
    expect(storage.getProjectCommandsDir()).toBe(expected);
  });

  it('getMcpOAuthTokensPath returns ~/.papert/mcp-oauth-tokens.json', () => {
    const expected = path.join(
      os.homedir(),
      getBrandConfig().configDirName,
      'mcp-oauth-tokens.json',
    );
    expect(Storage.getMcpOAuthTokensPath()).toBe(expected);
  });
});
