/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { sanitizeAdminSettings } from './admin_controls.js';

describe('sanitizeAdminSettings', () => {
  it('returns empty object for invalid settings payload', () => {
    const result = sanitizeAdminSettings({
      mcpSetting: { mcpEnabled: 'nope' },
    } as unknown as Record<string, unknown>);
    expect(result).toEqual({});
  });

  it('returns sanitized settings for valid payload', () => {
    const result = sanitizeAdminSettings({
      mcpSetting: { mcpEnabled: true },
      cliFeatureSetting: {
        extensionsSetting: { extensionsEnabled: false },
        unmanagedCapabilitiesEnabled: true,
      },
    });
    expect(result.mcpSetting?.mcpEnabled).toBe(true);
    expect(
      result.cliFeatureSetting?.extensionsSetting?.extensionsEnabled,
    ).toBe(false);
  });
});
