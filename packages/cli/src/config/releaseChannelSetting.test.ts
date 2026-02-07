/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { getSettingsSchema } from './settingsSchema.js';

describe('general.releaseChannel setting', () => {
  it('defines stable, preview, and nightly options', () => {
    const schema = getSettingsSchema();
    const releaseChannel = schema.general.properties?.releaseChannel;

    expect(releaseChannel).toBeDefined();
    expect(releaseChannel?.type).toBe('enum');
    expect(releaseChannel?.default).toBe('stable');
    expect(releaseChannel?.options?.map((option) => option.value)).toEqual([
      'stable',
      'preview',
      'nightly',
    ]);
  });
});
